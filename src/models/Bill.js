const mongoose = require("mongoose");

const { DISCOUNT_TYPES } = require("../constants/billing");

const billItemSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    qty: {
      type: Number,
      required: true,
      min: 1
    },
    price: {
      type: Number,
      required: true,
      min: 0
    },
    lineTotal: {
      type: Number,
      required: true,
      min: 0
    }
  },
  {
    _id: false
  }
);

const taxBreakdownSchema = new mongoose.Schema(
  {
    label: {
      type: String,
      required: true,
      trim: true
    },
    rate: {
      type: Number,
      required: true,
      min: 0
    },
    taxableAmount: {
      type: Number,
      required: true,
      min: 0
    },
    amount: {
      type: Number,
      required: true,
      min: 0
    }
  },
  {
    _id: false
  }
);

const billSchema = new mongoose.Schema(
  {
    restaurantId: {
      type: String,
      required: true,
      index: true,
      default: "demo-restaurant"
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      unique: true
    },
    total: {
      type: Number,
      required: true,
      min: 0
    },
    subtotal: {
      type: Number,
      required: true,
      min: 0
    },
    taxableAmount: {
      type: Number,
      required: true,
      min: 0
    },
    taxRate: {
      type: Number,
      required: true,
      min: 0
    },
    tax: {
      type: Number,
      required: true,
      min: 0
    },
    taxBreakdown: {
      type: [taxBreakdownSchema],
      default: []
    },
    discountType: {
      type: String,
      enum: Object.values(DISCOUNT_TYPES),
      required: true,
      default: DISCOUNT_TYPES.FLAT
    },
    discountValue: {
      type: Number,
      required: true,
      min: 0,
      default: 0
    },
    discount: {
      type: Number,
      required: true,
      min: 0,
      default: 0
    },
    finalAmount: {
      type: Number,
      required: true,
      min: 0
    },
    items: {
      type: [billItemSchema],
      default: []
    },
    receiptText: {
      type: String,
      default: null
    },
    generatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("Bill", billSchema);
