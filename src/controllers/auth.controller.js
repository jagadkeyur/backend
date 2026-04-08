const asyncHandler = require("../middleware/async-handler");
const authService = require("../services/auth.service");

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const result = await authService.login({ email, password });

  res.status(200).json({
    success: true,
    message: "Login successful",
    data: result
  });
});

module.exports = {
  login
};
