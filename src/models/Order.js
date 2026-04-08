const mongoose = require("mongoose");

const { ORDER_STATUS } = require("../constants/statuses");
const orderItemSchema = require("./OrderItem");

const orderSchema = new mongoose.Schema(
  {
    restaurantId: {
      type: String,
      required: true,
      index: true,
      default: "demo-restaurant"
    },
    clientOrderId: {
      type: String,
      trim: true,
      default: null
    },
    tableId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Table",
      required: true
    },
    items: {
      type: [orderItemSchema],
      validate: {
        validator(items) {
          return Array.isArray(items) && items.length > 0;
        },
        message: "At least one order item is required."
      }
    },
    status: {
      type: String,
      enum: Object.values(ORDER_STATUS),
      default: ORDER_STATUS.PREPARING
    },
    total: {
      type: Number,
      required: true,
      min: 0
    },
    waiterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    isLocked: {
      type: Boolean,
      default: false
    },
    lockedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

orderSchema.index(
  { restaurantId: 1, clientOrderId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      clientOrderId: { $type: "string" }
    }
  }
);

module.exports = mongoose.model("Order", orderSchema);
