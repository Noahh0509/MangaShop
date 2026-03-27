import User from '../models/User.js';

// ════════════════════════════════════════════════════════════════
//  ĐĂNG KÝ TÀI KHOẢN
// ════════════════════════════════════════════════════════════════

// [PUBLIC] Xuất danh sách users - Id + name (không cần auth)
export const getAllUsersPublic = async (req, res) => {
    try {
        const users = await User.find({ isActive: true })
            .select('_id fullName username')
            .lean();

        const data = users.map(u => ({
            Id: u._id,
            name: u.fullName || u.username,
        }));

        res.status(200).json({
            status: 'success',
            results: data.length,
            data: { users: data }
        });
    } catch (error) {
        console.error("Lỗi getAllUsersPublic:", error);
        res.status(500).json({ message: "Lỗi máy chủ." });
    }
};

// [PUBLIC] Khách tự đăng ký → luôn là customer
export const registerUser = async (req, res) => {
    try {
        const { username, email, password, fullName, phone } = req.body;

        if (!username || !email || !password) {
            return res.status(400).json({ message: "Vui lòng nhập username, email và mật khẩu." });
        }

        const existingUser = await User.findOne({ $or: [{ email }, { username }] });
        if (existingUser) {
            const field = existingUser.email === email ? 'Email' : 'Username';
            return res.status(400).json({ message: `${field} đã được sử dụng.` });
        }

        const newUser = await User.create({
            username, email, password, fullName, phone,
            role: 'customer',
        });

        res.status(200).json({
            status: 'success',
            message: 'Đăng ký thành công.',
            data: { user: newUser },
        });
    } catch (error) {
        if (error.code === 11000) {
            const field = Object.keys(error.keyValue)[0];
            return res.status(400).json({ message: `${field} đã được sử dụng.` });
        }
        res.status(500).json({ message: "Lỗi máy chủ." });
    }
};

// [ADMIN] Tạo tài khoản admin mới
export const registerAdmin = async (req, res) => {
    try {
        const { setupKey, username, email, password, fullName, phone } = req.body;

        if (setupKey !== process.env.ADMIN_SETUP_KEY) {
            return res.status(403).json({ message: "Không có quyền tạo tài khoản admin." });
        }

        const existingUser = await User.findOne({ $or: [{ email }, { username }] });
        if (existingUser) {
            const field = existingUser.email === email ? "Email" : "Username";
            return res.status(400).json({ message: `${field} đã được sử dụng.` });
        }

        const newAdmin = await User.create({
            username, email, password, fullName, phone,
            role: "admin"
        });

        res.status(200).json({
            status: "success",
            message: "Tạo tài khoản admin thành công.",
            data: { user: newAdmin }
        });
    } catch (error) {
        res.status(500).json({ message: "Lỗi máy chủ." });
    }
};

// ════════════════════════════════════════════════════════════════
//  ADMIN (QUẢN TRỊ)
// ════════════════════════════════════════════════════════════════

export const getAllUsers = async (req, res) => {
    try {
        const users = await User.find().select('-__v');
        res.status(200).json({ status: 'success', results: users.length, data: { users } });
    } catch (error) {
        res.status(500).json({ message: "Lỗi máy chủ." });
    }
};

export const createStaff = async (req, res) => {
    try {
        const { username, email, password, fullName, phone } = req.body;
        const staff = await User.create({
            username, email, password, fullName, phone,
            role: 'staff',
        });

        res.status(201).json({ status: 'success', data: { user: staff } });
    } catch (error) {
        res.status(500).json({ message: "Lỗi máy chủ." });
    }
};

export const getUserById = async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select('-__v');
        if (!user) return res.status(404).json({ message: "Không tìm thấy user." });
        res.status(200).json({ status: 'success', data: { user } });
    } catch (error) {
        res.status(500).json({ message: "Lỗi máy chủ." });
    }
};

export const updateUserByAdmin = async (req, res) => {
    try {
        const { password, refreshToken, ...updateData } = req.body;

        const user = await User.findByIdAndUpdate(req.params.id, updateData, {
            new: true, runValidators: true
        }).select('-__v');

        if (!user) return res.status(404).json({ message: "Không tìm thấy user." });

        res.status(200).json({ status: 'success', data: { user } });
    } catch (error) {
        res.status(500).json({ message: "Lỗi máy chủ." });
    }
};

export const deleteUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ message: "Không tìm thấy user." });

        await User.findByIdAndDelete(req.params.id);
        res.status(200).json({ status: 'success', message: "Xoá user thành công." });
    } catch (error) {
        res.status(500).json({ message: "Lỗi máy chủ." });
    }
};

export const toggleActiveUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ message: "Không tìm thấy user." });

        user.isActive = !user.isActive;
        await user.save({ validateBeforeSave: false });

        res.status(200).json({
            status: 'success',
            message: `Tài khoản đã được ${user.isActive ? 'mở khoá' : 'khoá'}.`,
            data: { isActive: user.isActive }
        });
    } catch (error) {
        res.status(500).json({ message: "Lỗi máy chủ." });
    }
};

// ════════════════════════════════════════════════════════════════
//  USER (BẢN THÂN)
// ════════════════════════════════════════════════════════════════

export const getMe = async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select('-__v');
        res.status(200).json({ status: 'success', data: { user } });
    } catch (error) {
        res.status(500).json({ message: "Lỗi máy chủ." });
    }
};

export const updateMe = async (req, res) => {
    try {
        const { role, isActive, password, refreshToken, ...allowedData } = req.body;
        const user = await User.findByIdAndUpdate(req.user._id, allowedData, {
            new: true, runValidators: true
        }).select('-__v');
        res.status(200).json({ status: 'success', data: { user } });
    } catch (error) {
        res.status(500).json({ message: "Lỗi máy chủ." });
    }
};

export const changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const user = await User.findById(req.user._id).select('+password');
        const isMatch = await user.comparePassword(currentPassword);
        if (!isMatch) return res.status(401).json({ message: "Mật khẩu hiện tại không đúng." });

        user.password = newPassword;
        await user.save();

        res.status(200).json({ status: 'success', message: "Đổi mật khẩu thành công." });
    } catch (error) {
        res.status(500).json({ message: "Lỗi máy chủ." });
    }
};