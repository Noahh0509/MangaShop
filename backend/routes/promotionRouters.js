import express from "express";
import { protect, restrictTo } from '../middlewares/authMiddleware.js';
import promotionController from "../controllers/promotionController.js";

const router = express.Router();

// ─── PHẦN CHO KHÁCH (PUBLIC/USER) ──────────────────────────

// 1. Lấy Flash Sale hiện trang chủ (Để trên cùng cho chắc)
router.get("/flash-sales", promotionController.getActiveFlashSales);

// 2. Kiểm tra mã Code lúc Checkout (Dùng 1 cái duy nhất cho gọn)
router.post("/validate-code", promotionController.validatePromoCode);


// ─── PHẦN CHO ADMIN (QUẢN TRỊ) ─────────────────────────────
// Sếp có thể thêm protect và restrictTo('admin') ở đây nếu cần bảo mật

// 3. Lấy tất cả KM cho bảng FE sếp vừa làm
router.get("/admin-all", promotionController.getAllPromotions);

// 4. Tạo mã mới
router.post("/", promotionController.createPromotion);

router.put("/:id", promotionController.updatePromotion);
router.delete("/:id", promotionController.deletePromotion);
// 5. Gạt công tắc Bật/Tắt
router.patch("/:id/toggle", promotionController.toggleStatus);

export default router;