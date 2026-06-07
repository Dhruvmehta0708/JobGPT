/**
 * Wraps an async route handler and forwards any thrown errors to Express's
 * next(err) pipeline — eliminates try/catch boilerplate in every controller.
 *
 * Usage:
 *   router.get("/path", catchAsync(myController));
 */
export const catchAsync = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
