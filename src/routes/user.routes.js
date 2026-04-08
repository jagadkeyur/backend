const express = require("express");

const userController = require("../controllers/user.controller");
const { authenticate, authorize, ROLES } = require("../middleware/auth.middleware");

const router = express.Router();

router.use(authenticate);

router.get(
  "/",
  authorize(ROLES.ADMIN),
  userController.getUsers
);
router.post(
  "/",
  authorize(ROLES.ADMIN),
  userController.createUser
);

module.exports = router;
