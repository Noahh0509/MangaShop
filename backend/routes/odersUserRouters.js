import express from "express";
import {
  getMyOrders,
  confirmReceivedOrder,
  rejectOrder,
} from "../controllers/odersUser.js";
import { protect } from "../middlewares/authMiddleware.js";

const router = express.Router();

//Lấy danh sách đơn hàng của user
router.get("/my-orders", protect, getMyOrders);

//Xác nhận đã nhận hàng
router.put("/confirm/:invoiceCode", protect, confirmReceivedOrder);

//Từ chối nhận hàng
router.put("/reject/:invoiceCode", protect, rejectOrder);

export default router;