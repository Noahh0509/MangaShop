import Invoice from "../models/Invoice.js";
import Product from "../models/Product.js";
import User from "../models/User.js";

export const getAdminStats = async (req, res) => {
  try {
    // 1. Tính tổng doanh thu từ các đơn hàng đã giao (DELIVERED)
    const revenueData = await Invoice.aggregate([
      { $match: { status: "DELIVERED" } },
      { $group: { _id: null, total: { $sum: "$totalAmount" } } }
    ]);
    const totalRevenue = revenueData.length > 0 ? revenueData[0].total : 0;

    // 2. Đếm số lượng đơn hàng, sản phẩm, khách hàng
    const totalOrders = await Invoice.countDocuments();
    const totalProducts = await Product.countDocuments();
    const totalUsers = await User.countDocuments({ role: "customer" });

    // 3. Lấy dữ liệu doanh thu 7 ngày gần nhất cho biểu đồ
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const chartData = await Invoice.aggregate([
      { 
        $match: { 
          status: "DELIVERED", 
          createdAt: { $gte: sevenDaysAgo } 
        } 
      },
      {
        $group: {
          // Nhóm theo định dạng Ngày/Tháng
          _id: { $dateToString: { format: "%d/%m", date: "$createdAt" } },
          revenue: { $sum: "$totalAmount" }
        }
      },
      { $sort: { "_id": 1 } } // Sắp xếp theo thứ tự ngày tăng dần
    ]);

    // 4. Lấy 5 đơn hàng mới nhất để hiển thị ở bảng "Recent Orders"
    const recentInvoices = await Invoice.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate("user", "fullName email");

    // 5. Trả về kết quả
    res.status(200).json({
      success: true,
      data: {
        totalRevenue,
        totalOrders,
        totalProducts,
        totalUsers,
        recentInvoices,
        chartData // Dữ liệu này sẽ dùng cho Recharts ở Frontend
      }
    });
  } catch (error) {
    res.status(500).json({ message: "Lỗi lấy thống kê", error: error.message });
  }
};