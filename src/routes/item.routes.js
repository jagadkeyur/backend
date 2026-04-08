const express = require("express");

const itemController = require("../controllers/item.controller");
const { authenticate, authorize, ROLES } = require("../middleware/auth.middleware");

const router = express.Router();

router.use(authenticate);

router.get(
  "/",
  authorize(ROLES.ADMIN, ROLES.WAITER, ROLES.CASHIER),
  itemController.getItems
);
router.post(
  "/",
  authorize(ROLES.ADMIN, ROLES.CASHIER),
  itemController.createItem
);
router.put(
  "/:id",
  authorize(ROLES.ADMIN, ROLES.CASHIER),
  itemController.updateItem
);

module.exports = router;
