import express from 'express';
import { login, logout, refreshToken } from '../controllers/authController.js';
import { protect } from '../middlewares/authMiddleware.js';
import { forgotPassword, verifyOtp, resetPassword } from '../controllers/authController.js';
const router = express.Router();

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Đăng nhập
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:    { type: string, example: user@example.com }
 *               password: { type: string, example: "123456" }
 *     responses:
 *       200:
 *         description: Đăng nhập thành công, trả về accessToken
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:      { type: string, example: success }
 *                 accessToken: { type: string }
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *       401:
 *         description: Email hoặc mật khẩu không đúng
 *       403:
 *         description: Tài khoản bị khoá
 */
router.post('/login', login);

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Đăng xuất
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Đăng xuất thành công
 *       401:
 *         description: Chưa đăng nhập
 */
router.post('/logout', protect, logout);

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: Lấy access token mới bằng refresh token (cookie)
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Trả về accessToken mới
 *       401:
 *         description: Refresh token không hợp lệ hoặc hết hạn
 */
router.post('/refresh', refreshToken);


//-------------------------------------------------- Dang test-----------------------------
/**
 * @swagger
 * /api/auth/forgot-password:
 *   post:
 *     summary: Gửi OTP về email để đặt lại mật khẩu
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string, example: user@example.com }
 *     responses:
 *       200:
 *         description: OTP đã được gửi (luôn 200 để tránh email enumeration)
 *       500:
 *         description: Lỗi máy chủ
 */
router.post('/forgot-password', forgotPassword);
 
/**
 * @swagger
 * /api/auth/verify-otp:
 *   post:
 *     summary: Xác thực mã OTP
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, otp]
 *             properties:
 *               email: { type: string, example: user@example.com }
 *               otp:   { type: string, example: "472819" }
 *     responses:
 *       200:
 *         description: OTP hợp lệ, trả về verifyToken
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:      { type: string, example: success }
 *                 verifyToken: { type: string }
 *       400:
 *         description: OTP sai hoặc hết hạn
 */
router.post('/verify-otp', verifyOtp);
 
/**
 * @swagger
 * /api/auth/reset-password:
 *   post:
 *     summary: Đặt lại mật khẩu bằng verifyToken từ bước xác thực OTP
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, verifyToken, newPassword]
 *             properties:
 *               email:       { type: string, example: user@example.com }
 *               verifyToken: { type: string }
 *               newPassword: { type: string, example: "NewPass@123" }
 *     responses:
 *       200:
 *         description: Đặt lại mật khẩu thành công
 *       400:
 *         description: Token không hợp lệ hoặc hết hạn
 */
router.post('/reset-password', resetPassword);

export default router;