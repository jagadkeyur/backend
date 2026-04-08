const TABLE_STATUS = Object.freeze({
  EMPTY: "empty",
  OCCUPIED: "occupied",
  BILLING: "billing",
  SERVED: "served"
});

const ORDER_STATUS = Object.freeze({
  PREPARING: "preparing",
  READY: "ready",
  SERVED: "served"
});

module.exports = {
  TABLE_STATUS,
  ORDER_STATUS
};
