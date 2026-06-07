/**
 * Lightweight request logger.
 * Logs method, path, status, and duration for every request.
 * In production you'd swap this for morgan / winston / pino.
 */
export function requestLogger(req, res, next) {
  const start = Date.now();

  res.on("finish", () => {
    const ms     = Date.now() - start;
    const status = res.statusCode;
    const color  =
      status >= 500 ? "\x1b[31m" : // red
      status >= 400 ? "\x1b[33m" : // yellow
      status >= 200 ? "\x1b[32m" : // green
      "\x1b[0m";

    console.log(
      `${color}${req.method}\x1b[0m ${req.originalUrl} → ${color}${status}\x1b[0m (${ms}ms)`
    );
  });

  next();
}
