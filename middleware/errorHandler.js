/**
 * Global Express error handler.
 * Must be registered LAST with app.use() in server.js.
 *
 * Distinguishes between:
 *  - AppError (operational, expected)  → use its status + message
 *  - Mongoose ValidationError          → 400 with field details
 *  - Mongoose duplicate key (11000)    → 409
 *  - Unknown errors                    → 500 (hide internals in production)
 */

export class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
  }
}

function handleMongooseValidation(err) {
  const messages = Object.values(err.errors).map((e) => e.message);
  return new AppError(`Validation failed: ${messages.join(". ")}`, 400);
}

function handleDuplicateKey(err) {
  const field = Object.keys(err.keyValue || {})[0] || "field";
  return new AppError(`Duplicate value for "${field}". Please use a different value.`, 409);
}

// eslint-disable-next-line no-unused-vars
export function globalErrorHandler(err, req, res, next) {
  let error = err;

  // Normalise known Mongoose errors into AppErrors
  if (err.name === "ValidationError") error = handleMongooseValidation(err);
  if (err.code === 11000)             error = handleDuplicateKey(err);

  // Operational / expected errors — safe to surface
  if (error.isOperational) {
    return res.status(error.statusCode).json({
      success: false,
      error:   error.message,
    });
  }

  // Unknown errors — log fully, hide internals from client
  console.error("💥 UNHANDLED ERROR:", err);
  return res.status(500).json({
    success: false,
    error:   process.env.NODE_ENV === "production"
      ? "Something went wrong. Please try again later."
      : err.message,
  });
}
