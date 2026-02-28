import jwt from 'jsonwebtoken';
import User from '../models/User.js';

// ─── Kiểm tra đăng nhập ─────────────────────────────────────────
export const protect = async (req, res, next) => {
    try {
        // Lấy token từ header
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ message: 'Chưa đăng nhập. Vui lòng đăng nhập để tiếp tục.' });
        }

        const token = authHeader.split(' ')[1];

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Tìm user
        const user = await User.findById(decoded.id).select('-password -refreshToken');
        if (!user) {
            return res.status(401).json({ message: 'Token không hợp lệ. User không tồn tại.' });
        }

        // Kiểm tra tài khoản bị khoá
        if (!user.isActive) {
            return res.status(403).json({ message: 'Tài khoản đã bị khoá. Vui lòng liên hệ admin.' });
        }

        // Kiểm tra token có bị invalidate sau khi đổi mật khẩu không
        if (!user.isTokenValidAfterPasswordChange(decoded.iat)) {
            return res.status(401).json({ message: 'Mật khẩu vừa được thay đổi. Vui lòng đăng nhập lại.' });
        }

        // Gắn user vào request
        req.user = user;
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'Token đã hết hạn. Vui lòng đăng nhập lại.' });
        }
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ message: 'Token không hợp lệ.' });
        }
        console.error('Lỗi protect middleware:', error);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
};

// ─── Kiểm tra role ──────────────────────────────────────────────
export const restrictTo = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                message: `Bạn không có quyền thực hiện hành động này. Yêu cầu role: ${roles.join(', ')}.`
            });
        }
        next();
    };
};