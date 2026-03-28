import express from 'express';
import { chatWithAI } from '../controllers/chatController.js';
import { protect, restrictTo } from '../middlewares/authMiddleware.js'; // Đường dẫn tùy file của Huy
import ChatSession from '../models/Chat.js';

const router = express.Router();

// Tất cả các route chat đều yêu cầu đăng nhập
router.use(protect);

// ===================================================================
// 1. ROUTE DÀNH CHO NGƯỜI DÙNG & BOT AI
// ===================================================================

/**
 * @route   POST /api/chat/bot
 * @desc    Gửi tin nhắn và trò chuyện với MangaExpert AI
 * @access  Private (User/Staff/Admin đều dùng được để test AI)
 */
router.post('/bot', chatWithAI);

/**
 * @route   GET /api/chat/history
 * @desc    Lấy lịch sử các phiên chat của user đang đăng nhập
 * @access  Private
 */
router.get('/history', async (req, res) => {
    try {
        // Sử dụng hàm statics Huy đã viết trong Model
        const history = await ChatSession.getHistoryByUser(req.user._id, 10);
        res.status(200).json({ success: true, data: history });
    } catch (error) {
        res.status(500).json({ message: 'Lỗi khi lấy lịch sử chat.' });
    }
});


// ===================================================================
// 2. ROUTE NGHIỆP VỤ DÀNH RIÊNG CHO STAFF / ADMIN
// ===================================================================

/**
 * @route   GET /api/chat/pending
 * @desc    Lấy danh sách các phiên chat AI đã chuyển sang cần người thật hỗ trợ
 * @access  Private/Staff, Admin
 */
router.get('/pending', restrictTo('staff', 'admin'), async (req, res) => {
    try {
        // Sử dụng hàm statics lấy session PENDING
        const pendingSessions = await ChatSession.getPendingSessions();
        res.status(200).json({ 
            success: true, 
            count: pendingSessions.length,
            data: pendingSessions 
        });
    } catch (error) {
        res.status(500).json({ message: 'Lỗi khi lấy danh sách chờ.' });
    }
});

/**
 * @route   PATCH /api/chat/:sessionId/take
 * @desc    Nhân viên nhận xử lý một phiên chat đang PENDING
 * @access  Private/Staff, Admin
 */
router.patch('/:sessionId/take', restrictTo('staff', 'admin'), async (req, res) => {
    try {
        const session = await ChatSession.findById(req.params.sessionId);
        
        if (!session) return res.status(404).json({ message: 'Không tìm thấy phiên chat.' });
        if (session.status !== 'PENDING') return res.status(400).json({ message: 'Phiên chat này không ở trạng thái chờ.' });

        // Cập nhật người phụ trách và đổi trạng thái
        session.assignedStaff = req.user._id;
        session.status = 'ACTIVE';
        await session.save();

        res.status(200).json({ success: true, message: 'Đã nhận phiên chat thành công.' });
    } catch (error) {
        res.status(500).json({ message: 'Lỗi khi nhận ca.' });
    }
});

export default router;