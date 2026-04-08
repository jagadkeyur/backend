function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`
  });
}

function errorHandler(error, _req, res, _next) {
  if (error.name === "CastError") {
    return res.status(400).json({
      success: false,
      message: "Invalid resource identifier."
    });
  }

  if (error.code === 11000) {
    const field = Object.keys(error.keyPattern || {})[0] || "field";
    return res.status(409).json({
      success: false,
      message: `${field} already exists.`
    });
  }

  const statusCode = error.statusCode || 500;
  const message =
    error.message || "Something went wrong while processing the request.";

  return res.status(statusCode).json({
    success: false,
    message
  });
}

module.exports = {
  notFoundHandler,
  errorHandler
};
