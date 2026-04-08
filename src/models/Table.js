const mongoose = require("mongoose");

const { TABLE_STATUS } = require("../constants/statuses");

const tableSchema = new mongoose.Schema(
  {
    restaurantId: {
      type: String,
      required: true,
      index: true,
      default: "demo-restaurant"
    },
    tableNumber: {
      type: Number,
      required: true,
      min: 1
    },
    status: {
      type: String,
      enum: Object.values(TABLE_STATUS),
      default: TABLE_STATUS.EMPTY
    },
    currentOrderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null
    }
  },
  {
    timestamps: true
  }
);

tableSchema.index({ restaurantId: 1, tableNumber: 1 }, { unique: true });

module.exports = mongoose.model("Table", tableSchema);
