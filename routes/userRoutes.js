import { Router }           from "express";
import { registerLimiter }  from "../middleware/rateLimiter.js";
import { registerUser }     from "../controllers/userController.js";

const router = Router();

router.post("/register", registerLimiter, registerUser);

export default router;
