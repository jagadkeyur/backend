const SOCKET_EVENTS = Object.freeze({
  CONNECTED: "connected",
  ORDER_CREATED: "order_created",
  ORDER_UPDATED: "order_updated",
  TABLE_UPDATED: "table_updated",
  TABLE_STATUS_CHANGED: "table_status_changed",
  BILL_GENERATED: "bill_generated"
});

module.exports = SOCKET_EVENTS;
