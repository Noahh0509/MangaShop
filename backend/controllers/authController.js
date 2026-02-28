import User from '../models/User.js';

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