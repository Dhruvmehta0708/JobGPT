import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import cron from "node-cron";
import pLimit from "p-limit";

import { validateEnv }        from "./middleware/validateEnv.js";
import { requestLogger }      from "./middleware/requestLogger.js";
import { globalErrorHandler } from "./middleware/errorHandler.js";
import { generalLimiter }     from "./middleware/rateLimiter.js";
import { connectDB }          from "./config/db.js";
import userRoutes             from "./routes/userRoutes.js";
import jobRoutes              from "./routes/jobRoutes.js";
import analyticsRoutes        from "./routes/analyticsRoutes.js";
import userJobRoutes          from "./routes/userJobRoutes.js";
import smartJobsRoutes        from "./routes/jobs.route.js";
import User                   from "./models/User.js";
import { runAgentForUser }    from "./services/agentService.js";
import { sendDigest }         from "./services/emailService.js";

// ─── Validate env ─────────────────────────────────────────────────────────────
validateEnv();

// ─── DB ───────────────────────────────────────────────────────────────────────
await connectDB();

// ─── App ──────────────────────────────────────────────────────────────────────
const app  = express();
const PORT = process.env.PORT || 5000;

// ✅ FIXED: Middleware FIRST, then routes
app.use(cors());
app.use(express.json());        // ✅ Must be before routes
app.use(requestLogger);
app.use(generalLimiter);

// ─── Health check ─────────────────────────────────────────────────────────────
app.get("/", (req, res) => res.json({ status: "Job Agent running 🚀" }));

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use(userRoutes);
app.use(jobRoutes);
app.use("/api/jobs", smartJobsRoutes);
app.use(analyticsRoutes);
app.use("/api/user-jobs", userJobRoutes);
app.use(userJobRoutes);

// ─── 404 handler ─────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, error: `Route ${req.originalUrl} not found` });
});

// ─── Global error handler ─────────────────────────────────────────────────────
app.use(globalErrorHandler);

// ─── Cron: every 6 hours ─────────────────────────────────────────────────────
const cronLimit = pLimit(3);

cron.schedule("0 */6 * * *", async () => {
  console.log("\n⏰ Cron started...");
  try {
    const users = await User.find().lean();
    console.log(`👥 Processing ${users.length} users (max 3 concurrent)`);

    await Promise.all(
      users.map((user) =>
        cronLimit(async () => {
          try {
            const saved = await runAgentForUser(user);
            await sendDigest(user, saved);
          } catch (err) {
            console.error(`❌ Cron failed for ${user.email}:`, err.message);
          }
        })
      )
    );

    console.log("✅ Cron complete.\n");
  } catch (err) {
    console.error("Cron error:", err.message);
  }
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));