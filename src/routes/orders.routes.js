const express = require("express");

const orderController = require("../controllers/order.controller");
const { authenticate, authorize, ROLES } = require("../middleware/auth.middleware");

const router = express.Router();

router.use(authenticate);

router.get(
  "/",
  authorize(ROLES.ADMIN, ROLES.WAITER, ROLES.CASHIER),
  orderController.getOrders
);

module.exports = router;
