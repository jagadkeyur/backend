const mongoose = require("mongoose");

const Table = require("../models/Table");
const Order = require("../models/Order");
const AppError = require("../utils/app-error");
const { TABLE_STATUS, ORDER_STATUS } = require("../constants/statuses");
const realtimeService = require("./realtime.service");

async function listTables(restaurantId) {
  return Table.find({ restaurantId }).sort({ tableNumber: 1 });
}

async function getTableById({ restaurantId, tableId }) {
  const table = await Table.findOne({ _id: tableId, restaurantId });

  if (!table) {
    throw new AppError("Table not found.", 404);
  }

  return table;
}

function deriveTableStatusFromOrderStatus(orderStatus) {
  if (orderStatus === ORDER_STATUS.SERVED) {
    return TABLE_STATUS.SERVED;
  }

  return TABLE_STATUS.OCCUPIED;
}

async function setTableStatus({
  tableId,
  restaurantId,
  status,
  currentOrderId = null
}) {
  const table = await getTableById({ restaurantId, tableId });
  table.status = status;
  table.currentOrderId = currentOrderId;
  await table.save();
  return table;
}

async function releaseTable({ actor, tableId }) {
  if (!mongoose.isValidObjectId(tableId)) {
    throw new AppError("Invalid table identifier.", 400);
  }

  const table = await getTableById({
    restaurantId: actor.restaurantId,
    tableId
  });
  const previousTableSnapshot = table.toObject ? table.toObject() : table;

  if (!table.currentOrderId) {
    throw new AppError("This table does not have a bill-ready order to release.", 409);
  }

  const currentOrder = await Order.findOne({
    _id: table.currentOrderId,
    restaurantId: actor.restaurantId
  });

  if (!currentOrder || !currentOrder.isLocked) {
    throw new AppError(
      "Only billed orders can release a table back to empty.",
      409
    );
  }

  const releasedTable = await setTableStatus({
    tableId: table.id,
    restaurantId: actor.restaurantId,
    status: TABLE_STATUS.EMPTY,
    currentOrderId: null
  });

  realtimeService.emitTableUpdated({
    restaurantId: actor.restaurantId,
    previousTable: previousTableSnapshot,
    table: releasedTable
  });

  return releasedTable;
}

module.exports = {
  listTables,
  getTableById,
  setTableStatus,
  releaseTable,
  deriveTableStatusFromOrderStatus,
  TABLE_STATUS
};
