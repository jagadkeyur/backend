const mongoose = require("mongoose");

const Bill = require("../models/Bill");
const Order = require("../models/Order");
const AppError = require("../utils/app-error");
const env = require("../config/env");
const billingService = require("./billing.service");
const realtimeService = require("./realtime.service");
const tableService = require("./table.service");

function buildReceiptText(bill) {
  const relatedOrder =
    bill.orderId && typeof bill.orderId === "object" ? bill.orderId : null;
  const generatedBy =
    bill.generatedBy && typeof bill.generatedBy === "object"
      ? bill.generatedBy.name
      : null;

  return billingService.buildPrintableReceipt({
    billId: bill.id,
    restaurantName: "Restaurant Billing",
    tableNumber: relatedOrder?.tableId?.tableNumber || null,
    waiterName: relatedOrder?.waiterId?.name || generatedBy,
    items: bill.items || [],
    subtotal: bill.subtotal ?? bill.total,
    taxableAmount: bill.taxableAmount,
    taxRate: bill.taxRate,
    tax: bill.tax,
    discountType: bill.discountType,
    discountValue: bill.discountValue,
    discount: bill.discount,
    finalAmount: bill.finalAmount,
    generatedAt: bill.createdAt || new Date()
  });
}

async function hydrateBillReceipt(billId) {
  const populatedBill = await populateBill(billId);
  populatedBill.receiptText = buildReceiptText(populatedBill);
  await populatedBill.save();
  return populateBill(billId);
}

async function refreshBillSnapshotIfNeeded(billId) {
  const populatedBill = await populateBill(billId);
  const hasItems = Array.isArray(populatedBill.items) && populatedBill.items.length > 0;
  const hasBreakdown =
    Array.isArray(populatedBill.taxBreakdown) && populatedBill.taxBreakdown.length > 0;
  const needsRefresh =
    populatedBill.subtotal === undefined ||
    populatedBill.taxableAmount === undefined ||
    populatedBill.taxRate === undefined ||
    populatedBill.discountType === undefined ||
    populatedBill.discountValue === undefined ||
    !hasItems ||
    !hasBreakdown ||
    !populatedBill.receiptText;

  if (!needsRefresh) {
    return populatedBill;
  }

  const order =
    populatedBill.orderId && typeof populatedBill.orderId === "object"
      ? populatedBill.orderId
      : await populateOrder(populatedBill.orderId);
  const billingInput = billingService.normalizeBillingInput({
    taxRate: populatedBill.taxRate ?? env.defaultGstPercent,
    discountType: populatedBill.discountType,
    discountValue:
      populatedBill.discountValue !== undefined
        ? populatedBill.discountValue
        : populatedBill.discount,
    defaultTaxRate: env.defaultGstPercent
  });
  const summary = billingService.calculateBillSummary({
    items: order.items,
    taxRate: billingInput.taxRate,
    discountType: billingInput.discountType,
    discountValue: billingInput.discountValue
  });

  populatedBill.total = summary.total;
  populatedBill.subtotal = summary.subtotal;
  populatedBill.taxableAmount = summary.taxableAmount;
  populatedBill.taxRate = summary.taxRate;
  populatedBill.tax = summary.tax;
  populatedBill.taxBreakdown = summary.taxBreakdown;
  populatedBill.discountType = summary.discountType;
  populatedBill.discountValue = summary.discountValue;
  populatedBill.discount = summary.discount;
  populatedBill.finalAmount = summary.finalAmount;
  populatedBill.items = summary.items;
  populatedBill.receiptText = buildReceiptText(populatedBill);
  await populatedBill.save();

  return populateBill(billId);
}

async function populateBill(billId) {
  return Bill.findById(billId)
    .populate({
      path: "orderId",
      populate: [
        { path: "tableId", select: "tableNumber status" },
        { path: "waiterId", select: "name role" }
      ]
    })
    .populate("generatedBy", "name role");
}

async function populateOrder(orderId) {
  return Order.findById(orderId)
    .populate("tableId", "tableNumber status currentOrderId")
    .populate("waiterId", "name role restaurantId");
}

async function generateBill({ actor, payload }) {
  const { orderId } = payload;

  if (!mongoose.isValidObjectId(orderId)) {
    throw new AppError("A valid orderId is required.", 400);
  }

  const order = await Order.findOne({
    _id: orderId,
    restaurantId: actor.restaurantId
  });

  if (!order) {
    throw new AppError("Order not found.", 404);
  }

  const existingBill = await Bill.findOne({
    orderId: order.id,
    restaurantId: actor.restaurantId
  });

  if (existingBill) {
    return refreshBillSnapshotIfNeeded(existingBill.id);
  }

  const previousOrderSnapshot = await populateOrder(order.id);
  const previousTableSnapshot = await tableService.getTableById({
    restaurantId: actor.restaurantId,
    tableId: order.tableId
  });

  const billingInput = billingService.normalizeBillingInput({
    taxRate: payload.taxRate,
    discount: payload.discount,
    discountType: payload.discountType,
    discountValue: payload.discountValue,
    defaultTaxRate: env.defaultGstPercent
  });
  const summary = billingService.calculateBillSummary({
    items: order.items,
    taxRate: billingInput.taxRate,
    discountType: billingInput.discountType,
    discountValue: billingInput.discountValue
  });

  const bill = await Bill.create({
    restaurantId: actor.restaurantId,
    orderId: order.id,
    total: summary.total,
    subtotal: summary.subtotal,
    taxableAmount: summary.taxableAmount,
    taxRate: summary.taxRate,
    tax: summary.tax,
    taxBreakdown: summary.taxBreakdown,
    discountType: summary.discountType,
    discountValue: summary.discountValue,
    discount: summary.discount,
    finalAmount: summary.finalAmount,
    items: summary.items,
    generatedBy: actor.id
  });

  order.isLocked = true;
  order.lockedAt = new Date();
  await order.save();

  const updatedTable = await tableService.setTableStatus({
    tableId: order.tableId,
    restaurantId: actor.restaurantId,
    status: tableService.TABLE_STATUS.BILLING,
    currentOrderId: order.id
  });

  const populatedBill = await hydrateBillReceipt(bill.id);
  const updatedOrderSnapshot = await populateOrder(order.id);

  realtimeService.emitBillGenerated({
    restaurantId: actor.restaurantId,
    bill: populatedBill
  });
  realtimeService.emitOrderUpdated({
    restaurantId: actor.restaurantId,
    previousOrder: previousOrderSnapshot,
    order: updatedOrderSnapshot
  });
  realtimeService.emitTableUpdated({
    restaurantId: actor.restaurantId,
    previousTable: previousTableSnapshot,
    table: updatedTable
  });

  return populatedBill;
}

async function getBillById({ actor, billId }) {
  if (!mongoose.isValidObjectId(billId)) {
    throw new AppError("Invalid bill identifier.", 400);
  }

  const bill = await Bill.findOne({
    _id: billId,
    restaurantId: actor.restaurantId
  })
    .populate({
      path: "orderId",
      populate: [
        { path: "tableId", select: "tableNumber status" },
        { path: "waiterId", select: "name role" }
      ]
    })
    .populate("generatedBy", "name role");

  if (!bill) {
    throw new AppError("Bill not found.", 404);
  }

  return refreshBillSnapshotIfNeeded(bill.id);
}

module.exports = {
  generateBill,
  getBillById
};
