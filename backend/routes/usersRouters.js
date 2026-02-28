import express from 'express';
import {
    registerUser,
    registerAdmin,
    getAllUsers,
    getUserById,
    updateUserByAdmin,
    deleteUser,
    toggleActiveUser,
    getMe,
    updateMe,
    changePassword,
} from '../controllers/usersControllers.js';
import { protect, restrictTo } from '../middlewares/authMiddleware.js';

const router = express.Router();

/**
 * @swagger
 * /api/users/register:
 *   post:
 *     summary: Đăng ký tài khoản khách hàng
 *     tags: [Users - Public]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [username, email, password]
 *             properties:
 *               username: { type: string, example: nguyenvana }
 *               email:    { type: string, example: user@example.com }
 *               password: { type: string, example: "123456" }
 *               fullName: { type: string, example: Nguyen Van A }
 *               phone:    { type: string, example: "0901234567" }
 *     responses:
 *       200:
 *         description: Dang ky thanh cong
 *       400:
 *         description: Email hoac username da ton tai
 */
router.post('/register', registerUser);

router.use(protect);

/**
 * @swagger
 * /api/users/me:
 *   get:
 *     summary: Lay thong tin ban than
 *     tags: [Users - Me]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Thanh cong
 *       401:
 *         description: Chua dang nhap
 */
router.get('/me', getMe);

/**
 * @swagger
 * /api/users/me:
 *   patch:
 *     summary: Cap nhat thong tin ca nhan
 *     tags: [Users - Me]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fullName: { type: string }
 *               phone:    { type: string }
 *               avatar:   { type: string }
 *     responses:
 *       200:
 *         description: Cap nhat thanh cong
 */
router.patch('/me', updateMe);

/**
 * @swagger
 * /api/users/me/change-password:
 *   patch:
 *     summary: Doi mat khau
 *     tags: [Users - Me]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [currentPassword, newPassword]
 *             properties:
 *               currentPassword: { type: string, example: "oldpass123" }
 *               newPassword:     { type: string, example: "newpass456" }
 *     responses:
 *       200:
 *         description: Doi mat khau thanh cong
 *       401:
 *         description: Mat khau hien tai khong dung
 */
router.patch('/me/change-password', changePassword);

/**
 * @swagger
 * /api/users/admin/register:
 *   post:
 *     summary: Tao tai khoan admin moi (can setupKey)
 *     tags: [Users - Admin]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [setupKey, username, email, password]
 *             properties:
 *               setupKey: { type: string, example: supersecretkey123 }
 *               username: { type: string, example: admin01 }
 *               email:    { type: string, example: admin@mangashop.com }
 *               password: { type: string, example: "Admin@123" }
 *     responses:
 *       200:
 *         description: Tao admin thanh cong
 *       403:
 *         description: Sai setupKey hoac tinh nang da bi tat
 */
router.post('/admin/register', registerAdmin);

/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: Lay danh sach tat ca users
 *     tags: [Users - Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Danh sach users
 *       403:
 *         description: Khong co quyen admin
 */
router.get('/', restrictTo('admin'), getAllUsers);

/**
 * @swagger
 * /api/users/{id}:
 *   get:
 *     summary: Lay thong tin 1 user theo ID
 *     tags: [Users - Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Thanh cong
 *       404:
 *         description: Khong tim thay user
 */
router.get('/:id', restrictTo('admin'), getUserById);

/**
 * @swagger
 * /api/users/{id}:
 *   patch:
 *     summary: Cap nhat thong tin user (admin)
 *     tags: [Users - Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Cap nhat thanh cong
 */
router.patch('/:id', restrictTo('admin'), updateUserByAdmin);

/**
 * @swagger
 * /api/users/{id}/toggle-active:
 *   patch:
 *     summary: Khoa / mo khoa tai khoan
 *     tags: [Users - Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Thay doi trang thai thanh cong
 */
router.patch('/:id/toggle-active', restrictTo('admin'), toggleActiveUser);

/**
 * @swagger
 * /api/users/{id}:
 *   delete:
 *     summary: Xoa user
 *     tags: [Users - Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Xoa thanh cong
 *       404:
 *         description: Khong tim thay user
 */
router.delete('/:id', restrictTo('admin'), deleteUser);

export default router;