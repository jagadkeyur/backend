function toId(value) {
  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    return value;
  }

  return value.id || value._id || null;
}

function toIsoDate(value) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "string") {
    return value;
  }

  return null;
}

function normalizeOrderItems(items = []) {
  return items.map((item) => ({
    name: item.name,
    qty: Number(item.qty || 0),
    price: Number(item.price || 0),
    lineTotal:
      item.lineTotal === undefined ? Number(item.qty || 0) * Number(item.price || 0) : Number(item.lineTotal || 0)
  }));
}

function normalizeTableRealtime(table) {
  return {
    id: toId(table),
    tableNumber: Number(table.tableNumber || 0),
    status: table.status || "empty",
    currentOrderId: toId(table.currentOrderId),
    updatedAt: toIsoDate(table.updatedAt)
  };
}

function normalizeOrderRealtime(order) {
  const table =
    order.tableId && typeof order.tableId === "object" ? order.tableId : null;
  const waiter =
    order.waiterId && typeof order.waiterId === "object" ? order.waiterId : null;
  const items = normalizeOrderItems(order.items);

  return {
    id: toId(order),
    tableId: toId(order.tableId),
    tableNumber: table?.tableNumber ?? order.tableNumber ?? null,
    waiterId: toId(order.waiterId),
    waiterName: waiter?.name || order.waiterName || "Waiter",
    status: order.status || "preparing",
    items,
    itemCount: items.length,
    total: Number(order.total || 0),
    isLocked: Boolean(order.isLocked),
    createdAt: toIsoDate(order.createdAt),
    updatedAt: toIsoDate(order.updatedAt),
    lockedAt: toIsoDate(order.lockedAt)
  };
}

function normalizeBillRealtime(bill) {
  const relatedOrder =
    bill.orderId && typeof bill.orderId === "object"
      ? normalizeOrderRealtime(bill.orderId)
      : null;
  const generatedBy =
    bill.generatedBy && typeof bill.generatedBy === "object"
      ? bill.generatedBy.name
      : bill.generatedByName || null;

  return {
    id: toId(bill),
    orderId: relatedOrder?.id || toId(bill.orderId),
    tableId: relatedOrder?.tableId || toId(bill.tableId),
    tableNumber: relatedOrder?.tableNumber || bill.tableNumber || null,
    subtotal: Number(bill.subtotal || bill.total || 0),
    total: Number(bill.total || 0),
    taxableAmount: Number(bill.taxableAmount || 0),
    taxRate: Number(bill.taxRate || 0),
    tax: Number(bill.tax || 0),
    taxBreakdown: Array.isArray(bill.taxBreakdown)
      ? bill.taxBreakdown.map((entry) => ({
          label: entry.label || "GST",
          rate: Number(entry.rate || 0),
          taxableAmount: Number(entry.taxableAmount || 0),
          amount: Number(entry.amount || 0)
        }))
      : [],
    discountType: bill.discountType || "flat",
    discountValue: Number(bill.discountValue || 0),
    discount: Number(bill.discount || 0),
    finalAmount: Number(bill.finalAmount || 0),
    items: normalizeOrderItems(bill.items),
    receiptText: bill.receiptText || null,
    generatedBy,
    createdAt: toIsoDate(bill.createdAt),
    order: relatedOrder
  };
}

function areEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function buildPatch(previousValue, nextValue, fields) {
  const patch = {};

  for (const field of fields) {
    if (!areEqual(previousValue[field], nextValue[field])) {
      patch[field] = nextValue[field];
    }
  }

  return patch;
}

function buildOrderCreatedData(order) {
  return {
    order: normalizeOrderRealtime(order)
  };
}

function buildOrderUpdatedData(previousOrder, nextOrder) {
  const previous = normalizeOrderRealtime(previousOrder);
  const current = normalizeOrderRealtime(nextOrder);
  const patch = buildPatch(previous, current, [
    "tableId",
    "tableNumber",
    "status",
    "items",
    "itemCount",
    "total",
    "isLocked",
    "lockedAt",
    "updatedAt"
  ]);

  return {
    patch,
    changedFields: Object.keys(patch)
  };
}

function buildTableUpdatedData(previousTable, nextTable) {
  const previous = normalizeTableRealtime(previousTable);
  const current = normalizeTableRealtime(nextTable);
  const patch = buildPatch(previous, current, [
    "status",
    "currentOrderId",
    "updatedAt"
  ]);

  return {
    patch,
    changedFields: Object.keys(patch)
  };
}

function buildBillGeneratedData(bill) {
  return {
    bill: normalizeBillRealtime(bill)
  };
}

module.exports = {
  buildBillGeneratedData,
  buildOrderCreatedData,
  buildOrderUpdatedData,
  buildTableUpdatedData,
  normalizeBillRealtime,
  normalizeOrderRealtime,
  normalizeTableRealtime
};
