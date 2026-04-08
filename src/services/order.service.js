const mongoose = require("mongoose");

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

async function populateOrder(orderId) {
  return Order.findById(orderId)
    .populate("tableId", "tableNumber status currentOrderId")
    .populate("waiterId", "name role restaurantId");
}

async function createOrder({ actor, payload }) {
  const { restaurantId } = actor;
  const { tableId, clientOrderId } = payload;
  const requestedStatus = payload.status || ORDER_STATUS.PREPARING;

  if (!mongoose.isValidObjectId(tableId)) {
    throw new AppError("A valid tableId is required.", 400);
  }

  if (!Object.values(ORDER_STATUS).includes(requestedStatus)) {
    throw new AppError("Invalid order status.", 400);
  }

  if (clientOrderId) {
    const existingOrder = await Order.findOne({ restaurantId, clientOrderId });

    if (existingOrder) {
      return populateOrder(existingOrder.id);
    }
  }

  const table = await tableService.getTableById({ restaurantId, tableId });
  const previousTableSnapshot = table.toObject ? table.toObject() : table;
  const activeOrder = await Order.findOne({
    restaurantId,
    tableId,
    isLocked: false
  });

  if (activeOrder) {
    throw new AppError("This table already has an active order.", 409);
  }

  const items = normaliseOrderItems(payload.items);
  const total = calculateOrderTotal(items);

  const order = await Order.create({
    restaurantId,
    clientOrderId: clientOrderId || null,
    tableId: table.id,
    items,
    status: requestedStatus,
    total,
    waiterId: actor.id
  });

  const tableStatus = tableService.deriveTableStatusFromOrderStatus(order.status);
  const updatedTable = await tableService.setTableStatus({
    tableId: table.id,
    restaurantId,
    status: tableStatus,
    currentOrderId: order.id
  });

  const populatedOrder = await populateOrder(order.id);

  realtimeService.emitOrderCreated({
    restaurantId,
    order: populatedOrder
  });
  realtimeService.emitTableUpdated({
    restaurantId,
    previousTable: previousTableSnapshot,
    table: updatedTable
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

  if (actor.role === ROLES.WAITER && String(order.waiterId) !== actor.id) {
    throw new AppError("Waiters can update only their own orders.", 403);
  }

  if (order.isLocked) {
    throw new AppError("This order is locked because billing has already started.", 409);
  }

  const previousOrderSnapshot = await populateOrder(order.id);
  let previousTableId = String(order.tableId);
  let touchedOldTable = null;
  let touchedNewTable = null;
  const sourceTableSnapshot = await tableService.getTableById({
    restaurantId: actor.restaurantId,
    tableId: previousTableId
  });
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

  if (payload.tableId && String(payload.tableId) !== previousTableId) {
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

  const derivedTableStatus = tableService.deriveTableStatusFromOrderStatus(order.status);

  touchedNewTable = await tableService.setTableStatus({
    tableId: order.tableId,
    restaurantId: actor.restaurantId,
    status: derivedTableStatus,
    currentOrderId: order.id
  });

  const populatedOrder = await populateOrder(order.id);

  realtimeService.emitOrderUpdated({
    restaurantId: actor.restaurantId,
    previousOrder: previousOrderSnapshot,
    order: populatedOrder
  });

  if (touchedOldTable) {
    realtimeService.emitTableUpdated({
      restaurantId: actor.restaurantId,
      previousTable: sourceTableSnapshot,
      table: touchedOldTable
    });
  }

  realtimeService.emitTableUpdated({
    restaurantId: actor.restaurantId,
    previousTable:
      previousTableId === String(order.tableId)
        ? sourceTableSnapshot
        : targetTableSnapshot,
    table: touchedNewTable
  });

  return populatedOrder;
}

async function listOrders({ actor, query }) {
  const filter = {
    restaurantId: actor.restaurantId
  };

  if (actor.role === ROLES.WAITER) {
    filter.waiterId = actor.id;
  }

  if (query.status && Object.values(ORDER_STATUS).includes(query.status)) {
    filter.status = query.status;
  }

  if (query.tableId && mongoose.isValidObjectId(query.tableId)) {
    filter.tableId = query.tableId;
  }

  return Order.find(filter)
    .populate("tableId", "tableNumber status")
    .populate("waiterId", "name role")
    .sort({ createdAt: -1 });
}

module.exports = {
  createOrder,
  updateOrder,
  listOrders
};
