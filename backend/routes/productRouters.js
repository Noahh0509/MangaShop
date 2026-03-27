import express from "express";
import ProductController from "../controllers/productControllers.js";

const router = express.Router();

//Lấy list sản phẩm cho thằng admin
router.get('/admin-all', ProductController.getAdminProducts);

// ─── Public Routes ──────────────────────────────────────────────

// Lấy danh sách sản phẩm (có filter theo category, tags, search)
// GET /api/products?category=abc&sort=-createdAt
router.get("/", ProductController.getAllProducts);

// Lấy sản phẩm nổi bật (Featured)
// router.get("/featured", ProductController.getFeaturedProducts);

// Chi tiết sản phẩm qua Slug (Tốt cho SEO React)
// GET /api/products/samsung-galaxy-s24-ultra
router.get("/:slug", ProductController.getProductBySlug);


// ─── Admin Routes (Cần middleware auth/admin) ──────────────────

// Thêm mới sản phẩm
// router.post("/", ProductController.createProduct);

// Cập nhật kho hàng hoặc giá nhanh
// router.patch("/:id/stock", ProductController.updateStock);

export default router;
