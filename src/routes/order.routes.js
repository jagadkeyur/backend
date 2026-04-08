const express = require("express");

const orderController = require("../controllers/order.controller");
const { authenticate, authorize, ROLES } = require("../middleware/auth.middleware");

const router = express.Router();

router.use(authenticate);

router.post(
  "/",
  authorize(ROLES.ADMIN, ROLES.WAITER),
  orderController.createOrder
);

router.put(
  "/:id",
  authorize(ROLES.ADMIN, ROLES.WAITER, ROLES.CASHIER),
  orderController.updateOrder
);

module.exports = router;
