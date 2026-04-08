const User = require("../models/User");
const ROLES = require("../constants/roles");
const AppError = require("../utils/app-error");
const { verifyToken } = require("../utils/jwt");

async function authenticate(req, _res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return next(new AppError("Authentication token is missing.", 401));
    }

    const token = authHeader.split(" ")[1];
    const payload = verifyToken(token);
    const user = await User.findById(payload.sub);

    if (!user) {
      return next(new AppError("User not found for the provided token.", 401));
    }

    req.user = {
      id: user.id,
      name: user.name,
      role: user.role,
      restaurantId: payload.restaurantId || user.restaurantId
    };

    return next();
  } catch (error) {
    return next(new AppError("Invalid or expired authentication token.", 401));
  }
}

function authorize(...allowedRoles) {
  return (req, _res, next) => {
    if (!req.user) {
      return next(new AppError("User context is missing.", 401));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new AppError(
          `Role ${req.user.role} is not allowed to access this resource.`,
          403
        )
      );
    }

    return next();
  };
}

module.exports = {
  authenticate,
  authorize,
  ROLES
};
