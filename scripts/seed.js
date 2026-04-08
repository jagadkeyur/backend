const dotenv = require("dotenv");

dotenv.config();

const connectDatabase = require("../src/config/database");
const ROLES = require("../src/constants/roles");
const { ORDER_STATUS, TABLE_STATUS } = require("../src/constants/statuses");
const Bill = require("../src/models/Bill");
const Item = require("../src/models/Item");
const Order = require("../src/models/Order");
const Table = require("../src/models/Table");
const User = require("../src/models/User");
const billingService = require("../src/services/billing.service");

const restaurantId = "demo-restaurant";

const seedUsers = [
  {
    name: "System Admin",
    email: "admin@demo.com",
    password: "Admin@123",
    role: ROLES.ADMIN
  },
  {
    name: "Front Desk Cashier",
    email: "cashier@demo.com",
    password: "Cashier@123",
    role: ROLES.CASHIER
  },
  {
    name: "Floor Waiter",
    email: "waiter@demo.com",
    password: "Waiter@123",
    role: ROLES.WAITER
  }
];

const demoOrders = [
  {
    clientOrderId: "demo-order-table-1-active",
    tableNumber: 1,
    status: ORDER_STATUS.PREPARING,
    items: [
      { name: "Paneer Tikka", qty: 1, price: 240 },
      { name: "Butter Naan", qty: 4, price: 40 },
      { name: "Sweet Lime Soda", qty: 2, price: 90 }
    ]
  },
  {
    clientOrderId: "demo-order-table-2-served",
    tableNumber: 2,
    status: ORDER_STATUS.SERVED,
    items: [
      { name: "Veg Biryani", qty: 2, price: 220 },
      { name: "Raita", qty: 2, price: 60 }
    ]
  },
  {
    clientOrderId: "demo-order-table-3-billed",
    tableNumber: 3,
    status: ORDER_STATUS.READY,
    bill: {
      taxRate: 5,
      discountType: billingService.DISCOUNT_TYPES.PERCENTAGE,
      discountValue: 10
    },
    items: [
      { name: "Masala Dosa", qty: 2, price: 160 },
      { name: "Filter Coffee", qty: 2, price: 80 },
      { name: "Gulab Jamun", qty: 1, price: 110 }
    ]
  }
];

const seedItems = [
  { name: "Paneer Tikka", category: "Starters", price: 240 },
  { name: "Butter Naan", category: "Breads", price: 40 },
  { name: "Sweet Lime Soda", category: "Beverages", price: 90 },
  { name: "Veg Biryani", category: "Main Course", price: 220 },
  { name: "Raita", category: "Sides", price: 60 },
  { name: "Masala Dosa", category: "South Indian", price: 160 },
  { name: "Filter Coffee", category: "Beverages", price: 80 },
  { name: "Gulab Jamun", category: "Desserts", price: 110 },
  { name: "Tomato Soup", category: "Soups", price: 120 },
  { name: "Jeera Rice", category: "Main Course", price: 150 }
];

async function upsertUsers() {
  for (const userInput of seedUsers) {
    const existingUser = await User.findOne({ email: userInput.email });

    if (existingUser) {
      continue;
    }

    await User.create({
      ...userInput,
      restaurantId
    });
  }
}

async function upsertTables() {
  for (let tableNumber = 1; tableNumber <= 12; tableNumber += 1) {
    const existingTable = await Table.findOne({ restaurantId, tableNumber });

    if (existingTable) {
      continue;
    }

    await Table.create({
      restaurantId,
      tableNumber,
      status: TABLE_STATUS.EMPTY
    });
  }
}

async function upsertItems() {
  for (const itemInput of seedItems) {
    const existingItem = await Item.findOne({
      restaurantId,
      name: itemInput.name
    });

    if (existingItem) {
      continue;
    }

    await Item.create({
      restaurantId,
      ...itemInput
    });
  }
}

function calculateOrderTotal(items) {
  return billingService.roundMoney(
    items.reduce((sum, item) => sum + Number(item.qty) * Number(item.price), 0)
  );
}

function deriveDemoTableStatus(order) {
  if (order.isLocked) {
    return TABLE_STATUS.BILLING;
  }

  if (order.status === ORDER_STATUS.SERVED) {
    return TABLE_STATUS.SERVED;
  }

  return TABLE_STATUS.OCCUPIED;
}

async function ensureDemoBill({ cashier, order, table, waiter, billingConfig }) {
  let bill = await Bill.findOne({
    restaurantId,
    orderId: order.id
  });

  if (!bill) {
    const billingInput = billingService.normalizeBillingInput({
      taxRate: billingConfig?.taxRate,
      discountType: billingConfig?.discountType,
      discountValue: billingConfig?.discountValue
    });
    const summary = billingService.calculateBillSummary({
      items: order.items,
      taxRate: billingInput.taxRate,
      discountType: billingInput.discountType,
      discountValue: billingInput.discountValue
    });

    bill = await Bill.create({
      restaurantId,
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
      generatedBy: cashier.id
    });
  }

  bill.receiptText = billingService.buildPrintableReceipt({
    billId: bill.id,
    restaurantName: "Restaurant Billing",
    tableNumber: table.tableNumber,
    waiterName: waiter.name,
    items: bill.items,
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
  await bill.save();

  order.isLocked = true;
  order.lockedAt = order.lockedAt || new Date();
  await order.save();
}

async function upsertDemoOrdersAndBills() {
  const waiter = await User.findOne({ email: "waiter@demo.com", restaurantId });
  const cashier = await User.findOne({ email: "cashier@demo.com", restaurantId });

  if (!waiter || !cashier) {
    throw new Error("Demo waiter/cashier accounts must exist before seeding orders.");
  }

  for (const demoOrder of demoOrders) {
    const table = await Table.findOne({
      restaurantId,
      tableNumber: demoOrder.tableNumber
    });

    if (!table) {
      continue;
    }

    let order = await Order.findOne({
      restaurantId,
      clientOrderId: demoOrder.clientOrderId
    });

    if (!order) {
      order = await Order.create({
        restaurantId,
        clientOrderId: demoOrder.clientOrderId,
        tableId: table.id,
        items: demoOrder.items,
        status: demoOrder.status,
        total: calculateOrderTotal(demoOrder.items),
        waiterId: waiter.id,
        isLocked: Boolean(demoOrder.bill),
        lockedAt: demoOrder.bill ? new Date() : null
      });
    }

    if (demoOrder.bill) {
      await ensureDemoBill({
        cashier,
        order,
        table,
        waiter,
        billingConfig: demoOrder.bill
      });
      order = await Order.findById(order.id);
    }

    table.currentOrderId = order.id;
    table.status = deriveDemoTableStatus(order);
    await table.save();
  }
}

async function seed() {
  await connectDatabase();
  await upsertUsers();
  await upsertTables();
  await upsertItems();
  await upsertDemoOrdersAndBills();

  console.log("Seed completed for demo-restaurant");
  console.log("Admin: admin@demo.com / Admin@123");
  console.log("Cashier: cashier@demo.com / Cashier@123");
  console.log("Waiter: waiter@demo.com / Waiter@123");
  console.log("Demo tables: 1 active, 2 served, 3 billed");
  console.log(`Demo items: ${seedItems.length}`);
  process.exit(0);
}

seed().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
