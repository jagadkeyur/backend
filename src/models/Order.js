const mongoose = require("mongoose");

const { ORDER_TYPES } = require("../constants/order-types");
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
    orderType: {
      type: String,
      enum: Object.values(ORDER_TYPES),
      default: ORDER_TYPES.DINE_IN
    },
    tableId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Table",
      required() {
        return this.orderType !== ORDER_TYPES.PARCEL;
      },
      default: null
    },
    parcelLabel: {
      type: String,
      trim: true,
      default: null
    },
    customerName: {
      type: String,
      trim: true,
      default: null
    },
    customerPhone: {
      type: String,
      trim: true,
      default: null
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
    },
    mergedIntoOrderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null
    },
    mergedAt: {
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
