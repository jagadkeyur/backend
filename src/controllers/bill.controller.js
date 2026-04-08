const asyncHandler = require("../middleware/async-handler");
const billService = require("../services/bill.service");

const generateBill = asyncHandler(async (req, res) => {
  const bill = await billService.generateBill({
    actor: req.user,
    payload: req.body
  });

  res.status(201).json({
    success: true,
    message: "Bill generated successfully",
    data: bill
  });
});

const getBill = asyncHandler(async (req, res) => {
  const bill = await billService.getBillById({
    actor: req.user,
    billId: req.params.id
  });

  res.status(200).json({
    success: true,
    data: bill
  });
});

module.exports = {
  generateBill,
  getBill
};
