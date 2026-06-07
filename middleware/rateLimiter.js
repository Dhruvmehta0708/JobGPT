import rateLimit from "express-rate-limit";

// ── Helper: shared formatter ───────────────────────────────────────────────────
const handler = (req, res) => {
  res.status(429).json({
    success: false,
    error:   "Too many requests. Please slow down and try again later.",
    retryAfter: res.getHeader("Retry-After"),
  });
};

// ── 1. General API limit — all routes ────────────────────────────────────────
// 100 requests per 15 minutes per IP
export const generalLimiter = rateLimit({
  windowMs:         15 * 60 * 1000,
  max:              100,
  standardHeaders:  true,
  legacyHeaders:    false,
  handler,
});

// ── 2. Fetch limiter — POST /fetch/:email ────────────────────────────────────
// Fetching jobs is expensive (3 APIs + N Groq calls).
// Allow max 5 fetches per hour per IP.
export const fetchLimiter = rateLimit({
  windowMs:         60 * 60 * 1000,
  max:              5,
  standardHeaders:  true,
  legacyHeaders:    false,
  message:          undefined,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error:   "Fetch limit reached. You can trigger a job fetch at most 5 times per hour.",
      retryAfter: res.getHeader("Retry-After"),
    });
  },
});

// ── 3. Register limiter — POST /register ────────────────────────────────────
// Prevent spam registrations: 10 per hour per IP
export const registerLimiter = rateLimit({
  windowMs:        60 * 60 * 1000,
  max:             10,
  standardHeaders: true,
  legacyHeaders:   false,
  handler,
});
