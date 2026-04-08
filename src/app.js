const cors = require("cors");
const express = require("express");
const morgan = require("morgan");

const env = require("./config/env");
const authRoutes = require("./routes/auth.routes");
const tableRoutes = require("./routes/table.routes");
const orderRoutes = require("./routes/order.routes");
const ordersRoutes = require("./routes/orders.routes");
const billRoutes = require("./routes/bill.routes");
const itemRoutes = require("./routes/item.routes");
const userRoutes = require("./routes/user.routes");
const { errorHandler, notFoundHandler } = require("./middleware/error.middleware");

const app = express();

app.use(
  cors({
    origin: env.corsOrigin,
    credentials: true
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan(env.nodeEnv === "production" ? "combined" : "dev"));

app.get("/health", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "Restaurant billing backend is running."
  });
});

app.use("/auth", authRoutes);
app.use("/tables", tableRoutes);
app.use("/order", orderRoutes);
app.use("/orders", ordersRoutes);
app.use("/bill", billRoutes);
app.use("/items", itemRoutes);
app.use("/users", userRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
