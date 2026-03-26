import express from "express";
import ChatController from "../controllers/chatController.js";
// Import đúng các hàm từ middleware của Huy
import { protect, restrictTo } from "../middlewares/authMiddleware.js"; 

const router = express.Router();

// --- NHÓM ROUTE CHO NGƯỜI DÙNG (USER) ---
// Yêu cầu: Chỉ cần đăng nhập (protect) là dùng được

// 1. Gửi tin nhắn và nhận phản hồi từ AI
// POST: /api/chat/message
router.post("/message", protect, ChatController.chatWithAI);

// 2. Lấy lịch sử của một phiên chat cụ thể
// GET: /api/chat/history/:sessionId
router.get("/history/:sessionId", protect, ChatController.getHistory);


// --- NHÓM ROUTE CHO QUẢN TRỊ (ADMIN/STAFF) ---
// Yêu cầu: Phải đăng nhập VÀ có role phù hợp

// 3. Ví dụ: Lấy danh sách các phiên chat đang chờ (Dành cho Admin hoặc Staff)
// GET: /api/chat/pending
router.get(
  "/pending", 
  protect, 
  restrictTo("admin", "staff"), 
  ChatController.getPendingSessions // Đảm bảo hàm này có trong Controller nếu bạn dùng
);

export default router;