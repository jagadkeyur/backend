const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema(
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
    }
  },
  { _id: false }
);

module.exports = orderItemSchema;
