import express from "express";
import invoiceController from "../controllers/invoiceController.js";
import { protect, restrictTo } from "../middlewares/authMiddleware.js";

const router = express.Router();

// Chỉ Admin mới được sờ vào mấy cái này nhen sếp Tuan
router.use(protect, restrictTo("admin"));

router.get("/pending", invoiceController.getPendingInvoices);
router.get("/:id", invoiceController.getInvoiceDetail);
router.patch("/:id/status", invoiceController.updateOrderStatus);
router.patch("/:id/cancel", invoiceController.cancelOrder);

export default router;