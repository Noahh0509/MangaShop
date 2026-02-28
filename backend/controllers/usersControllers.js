import User from '../models/User.js';

// ════════════════════════════════════════════════════════════════
//  ĐĂNG KÝ TÀI KHOẢN
// ════════════════════════════════════════════════════════════════

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
            username,
            email,
            password,
            fullName,
            phone,
            role: 'customer', // cố định, không cho truyền từ ngoài vào
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
        console.error("Lỗi registerUser:", error);
        res.status(500).json({ message: "Lỗi máy chủ khi đăng ký tài khoản." });
    }
};

// [ADMIN] Tạo tài khoản admin mới (chỉ admin mới được tạo)
export const registerAdmin = async (req, res) => {
    try {
        const { setupKey, username, email, password, fullName, phone } = req.body;

        // 1️⃣ Kiểm tra secret key
        if (setupKey !== process.env.ADMIN_SETUP_KEY) {
            return res.status(403).json({
                message: "Không có quyền tạo tài khoản admin."
            });
        }

        // 2️⃣ Validate dữ liệu
        if (!username || !email || !password) {
            return res.status(400).json({
                message: "Vui lòng nhập username, email và mật khẩu."
            });
        }

        // 3️⃣ Kiểm tra trùng email hoặc username
        const existingUser = await User.findOne({
            $or: [{ email }, { username }]
        });

        if (existingUser) {
            const field = existingUser.email === email ? "Email" : "Username";
            return res.status(400).json({
                message: `${field} đã được sử dụng.`
            });
        }

        // 4️⃣ Tạo admin
        const newAdmin = await User.create({
            username,
            email,
            password,
            fullName,
            phone,
            role: "admin"
        });

        res.status(200).json({
            status: "success",
            message: "Tạo tài khoản admin thành công.",
            data: { user: newAdmin }
        });

    } catch (error) {

        // Bắt lỗi duplicate index từ MongoDB
        if (error.code === 11000) {
            const field = Object.keys(error.keyValue)[0];
            return res.status(400).json({
                message: `${field} đã được sử dụng.`
            });
        }

        console.error("Lỗi registerAdmin:", error);
        res.status(500).json({
            message: "Lỗi máy chủ khi tạo tài khoản admin."
        });
    }
};

// ════════════════════════════════════════════════════════════════
//  ADMIN
// ════════════════════════════════════════════════════════════════

export const getAllUsers = async (req, res) => {
    try {
        const users = await User.find().select('-__v');
        res.status(200).json({ status: 'success', results: users.length, data: { users } });
    } catch (error) {
        console.error("Lỗi getAllUsers:", error);
        res.status(500).json({ message: "Lỗi máy chủ khi lấy danh sách user." });
    }
};

export const getUserById = async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select('-__v');
        if (!user) return res.status(404).json({ message: "Không tìm thấy user." });
        res.status(200).json({ status: 'success', data: { user } });
    } catch (error) {
        console.error("Lỗi getUserById:", error);
        res.status(500).json({ message: "Lỗi máy chủ khi lấy user." });
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
        if (error.code === 11000) {
            const field = Object.keys(error.keyValue)[0];
            return res.status(400).json({ message: `${field} đã tồn tại.` });
        }
        console.error("Lỗi updateUserByAdmin:", error);
        res.status(500).json({ message: "Lỗi máy chủ khi cập nhật user." });
    }
};

export const deleteUser = async (req, res) => {
    try {
        const user = await User.findByIdAndDelete(req.params.id);
        if (!user) return res.status(404).json({ message: "Không tìm thấy user." });
        res.status(200).json({ status: 'success', message: "Xoá user thành công." });
    } catch (error) {
        console.error("Lỗi deleteUser:", error);
        res.status(500).json({ message: "Lỗi máy chủ khi xoá user." });
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
        console.error("Lỗi toggleActiveUser:", error);
        res.status(500).json({ message: "Lỗi máy chủ khi thay đổi trạng thái user." });
    }
};

// ════════════════════════════════════════════════════════════════
//  USER (bản thân)
// ════════════════════════════════════════════════════════════════

export const getMe = async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select('-__v');
        if (!user) return res.status(404).json({ message: "Không tìm thấy user." });
        res.status(200).json({ status: 'success', data: { user } });
    } catch (error) {
        console.error("Lỗi getMe:", error);
        res.status(500).json({ message: "Lỗi máy chủ khi lấy thông tin cá nhân." });
    }
};

// Cập nhật thông tin cá nhân: fullName, phone, avatar, address
export const updateMe = async (req, res) => {
    try {
        const { role, isActive, password, refreshToken, ...allowedData } = req.body;
        const user = await User.findByIdAndUpdate(req.user._id, allowedData, {
            new: true, runValidators: true
        }).select('-__v');
        res.status(200).json({ status: 'success', data: { user } });
    } catch (error) {
        if (error.code === 11000) {
            const field = Object.keys(error.keyValue)[0];
            return res.status(400).json({ message: `${field} đã tồn tại.` });
        }
        console.error("Lỗi updateMe:", error);
        res.status(500).json({ message: "Lỗi máy chủ khi cập nhật thông tin." });
    }
};

export const changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ message: "Vui lòng nhập mật khẩu hiện tại và mật khẩu mới." });
        }

        const user = await User.findById(req.user._id).select('+password');
        const isMatch = await user.comparePassword(currentPassword);
        if (!isMatch) return res.status(401).json({ message: "Mật khẩu hiện tại không đúng." });

        user.password = newPassword;
        await user.save();

        res.status(200).json({ status: 'success', message: "Đổi mật khẩu thành công." });
    } catch (error) {
        console.error("Lỗi changePassword:", error);
        res.status(500).json({ message: "Lỗi máy chủ khi đổi mật khẩu." });
    }
};