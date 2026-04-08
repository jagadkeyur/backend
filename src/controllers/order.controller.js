const asyncHandler = require("../middleware/async-handler");
const orderService = require("../services/order.service");

const createOrder = asyncHandler(async (req, res) => {
  const order = await orderService.createOrder({
    actor: req.user,
    payload: req.body
  });

  res.status(201).json({
    success: true,
    message: "Order created successfully",
    data: order
  });
});

const updateOrder = asyncHandler(async (req, res) => {
  const order = await orderService.updateOrder({
    actor: req.user,
    orderId: req.params.id,
    payload: req.body
  });

  res.status(200).json({
    success: true,
    message: "Order updated successfully",
    data: order
  });
});

const getOrders = asyncHandler(async (req, res) => {
  const orders = await orderService.listOrders({
    actor: req.user,
    query: req.query
  });

  res.status(200).json({
    success: true,
    data: orders
  });
});

module.exports = {
  createOrder,
  updateOrder,
  getOrders
};
