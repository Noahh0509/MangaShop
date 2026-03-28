import express from "express";
import ProductController from "../controllers/productControllers.js";

const router = express.Router();

// ─── 1. Admin Routes (Cố định - Ưu tiên cao nhất) ──────────────────
router.get("/admin-all", ProductController.getAdminProducts);
router.get("/categories", ProductController.getCategories);

// 🎯 Group Khuyến mãi (Đưa cái ALL lên trên cái :productId)
router.patch("/apply-promotion-all", ProductController.applyPromotionToAll);
router.patch("/:productId/apply-promotion", ProductController.applyPromotion);

// ─── 2. Public Routes (Danh sách) ──────────────────────────────────
router.get("/", ProductController.getAllProducts);

// ─── 3. Admin CRUD (Tạo, Sửa, Xóa) ──────────────────────────────────
router.post("/", ProductController.createProduct);
router.put("/:id", ProductController.updateProduct);
router.delete("/:id", ProductController.deleteProduct);

// ─── 4. Detail Routes (Biến số - Luôn để dưới cùng) ────────────────
// 🚨 Lưu ý: Nếu sếp để /:slug lên trên /admin-all,
// thì khi gọi /admin-all nó sẽ tưởng "admin-all" là cái slug đó!
router.get("/:slug", ProductController.getProductBySlug);

export default router;
