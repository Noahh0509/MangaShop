import express from 'express';
import { protect, restrictTo } from "../middlewares/authMiddleware.js";
import { getAdminStats } from "../controllers/statsController.js"; 

const router = express.Router();

router.get("/summary", protect, restrictTo('admin', 'super_admin'), getAdminStats);
export default router;