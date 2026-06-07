import express from "express";
import {
  getJobs,
  getJobById,
  deleteJobs,
  resetMemory,
  triggerFetch
} from "../controllers/jobController.js";
import { fetchLimiter } from "../middleware/rateLimiter.js";

const router = express.Router();

router.get("/jobs/:email/job/:jobId", getJobById);
router.get("/jobs/:email", getJobs);
router.post("/fetch/:email", fetchLimiter, triggerFetch);
router.get("/fetch/:email", fetchLimiter, triggerFetch); // backward compatibility
router.delete("/jobs/:email", deleteJobs);
router.post("/reset-memory", resetMemory);

export default router;