const express = require("express");

const billController = require("../controllers/bill.controller");
const { authenticate, authorize, ROLES } = require("../middleware/auth.middleware");

const router = express.Router();

router.use(authenticate);

router.post(
  "/generate",
  authorize(ROLES.ADMIN, ROLES.CASHIER),
  billController.generateBill
);

router.get(
  "/:id",
  authorize(ROLES.ADMIN, ROLES.CASHIER),
  billController.getBill
);

module.exports = router;
