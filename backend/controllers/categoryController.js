import Category from "../models/Category.js";

// Lấy danh sách tất cả danh mục đang active
export const getAllCategories = async (req, res) => {
  try {
    const categories = await Category.find({ isActive: true }).select("name slug");
    res.status(200).json({ success: true, data: categories });
  } catch (error) {
    res.status(500).json({ message: "Lỗi khi lấy danh mục", error: error.message });
  }
};