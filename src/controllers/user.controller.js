const asyncHandler = require("../middleware/async-handler");
const userService = require("../services/user.service");

const getUsers = asyncHandler(async (req, res) => {
  const users = await userService.listUsers({
    restaurantId: req.user.restaurantId
  });

  res.status(200).json({
    success: true,
    data: users
  });
});

const createUser = asyncHandler(async (req, res) => {
  const user = await userService.createUser({
    actor: req.user,
    payload: req.body
  });

  res.status(201).json({
    success: true,
    message: "User created successfully",
    data: user
  });
});

module.exports = {
  getUsers,
  createUser
};
