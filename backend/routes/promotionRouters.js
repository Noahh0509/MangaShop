import express from "express";
<<<<<<< HEAD
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

// 5. Gạt công tắc Bật/Tắt
router.patch("/:id/toggle", promotionController.toggleStatus);
=======
import PromotionController from "../controllers/promotionControllers.js"; 

const router = express.Router();

// ... các dòng bên dưới giữ nguyên

// 1. Dùng cho khách hàng: Kiểm tra mã giảm giá ở Giỏ hàng / Checkout
// Dùng method POST vì cần gửi data (code, orderValue...) lên trong req.body
router.post("/validate", PromotionController.validatePromoCode);

// 2. Dùng cho khách hàng: Lấy danh sách Flash Sale hiện ở trang chủ
// Dùng method GET vì chỉ lấy dữ liệu về
router.get("/flash-sales", PromotionController.getActiveFlashSales);

// 3. Dùng cho Admin: Tạo chương trình khuyến mãi mới VÀ đồng bộ giá
router.post("/", PromotionController.createPromotion);

// 4. Dùng cho Admin: Dừng khuyến mãi khẩn cấp / Hết hạn VÀ khôi phục giá gốc
// Dùng method PUT hoặc PATCH vì hành động này là cập nhật trạng thái
router.put("/:id/stop", PromotionController.stopPromotion);
>>>>>>> 20c18eefeab42341705acc2e762b9e3964b7c325

export default router;