import { Router }       from "express";
import { getAnalytics } from "../controllers/analyticsController.js";

const router = Router();

router.get("/analytics", getAnalytics);

export default router;
