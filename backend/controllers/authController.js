import User from '../models/User.js';

import crypto from 'crypto';
import sendEmail from '../utils/sendEmail.js';
import { otpEmailTemplate } from '../utils/emailTemplates.js';

// ─── Đăng nhập ──────────────────────────────────────────────────
export const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: 'Vui lòng nhập email và mật khẩu.' });
        }

        // Tìm user + lấy password (vì mặc định bị ẩn)
        const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+password');
        if (!user) {
            return res.status(401).json({ message: 'Email hoặc mật khẩu không đúng.' });
        }

        // Kiểm tra tài khoản bị khoá
        if (!user.isActive) {
            return res.status(403).json({ message: 'Tài khoản đã bị khoá. Vui lòng liên hệ admin.' });
        }

        // Kiểm tra mật khẩu
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Email hoặc mật khẩu không đúng.' });
        }

        // Tạo tokens
        const accessToken  = user.generateAccessToken();
        const refreshToken = await user.generateRefreshToken();

        // Cập nhật lastLoginAt
        user.lastLoginAt = new Date();
        await user.save({ validateBeforeSave: false });

        // Gửi refresh token qua cookie (httpOnly)
        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 ngày
        });

        res.status(200).json({
            status: 'success',
            accessToken,
            data: { user },
        });
    } catch (error) {
        console.error('Lỗi login:', error);
        res.status(500).json({ message: 'Lỗi máy chủ khi đăng nhập.' });
    }
};

// ─── Đăng xuất ──────────────────────────────────────────────────
export const logout = async (req, res) => {
    try {
        // Xoá refresh token khỏi DB
        await req.user.logout();

        // Xoá cookie
        res.clearCookie('refreshToken');

        res.status(200).json({ status: 'success', message: 'Đăng xuất thành công.' });
    } catch (error) {
        console.error('Lỗi logout:', error);
        res.status(500).json({ message: 'Lỗi máy chủ khi đăng xuất.' });
    }
};

// ─── Refresh Access Token ────────────────────────────────────────
export const refreshToken = async (req, res) => {
    try {
        const token = req.cookies.refreshToken;
        if (!token) {
            return res.status(401).json({ message: 'Không có refresh token.' });
        }

        // Verify refresh token
        const { default: jwt } = await import('jsonwebtoken');
        const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);

        // Tìm user và kiểm tra refresh token khớp không
        const user = await User.findById(decoded.id).select('+refreshToken');
        if (!user || user.refreshToken !== token) {
            return res.status(401).json({ message: 'Refresh token không hợp lệ.' });
        }

        if (!user.isActive) {
            return res.status(403).json({ message: 'Tài khoản đã bị khoá.' });
        }

        // Cấp access token mới
        const newAccessToken = user.generateAccessToken();

        res.status(200).json({
            status: 'success',
            accessToken: newAccessToken,
        });
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'Refresh token đã hết hạn. Vui lòng đăng nhập lại.' });
        }
        console.error('Lỗi refreshToken:', error);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
};
//----------------------------- Dang test ----------------------------------------------
const OTP_EXPIRES_MINUTES = 5;
 
// ─── Bước 1: Gửi OTP về email ───────────────────────────────────────────────
// POST /api/auth/forgot-password
// Body: { email }
export const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
 
        if (!email) {
            return res.status(400).json({ message: 'Vui lòng nhập email.' });
        }
 
        // Tìm user — không báo "không tìm thấy" để tránh email enumeration
        const user = await User.findOne({ email: email.toLowerCase().trim() });
 
        if (user && user.isActive) {
            // Tạo OTP 6 chữ số bằng crypto (cryptographically secure)
            const otp = String(crypto.randomInt(100000, 999999));
 
            // Lưu OTP + thời gian hết hạn vào DB
            // resetPasswordToken  → lưu OTP
            // resetPasswordExpires → lưu timestamp hết hạn
            await User.updateOne(
                { _id: user._id },
                {
                    resetPasswordToken:   otp,
                    resetPasswordExpires: new Date(Date.now() + OTP_EXPIRES_MINUTES * 60 * 1000),
                }
            );
 
            // Gửi email
            await sendEmail({
                to:      user.email,
                subject: 'Mã xác thực đặt lại mật khẩu — MangaShop',
                html:    otpEmailTemplate(otp, OTP_EXPIRES_MINUTES),
            });
        }
 
        // Luôn trả về 200 để tránh lộ thông tin email tồn tại hay không
        res.status(200).json({
            status:  'success',
            message: 'Nếu email tồn tại, mã OTP đã được gửi.',
        });
    } catch (error) {
        console.error('Lỗi forgotPassword:', error);
        res.status(500).json({ message: 'Lỗi máy chủ khi gửi OTP.' });
    }
};
 
// ─── Bước 2: Xác thực OTP ───────────────────────────────────────────────────
// POST /api/auth/verify-otp
// Body: { email, otp }
export const verifyOtp = async (req, res) => {
    try {
        const { email, otp } = req.body;
 
        if (!email || !otp) {
            return res.status(400).json({ message: 'Vui lòng nhập email và mã OTP.' });
        }
 
        const user = await User.findOne({
            email:                email.toLowerCase().trim(),
            resetPasswordToken:   String(otp),
            resetPasswordExpires: { $gt: new Date() }, // chưa hết hạn
        });
 
        if (!user) {
            return res.status(400).json({ message: 'Mã OTP không đúng hoặc đã hết hạn.' });
        }
 
        // OTP đúng → trả về token tạm để dùng ở bước 3
        // Tạo một verifyToken ngắn hạn (10 phút), lưu lại vào resetPasswordToken
        const verifyToken = crypto.randomBytes(32).toString('hex');
 
        await User.updateOne(
            { _id: user._id },
            {
                resetPasswordToken:   verifyToken,
                resetPasswordExpires: new Date(Date.now() + 10 * 60 * 1000), // 10 phút
            }
        );
 
        res.status(200).json({
            status:      'success',
            message:     'OTP hợp lệ.',
            verifyToken,             // frontend giữ token này để gọi bước 3
        });
    } catch (error) {
        console.error('Lỗi verifyOtp:', error);
        res.status(500).json({ message: 'Lỗi máy chủ khi xác thực OTP.' });
    }
};
 
// ─── Bước 3: Đặt lại mật khẩu ───────────────────────────────────────────────
// POST /api/auth/reset-password
// Body: { email, verifyToken, newPassword }
export const resetPassword = async (req, res) => {
    try {
        const { email, verifyToken, newPassword } = req.body;
 
        if (!email || !verifyToken || !newPassword) {
            return res.status(400).json({ message: 'Thiếu thông tin cần thiết.' });
        }
 
        if (newPassword.length < 6) {
            return res.status(400).json({ message: 'Mật khẩu phải có ít nhất 6 ký tự.' });
        }
 
        const user = await User.findOne({
            email:                email.toLowerCase().trim(),
            resetPasswordToken:   verifyToken,
            resetPasswordExpires: { $gt: new Date() },
        });
 
        if (!user) {
            return res.status(400).json({ message: 'Token không hợp lệ hoặc đã hết hạn. Vui lòng thực hiện lại.' });
        }
 
        // Cập nhật mật khẩu mới — dùng save() để trigger pre-save hook bcrypt
        user.password             = newPassword;
        user.resetPasswordToken   = null;
        user.resetPasswordExpires = null;
        await user.save();
 
        res.status(200).json({
            status:  'success',
            message: 'Đặt lại mật khẩu thành công. Vui lòng đăng nhập lại.',
        });
    } catch (error) {
        console.error('Lỗi resetPassword:', error);
        res.status(500).json({ message: 'Lỗi máy chủ khi đặt lại mật khẩu.' });
    }
};