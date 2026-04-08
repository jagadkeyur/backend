const User = require("../models/User");
const AppError = require("../utils/app-error");
const { signToken } = require("../utils/jwt");

async function login({ email, password }) {
  if (!email || !password) {
    throw new AppError("Email and password are required.", 400);
  }

  const user = await User.findOne({ email: email.toLowerCase().trim() }).select("+password");

  if (!user) {
    throw new AppError("Invalid email or password.", 401);
  }

  const isPasswordValid = await user.comparePassword(password);

  if (!isPasswordValid) {
    throw new AppError("Invalid email or password.", 401);
  }

  const token = signToken({
    sub: user.id,
    role: user.role,
    restaurantId: user.restaurantId
  });

  user.token = token;
  await user.save({ validateBeforeSave: false });

  return {
    token,
    user: user.toJSON()
  };
}

module.exports = {
  login
};
