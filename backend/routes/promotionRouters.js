import express from "express";
import PromotionController from "../controllers/promotionControllers.js";

const router = express.Router();

// Lấy các chương trình Flash Sale đang Active để hiện Banner ở Home
router.get("/flash-sales", PromotionController.getActiveFlashSales);

// Kiểm tra mã Code người dùng nhập ở trang Checkout
// POST /api/promotions/validate-code { "code": "GIAM20", "orderValue": 500000 }
router.post("/validate-code", PromotionController.validatePromoCode);

export default router;
