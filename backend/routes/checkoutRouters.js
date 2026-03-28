import express from "express";
import {
  createOrder,
  momoCallback,
  checkMomoTransactionStatus,
} from "../controllers/checkoutController.js";
import { protect } from "../middlewares/authMiddleware.js";

const router = express.Router();

// TẠO ĐƠN HÀNG (Dành cho COD và khởi tạo MoMo)
router.post("/create-order", protect, createOrder);

// KIỂM TRA TRẠNG THÁI MOMO THỦ CÔNG TỪ FE
router.post("/momo/check-status", protect, checkMomoTransactionStatus);

// WEBHOOK MOMO CALLBACK (TUYỆT ĐỐI KHÔNG DÙNG middleware "protect" ở đây)
router.post("/momo/callback", momoCallback);

export default router;
