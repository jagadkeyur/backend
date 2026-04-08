const asyncHandler = require("../middleware/async-handler");
const tableService = require("../services/table.service");

const getTables = asyncHandler(async (req, res) => {
  const tables = await tableService.listTables(req.user.restaurantId);

  res.status(200).json({
    success: true,
    data: tables
  });
});

const releaseTable = asyncHandler(async (req, res) => {
  const table = await tableService.releaseTable({
    actor: req.user,
    tableId: req.params.id
  });

  res.status(200).json({
    success: true,
    message: `Table ${table.tableNumber} released successfully`,
    data: table
  });
});

module.exports = {
  getTables,
  releaseTable
};
