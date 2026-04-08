const mongoose = require("mongoose");

const itemSchema = new mongoose.Schema(
  {
    restaurantId: {
      type: String,
      required: true,
      index: true,
      default: "demo-restaurant"
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    category: {
      type: String,
      trim: true,
      default: "General"
    },
    price: {
      type: Number,
      required: true,
      min: 0
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

itemSchema.index({ restaurantId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model("Item", itemSchema);
