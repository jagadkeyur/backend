const express = require("express");

const tableController = require("../controllers/table.controller");
const { authenticate, authorize, ROLES } = require("../middleware/auth.middleware");

const router = express.Router();

router.use(authenticate);
router.get(
  "/",
  authorize(ROLES.ADMIN, ROLES.WAITER, ROLES.CASHIER),
  tableController.getTables
);
router.post(
  "/:id/release",
  authorize(ROLES.ADMIN, ROLES.CASHIER),
  tableController.releaseTable
);

module.exports = router;
