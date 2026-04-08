const dotenv = require("dotenv");
const path = require("path");

dotenv.config({
  path: path.resolve(process.cwd(), process.env.ENV_FILE || ".env.dev"),
});

const env = {
  port: Number(process.env.PORT || 5000),
  nodeEnv: process.env.NODE_ENV || "development",
  mongodbUri:
    process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/restaurant_billing",
  jwtSecret: process.env.JWT_SECRET || "development-secret-change-me",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "12h",
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:5173",
  defaultGstPercent: Number(process.env.DEFAULT_GST_PERCENT || 5),
};

module.exports = env;
