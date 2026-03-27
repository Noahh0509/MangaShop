import express from "express";
import ProductController from "../controllers/productControllers.js";

const router = express.Router();

//Lấy list sản phẩm cho thằng admin
router.get('/admin-all', ProductController.getAdminProducts);
router.get('/categories', ProductController.getCategories);

// ─── Public Routes ──────────────────────────────────────────────

// Lấy danh sách sản phẩm (có filter theo category, tags, search)
// GET /api/products?category=abc&sort=-createdAt
router.get("/", ProductController.getAllProducts);

// Lấy sản phẩm nổi bật (Featured)
// router.get("/featured", ProductController.getFeaturedProducts);

//tao sản phẩm mới (Admin)
router.post('/', ProductController.createProduct);
// Chi tiết sản phẩm qua Slug (Tốt cho SEO React)
// GET /api/products/samsung-galaxy-s24-ultra
// Cập nhật sản phẩm (Admin)
router.put('/:id', ProductController.updateProduct);
// Xóa sản phẩm (Admin)
router.delete('/:id', ProductController.deleteProduct);

router.get("/:slug", ProductController.getProductBySlug);


// ─── Admin Routes (Cần middleware auth/admin) ──────────────────

// Thêm mới sản phẩm
// router.post("/", ProductController.createProduct);

// Cập nhật kho hàng hoặc giá nhanh
// router.patch("/:id/stock", ProductController.updateStock);

export default router;
