const mongoose = require("mongoose");

const { ORDER_TYPES } = require("../constants/order-types");
const ROLES = require("../constants/roles");
const { ORDER_STATUS, TABLE_STATUS } = require("../constants/statuses");
const Order = require("../models/Order");
const Table = require("../models/Table");
const AppError = require("../utils/app-error");
const realtimeService = require("./realtime.service");
const tableService = require("./table.service");

function normaliseOrderItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new AppError("At least one order item is required.", 400);
  }

  return items.map((item, index) => {
    const name = item?.name?.trim();
    const qty = Number(item?.qty);
    const price = Number(item?.price);

    if (!name) {
      throw new AppError(`Item ${index + 1} is missing a name.`, 400);
    }

    if (!Number.isFinite(qty) || qty <= 0) {
      throw new AppError(`Item ${name} has an invalid quantity.`, 400);
    }

    if (!Number.isFinite(price) || price < 0) {
      throw new AppError(`Item ${name} has an invalid price.`, 400);
    }

    return {
      name,
      qty,
      price
    };
  });
}

function calculateOrderTotal(items) {
  return items.reduce((sum, item) => sum + item.qty * item.price, 0);
}

function normaliseOrderType(orderType) {
  if (!orderType) {
    return ORDER_TYPES.DINE_IN;
  }

  const value = String(orderType).trim().toLowerCase();
  if (!Object.values(ORDER_TYPES).includes(value)) {
    throw new AppError("Order type must be either dine_in or parcel.", 400);
  }

  return value;
}

function normaliseOptionalText(value) {
  if (value === undefined || value === null) {
    return null;
  }

  const trimmedValue = String(value).trim();
  return trimmedValue ? trimmedValue : null;
}

function buildParcelLabel(orderId) {
  return `PARCEL-${String(orderId).slice(-5).toUpperCase()}`;
}

function mergeOrderItems(primaryItems, secondaryItems) {
  const merged = new Map();

  for (const item of [...primaryItems, ...secondaryItems]) {
    const key = `${item.name}::${Number(item.price)}`;
    const existing = merged.get(key);

    if (existing) {
      existing.qty += Number(item.qty);
      continue;
    }

    merged.set(key, {
      name: item.name,
      qty: Number(item.qty),
      price: Number(item.price)
    });
  }

  return [...merged.values()];
}

function mergeOrderStatuses(leftStatus, rightStatus) {
  const statuses = [leftStatus, rightStatus];

  if (statuses.includes(ORDER_STATUS.PREPARING)) {
    return ORDER_STATUS.PREPARING;
  }

  if (statuses.includes(ORDER_STATUS.READY)) {
    return ORDER_STATUS.READY;
  }

  return ORDER_STATUS.SERVED;
}

async function populateOrder(orderId) {
  return Order.findById(orderId)
    .populate("tableId", "tableNumber status currentOrderId")
    .populate("waiterId", "name role restaurantId");
}

async function createOrder({ actor, payload }) {
  const { restaurantId } = actor;
  const { tableId, clientOrderId } = payload;
  const requestedStatus = payload.status || ORDER_STATUS.PREPARING;
  const orderType = normaliseOrderType(payload.orderType);
  const isParcelOrder = orderType === ORDER_TYPES.PARCEL;

  if (!Object.values(ORDER_STATUS).includes(requestedStatus)) {
    throw new AppError("Invalid order status.", 400);
  }

  if (clientOrderId) {
    const existingOrder = await Order.findOne({ restaurantId, clientOrderId });

    if (existingOrder) {
      return populateOrder(existingOrder.id);
    }
  }

  let table = null;
  let previousTableSnapshot = null;

  if (!isParcelOrder) {
    if (!mongoose.isValidObjectId(tableId)) {
      throw new AppError("A valid tableId is required.", 400);
    }

    table = await tableService.getTableById({ restaurantId, tableId });
    previousTableSnapshot = table.toObject ? table.toObject() : table;
    const activeOrder = await Order.findOne({
      restaurantId,
      tableId,
      isLocked: false,
      mergedIntoOrderId: null
    });

    if (activeOrder) {
      throw new AppError("This table already has an active order.", 409);
    }
  }

  const items = normaliseOrderItems(payload.items);
  const total = calculateOrderTotal(items);

  const order = await Order.create({
    restaurantId,
    clientOrderId: clientOrderId || null,
    orderType,
    tableId: table?.id || null,
    parcelLabel: normaliseOptionalText(payload.parcelLabel),
    customerName: normaliseOptionalText(payload.customerName),
    customerPhone: normaliseOptionalText(payload.customerPhone),
    items,
    status: requestedStatus,
    total,
    waiterId: actor.id
  });

  if (isParcelOrder && !order.parcelLabel) {
    order.parcelLabel = buildParcelLabel(order.id);
    await order.save();
  }

  if (table && previousTableSnapshot) {
    const tableStatus = tableService.deriveTableStatusFromOrderStatus(order.status);
    const updatedTable = await tableService.setTableStatus({
      tableId: table.id,
      restaurantId,
      status: tableStatus,
      currentOrderId: order.id
    });

    realtimeService.emitTableUpdated({
      restaurantId,
      previousTable: previousTableSnapshot,
      table: updatedTable
    });
  }

  const populatedOrder = await populateOrder(order.id);

  realtimeService.emitOrderCreated({
    restaurantId,
    order: populatedOrder
  });

  return populatedOrder;
}

async function updateOrder({ actor, orderId, payload }) {
  if (!mongoose.isValidObjectId(orderId)) {
    throw new AppError("Invalid order identifier.", 400);
  }

  const order = await Order.findOne({
    _id: orderId,
    restaurantId: actor.restaurantId
  });

  if (!order) {
    throw new AppError("Order not found.", 404);
  }

  if (order.mergedIntoOrderId) {
    throw new AppError("Merged orders can no longer be edited.", 409);
  }

  if (actor.role === ROLES.WAITER && String(order.waiterId) !== actor.id) {
    throw new AppError("Waiters can update only their own orders.", 403);
  }

  if (order.isLocked) {
    throw new AppError("This order is locked because billing has already started.", 409);
  }

  const previousOrderSnapshot = await populateOrder(order.id);
  const previousTableId = order.tableId ? String(order.tableId) : null;
  let touchedOldTable = null;
  let touchedNewTable = null;
  const sourceTableSnapshot = previousTableId
    ? await tableService.getTableById({
        restaurantId: actor.restaurantId,
        tableId: previousTableId
      })
    : null;
  let targetTableSnapshot = sourceTableSnapshot;

  if (payload.items) {
    const items = normaliseOrderItems(payload.items);
    order.items = items;
    order.total = calculateOrderTotal(items);
  }

  if (payload.status) {
    if (!Object.values(ORDER_STATUS).includes(payload.status)) {
      throw new AppError("Invalid order status.", 400);
    }

    order.status = payload.status;
  }

  order.parcelLabel =
    payload.parcelLabel !== undefined
      ? normaliseOptionalText(payload.parcelLabel)
      : order.parcelLabel;
  order.customerName =
    payload.customerName !== undefined
      ? normaliseOptionalText(payload.customerName)
      : order.customerName;
  order.customerPhone =
    payload.customerPhone !== undefined
      ? normaliseOptionalText(payload.customerPhone)
      : order.customerPhone;

  if (order.orderType === ORDER_TYPES.PARCEL && payload.tableId) {
    throw new AppError("Parcel orders cannot be assigned to a dining table.", 409);
  }

  if (
    order.orderType === ORDER_TYPES.DINE_IN &&
    payload.tableId &&
    String(payload.tableId) !== previousTableId
  ) {
    if (!mongoose.isValidObjectId(payload.tableId)) {
      throw new AppError("Invalid tableId.", 400);
    }

    const targetTable = await Table.findOne({
      _id: payload.tableId,
      restaurantId: actor.restaurantId
    });

    if (!targetTable) {
      throw new AppError("Target table not found.", 404);
    }

    targetTableSnapshot = targetTable.toObject ? targetTable.toObject() : targetTable;

    const conflictingOrder = await Order.findOne({
      restaurantId: actor.restaurantId,
      tableId: payload.tableId,
      isLocked: false,
      mergedIntoOrderId: null,
      _id: { $ne: order.id }
    });

    if (conflictingOrder) {
      throw new AppError("Target table already has an active order.", 409);
    }

    order.tableId = targetTable.id;

    touchedOldTable = await tableService.setTableStatus({
      tableId: previousTableId,
      restaurantId: actor.restaurantId,
      status: TABLE_STATUS.EMPTY,
      currentOrderId: null
    });
  }

  await order.save();

  if (order.orderType === ORDER_TYPES.DINE_IN && order.tableId) {
    const derivedTableStatus = tableService.deriveTableStatusFromOrderStatus(
      order.status
    );

    touchedNewTable = await tableService.setTableStatus({
      tableId: order.tableId,
      restaurantId: actor.restaurantId,
      status: derivedTableStatus,
      currentOrderId: order.id
    });
  }

  const populatedOrder = await populateOrder(order.id);

  realtimeService.emitOrderUpdated({
    restaurantId: actor.restaurantId,
    previousOrder: previousOrderSnapshot,
    order: populatedOrder
  });

  if (touchedOldTable && sourceTableSnapshot) {
    realtimeService.emitTableUpdated({
      restaurantId: actor.restaurantId,
      previousTable: sourceTableSnapshot,
      table: touchedOldTable
    });
  }

  if (touchedNewTable) {
    realtimeService.emitTableUpdated({
      restaurantId: actor.restaurantId,
      previousTable:
        previousTableId === String(order.tableId)
          ? sourceTableSnapshot
          : targetTableSnapshot,
      table: touchedNewTable
    });
  }

  return populatedOrder;
}

async function listOrders({ actor, query }) {
  const filter = {
    restaurantId: actor.restaurantId,
    mergedIntoOrderId: null
  };

  if (actor.role === ROLES.WAITER) {
    filter.waiterId = actor.id;
  }

  if (query.status && Object.values(ORDER_STATUS).includes(query.status)) {
    filter.status = query.status;
  }

  if (query.orderType && Object.values(ORDER_TYPES).includes(query.orderType)) {
    filter.orderType = query.orderType;
  }

  if (query.tableId && mongoose.isValidObjectId(query.tableId)) {
    filter.tableId = query.tableId;
  }

  return Order.find(filter)
    .populate("tableId", "tableNumber status")
    .populate("waiterId", "name role")
    .sort({ createdAt: -1 });
}

async function mergeTableOrders({ actor, sourceTableId, targetTableId }) {
  if (!mongoose.isValidObjectId(sourceTableId)) {
    throw new AppError("A valid sourceTableId is required.", 400);
  }

  if (!mongoose.isValidObjectId(targetTableId)) {
    throw new AppError("A valid targetTableId is required.", 400);
  }

  if (String(sourceTableId) === String(targetTableId)) {
    throw new AppError("Choose a different target table for merge.", 400);
  }

  const sourceTable = await tableService.getTableById({
    restaurantId: actor.restaurantId,
    tableId: sourceTableId
  });
  const targetTable = await tableService.getTableById({
    restaurantId: actor.restaurantId,
    tableId: targetTableId
  });

  const sourceTableSnapshot = sourceTable.toObject ? sourceTable.toObject() : sourceTable;
  const targetTableSnapshot = targetTable.toObject ? targetTable.toObject() : targetTable;

  const sourceOrder = await Order.findOne({
    restaurantId: actor.restaurantId,
    tableId: sourceTable.id,
    orderType: ORDER_TYPES.DINE_IN,
    mergedIntoOrderId: null
  }).sort({ updatedAt: -1 });

  if (!sourceOrder) {
    throw new AppError("The source table does not have an active order to merge.", 409);
  }

  if (sourceOrder.isLocked) {
    throw new AppError("Billed tables cannot be merged.", 409);
  }

  const targetOrder = await Order.findOne({
    restaurantId: actor.restaurantId,
    tableId: targetTable.id,
    orderType: ORDER_TYPES.DINE_IN,
    mergedIntoOrderId: null
  }).sort({ updatedAt: -1 });

  if (targetOrder?.isLocked) {
    throw new AppError("The target table already has billing in progress.", 409);
  }

  if (!targetOrder && targetTable.status !== TABLE_STATUS.EMPTY) {
    throw new AppError("Target table is not available for merge right now.", 409);
  }

  const previousSourceOrderSnapshot = await populateOrder(sourceOrder.id);

  if (!targetOrder) {
    sourceOrder.tableId = targetTable.id;
    await sourceOrder.save();

    const releasedSourceTable = await tableService.setTableStatus({
      tableId: sourceTable.id,
      restaurantId: actor.restaurantId,
      status: TABLE_STATUS.EMPTY,
      currentOrderId: null
    });
    const updatedTargetTable = await tableService.setTableStatus({
      tableId: targetTable.id,
      restaurantId: actor.restaurantId,
      status: tableService.deriveTableStatusFromOrderStatus(sourceOrder.status),
      currentOrderId: sourceOrder.id
    });
    const movedOrder = await populateOrder(sourceOrder.id);

    realtimeService.emitOrderUpdated({
      restaurantId: actor.restaurantId,
      previousOrder: previousSourceOrderSnapshot,
      order: movedOrder
    });
    realtimeService.emitTableUpdated({
      restaurantId: actor.restaurantId,
      previousTable: sourceTableSnapshot,
      table: releasedSourceTable
    });
    realtimeService.emitTableUpdated({
      restaurantId: actor.restaurantId,
      previousTable: targetTableSnapshot,
      table: updatedTargetTable
    });

    return {
      mergedOrder: movedOrder,
      archivedOrder: null,
      sourceTable: releasedSourceTable,
      targetTable: updatedTargetTable
    };
  }

  const previousTargetOrderSnapshot = await populateOrder(targetOrder.id);
  const mergedItems = mergeOrderItems(targetOrder.items, sourceOrder.items);
  const mergedAt = new Date();

  targetOrder.items = mergedItems;
  targetOrder.total = calculateOrderTotal(mergedItems);
  targetOrder.status = mergeOrderStatuses(targetOrder.status, sourceOrder.status);
  await targetOrder.save();

  sourceOrder.mergedIntoOrderId = targetOrder.id;
  sourceOrder.mergedAt = mergedAt;
  await sourceOrder.save();

  const releasedSourceTable = await tableService.setTableStatus({
    tableId: sourceTable.id,
    restaurantId: actor.restaurantId,
    status: TABLE_STATUS.EMPTY,
    currentOrderId: null
  });
  const updatedTargetTable = await tableService.setTableStatus({
    tableId: targetTable.id,
    restaurantId: actor.restaurantId,
    status: tableService.deriveTableStatusFromOrderStatus(targetOrder.status),
    currentOrderId: targetOrder.id
  });

  const mergedOrder = await populateOrder(targetOrder.id);
  const archivedSourceOrder = await populateOrder(sourceOrder.id);

  realtimeService.emitOrderUpdated({
    restaurantId: actor.restaurantId,
    previousOrder: previousTargetOrderSnapshot,
    order: mergedOrder
  });
  realtimeService.emitOrderUpdated({
    restaurantId: actor.restaurantId,
    previousOrder: previousSourceOrderSnapshot,
    order: archivedSourceOrder
  });
  realtimeService.emitTableUpdated({
    restaurantId: actor.restaurantId,
    previousTable: sourceTableSnapshot,
    table: releasedSourceTable
  });
  realtimeService.emitTableUpdated({
    restaurantId: actor.restaurantId,
    previousTable: targetTableSnapshot,
    table: updatedTargetTable
  });

  return {
    mergedOrder,
    archivedOrder: archivedSourceOrder,
    sourceTable: releasedSourceTable,
    targetTable: updatedTargetTable
  };
}

module.exports = {
  createOrder,
  updateOrder,
  listOrders,
  mergeTableOrders
};
