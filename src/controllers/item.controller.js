const asyncHandler = require("../middleware/async-handler");
const itemService = require("../services/item.service");

const getItems = asyncHandler(async (req, res) => {
  const includeInactive = req.query.includeInactive !== "false";
  const items = await itemService.listItems({
    restaurantId: req.user.restaurantId,
    includeInactive
  });

  res.status(200).json({
    success: true,
    data: items
  });
});

const createItem = asyncHandler(async (req, res) => {
  const item = await itemService.createItem({
    actor: req.user,
    payload: req.body
  });

  res.status(201).json({
    success: true,
    message: "Item created successfully",
    data: item
  });
});

const updateItem = asyncHandler(async (req, res) => {
  const item = await itemService.updateItem({
    actor: req.user,
    itemId: req.params.id,
    payload: req.body
  });

  res.status(200).json({
    success: true,
    message: "Item updated successfully",
    data: item
  });
});

module.exports = {
  getItems,
  createItem,
  updateItem
};
