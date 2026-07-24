// Central error handler. Any `next(err)` call in a route/controller ends up
// here. Keeping this in one place means every endpoint returns errors in the
// same { success, message } shape.
module.exports = function errorHandler(err, req, res, next) {
  console.error("❌", err);

  // Friendlier messages for common MySQL error codes.
  if (err.code === "ER_DUP_ENTRY") {
    return res.status(409).json({
      success: false,
      message: "A record with that unique value already exists (e.g. duplicate product code).",
    });
  }

  if (err.code === "ER_ROW_IS_REFERENCED_2" || err.code === "ER_ROW_IS_REFERENCED") {
    return res.status(409).json({
      success: false,
      message: "This record cannot be deleted because it is referenced by other data.",
    });
  }

  if (err.code === "ER_NO_REFERENCED_ROW_2" || err.code === "ER_NO_REFERENCED_ROW") {
    return res.status(400).json({
      success: false,
      message: "Referenced record does not exist (check category_id or other foreign keys).",
    });
  }

  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    message: err.sqlMessage || err.message || "Internal server error",
  });
};
