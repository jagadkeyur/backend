const AppError = require("../utils/app-error");
const { DISCOUNT_TYPES } = require("../constants/billing");

function roundMoney(value) {
  return Number(Number(value || 0).toFixed(2));
}

function padReceipt(label, value, width = 40) {
  const safeLabel = String(label || "");
  const safeValue = String(value || "");
  const available = Math.max(width - safeValue.length, 1);
  return `${safeLabel.slice(0, available).padEnd(available, " ")}${safeValue}`;
}

function buildDivider(width = 40) {
  return "-".repeat(width);
}

function buildBillItems(items = []) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new AppError("At least one bill item is required.", 400);
  }

  return items.map((item, index) => {
    const name = item?.name?.trim();
    const qty = Number(item?.qty);
    const price = Number(item?.price);

    if (!name) {
      throw new AppError(`Bill item ${index + 1} is missing a name.`, 400);
    }

    if (!Number.isFinite(qty) || qty <= 0) {
      throw new AppError(`Bill item ${name} has an invalid quantity.`, 400);
    }

    if (!Number.isFinite(price) || price < 0) {
      throw new AppError(`Bill item ${name} has an invalid price.`, 400);
    }

    return {
      name,
      qty,
      price: roundMoney(price),
      lineTotal: roundMoney(qty * price)
    };
  });
}

function normalizeBillingInput({
  taxRate,
  discount,
  discountType,
  discountValue,
  defaultTaxRate = 0
}) {
  const resolvedTaxRate =
    taxRate === undefined || taxRate === null ? Number(defaultTaxRate) : Number(taxRate);
  const rawDiscountType = String(discountType || DISCOUNT_TYPES.FLAT).trim().toLowerCase();
  const resolvedDiscountValue =
    discountValue !== undefined ? Number(discountValue) : Number(discount || 0);

  if (!Number.isFinite(resolvedTaxRate) || resolvedTaxRate < 0) {
    throw new AppError("Tax rate must be a non-negative number.", 400);
  }

  if (!Object.values(DISCOUNT_TYPES).includes(rawDiscountType)) {
    throw new AppError("Discount type must be either flat or percentage.", 400);
  }

  if (!Number.isFinite(resolvedDiscountValue) || resolvedDiscountValue < 0) {
    throw new AppError("Discount value must be a non-negative number.", 400);
  }

  if (
    rawDiscountType === DISCOUNT_TYPES.PERCENTAGE &&
    resolvedDiscountValue > 100
  ) {
    throw new AppError("Percentage discount cannot exceed 100.", 400);
  }

  return {
    taxRate: roundMoney(resolvedTaxRate),
    discountType: rawDiscountType,
    discountValue: roundMoney(resolvedDiscountValue)
  };
}

function calculateDiscountAmount({ subtotal, discountType, discountValue }) {
  if (discountType === DISCOUNT_TYPES.PERCENTAGE) {
    return roundMoney((subtotal * discountValue) / 100);
  }

  return roundMoney(discountValue);
}

function calculateBillSummary({ items, taxRate, discountType, discountValue }) {
  const normalizedItems = buildBillItems(items);
  const subtotal = roundMoney(
    normalizedItems.reduce((sum, item) => sum + item.lineTotal, 0)
  );
  const rawDiscountAmount = calculateDiscountAmount({
    subtotal,
    discountType,
    discountValue
  });
  const discountAmount = roundMoney(Math.min(rawDiscountAmount, subtotal));
  const taxableAmount = roundMoney(Math.max(subtotal - discountAmount, 0));
  const taxAmount = roundMoney((taxableAmount * taxRate) / 100);
  const finalAmount = roundMoney(taxableAmount + taxAmount);
  const taxBreakdown = [
    {
      label: "GST",
      rate: roundMoney(taxRate),
      taxableAmount,
      amount: taxAmount
    }
  ];

  return {
    items: normalizedItems,
    subtotal,
    total: subtotal,
    taxableAmount,
    taxRate: roundMoney(taxRate),
    tax: taxAmount,
    taxBreakdown,
    discountType,
    discountValue: roundMoney(discountValue),
    discount: discountAmount,
    finalAmount
  };
}

function buildPrintableReceipt({
  billId,
  restaurantName = "Restaurant Billing",
  tableNumber,
  waiterName,
  items = [],
  subtotal,
  taxableAmount,
  taxRate,
  tax,
  discountType,
  discountValue,
  discount,
  finalAmount,
  generatedAt
}) {
  const lines = [
    restaurantName,
    "Guest Receipt",
    buildDivider()
  ];

  if (billId) {
    lines.push(`Bill: ${billId}`);
  }

  if (generatedAt) {
    lines.push(`Generated: ${new Date(generatedAt).toLocaleString("en-IN")}`);
  }

  if (tableNumber) {
    lines.push(`Table: ${tableNumber}`);
  }

  if (waiterName) {
    lines.push(`Waiter: ${waiterName}`);
  }

  lines.push(buildDivider());
  lines.push("Items");

  for (const item of items) {
    lines.push(item.name);
    lines.push(
      padReceipt(`${item.qty} x ${item.price.toFixed(2)}`, item.lineTotal.toFixed(2))
    );
  }

  lines.push(buildDivider());
  lines.push(padReceipt("Subtotal", roundMoney(subtotal).toFixed(2)));

  if (discount > 0) {
    const discountLabel =
      discountType === DISCOUNT_TYPES.PERCENTAGE
        ? `Discount (${roundMoney(discountValue)}%)`
        : "Discount";
    lines.push(padReceipt(discountLabel, `- ${roundMoney(discount).toFixed(2)}`));
  }

  lines.push(padReceipt("Taxable Total", roundMoney(taxableAmount).toFixed(2)));
  lines.push(
    padReceipt(`GST (${roundMoney(taxRate)}%)`, roundMoney(tax).toFixed(2))
  );
  lines.push(buildDivider());
  lines.push(padReceipt("Grand Total", roundMoney(finalAmount).toFixed(2)));
  lines.push(buildDivider());
  lines.push("Thank you for dining with us.");

  return lines.join("\n");
}

module.exports = {
  DISCOUNT_TYPES,
  buildBillItems,
  buildPrintableReceipt,
  calculateBillSummary,
  normalizeBillingInput,
  roundMoney
};
