const ROLES = require("../constants/roles");
const User = require("../models/User");
const AppError = require("../utils/app-error");

function normalizeUserPayload(payload) {
  const name = payload?.name?.trim();
  const email = payload?.email?.toLowerCase().trim();
  const password = payload?.password;
  const role = payload?.role;

  if (!name) {
    throw new AppError("User name is required.", 400);
  }

  if (!email) {
    throw new AppError("User email is required.", 400);
  }

  if (!password || password.length < 6) {
    throw new AppError("Password must be at least 6 characters long.", 400);
  }

  if (!Object.values(ROLES).includes(role)) {
    throw new AppError("User role is invalid.", 400);
  }

  return {
    name,
    email,
    password,
    role
  };
}

async function listUsers({ restaurantId }) {
  return User.find({ restaurantId })
    .select("name email role createdAt updatedAt restaurantId")
    .sort({ role: 1, name: 1 });
}

async function createUser({ actor, payload }) {
  const userData = normalizeUserPayload(payload);

  if (userData.role === ROLES.ADMIN && actor.role !== ROLES.ADMIN) {
    throw new AppError("Only admins can create other admins.", 403);
  }

  return User.create({
    ...userData,
    token: null,
    restaurantId: actor.restaurantId
  });
}

module.exports = {
  listUsers,
  createUser
};
