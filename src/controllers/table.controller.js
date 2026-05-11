const asyncHandler = require("../middleware/async-handler");
const orderService = require("../services/order.service");
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

const mergeTables = asyncHandler(async (req, res) => {
  const result = await orderService.mergeTableOrders({
    actor: req.user,
    sourceTableId: req.body.sourceTableId,
    targetTableId: req.body.targetTableId
  });

  res.status(200).json({
    success: true,
    message: `Table ${result.sourceTable.tableNumber} merged into Table ${result.targetTable.tableNumber}`,
    data: result
  });
});

module.exports = {
  getTables,
  releaseTable,
  mergeTables
};
