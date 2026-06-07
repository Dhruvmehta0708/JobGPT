import express from "express";
import { updateUserJob } from "../controllers/userJobController.js";

const router = express.Router();

router.post("/user-job/:jobId/:email", updateUserJob);

export default router;