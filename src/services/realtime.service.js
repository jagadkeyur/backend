const SOCKET_EVENTS = require("../constants/socket-events");
const { emitRestaurantEvent } = require("../sockets");
const {
  buildBillGeneratedData,
  buildOrderCreatedData,
  buildOrderUpdatedData,
  buildTableUpdatedData
} = require("../utils/realtime-payloads");

function emitOrderCreated({ restaurantId, order }) {
  return emitRestaurantEvent(restaurantId, SOCKET_EVENTS.ORDER_CREATED, {
    entity: "order",
    entityId: order.id,
    version: order.updatedAt,
    data: buildOrderCreatedData(order)
  });
}

function emitOrderUpdated({ restaurantId, previousOrder, order }) {
  const data = buildOrderUpdatedData(previousOrder, order);

  if (data.changedFields.length === 0) {
    return null;
  }

  return emitRestaurantEvent(restaurantId, SOCKET_EVENTS.ORDER_UPDATED, {
    entity: "order",
    entityId: order.id,
    version: order.updatedAt,
    data
  });
}

function emitTableUpdated({ restaurantId, previousTable, table }) {
  const data = buildTableUpdatedData(previousTable, table);

  if (data.changedFields.length === 0) {
    return null;
  }

  return emitRestaurantEvent(
    restaurantId,
    SOCKET_EVENTS.TABLE_UPDATED,
    {
      entity: "table",
      entityId: table.id,
      version: table.updatedAt,
      data
    },
    {
      aliases: [SOCKET_EVENTS.TABLE_STATUS_CHANGED]
    }
  );
}

function emitBillGenerated({ restaurantId, bill }) {
  return emitRestaurantEvent(restaurantId, SOCKET_EVENTS.BILL_GENERATED, {
    entity: "bill",
    entityId: bill.id,
    version: bill.createdAt,
    data: buildBillGeneratedData(bill)
  });
}

module.exports = {
  emitBillGenerated,
  emitOrderCreated,
  emitOrderUpdated,
  emitTableUpdated
};
