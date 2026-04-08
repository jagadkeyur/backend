const mongoose = require("mongoose");

const Item = require("../models/Item");
const AppError = require("../utils/app-error");

function normalizeItemPayload(payload) {
  const name = payload?.name?.trim();
  const category = payload?.category?.trim() || "General";
  const price = Number(payload?.price);
  const isActive =
    payload?.isActive === undefined ? true : Boolean(payload.isActive);

  if (!name) {
    throw new AppError("Item name is required.", 400);
  }

  if (!Number.isFinite(price) || price < 0) {
    throw new AppError("Item price must be a non-negative number.", 400);
  }

  return {
    name,
    category,
    price: Number(price.toFixed(2)),
    isActive
  };
}

async function listItems({ restaurantId, includeInactive = true }) {
  const filter = { restaurantId };

  if (!includeInactive) {
    filter.isActive = true;
  }

  return Item.find(filter).sort({ category: 1, name: 1 });
}

async function createItem({ actor, payload }) {
  const itemData = normalizeItemPayload(payload);

  return Item.create({
    restaurantId: actor.restaurantId,
    ...itemData
  });
}

async function updateItem({ actor, itemId, payload }) {
  if (!mongoose.isValidObjectId(itemId)) {
    throw new AppError("Invalid item identifier.", 400);
  }

  const item = await Item.findOne({
    _id: itemId,
    restaurantId: actor.restaurantId
  });

  if (!item) {
    throw new AppError("Item not found.", 404);
  }

  const nextValues = normalizeItemPayload({
    name: payload.name ?? item.name,
    category: payload.category ?? item.category,
    price: payload.price ?? item.price,
    isActive: payload.isActive ?? item.isActive
  });

  item.name = nextValues.name;
  item.category = nextValues.category;
  item.price = nextValues.price;
  item.isActive = nextValues.isActive;
  await item.save();

  return item;
}

module.exports = {
  listItems,
  createItem,
  updateItem
};
