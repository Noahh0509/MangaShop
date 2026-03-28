import express from "express";
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

export default router;