import Promotion from "../models/Promotion.js";
import Product from "../models/Product.js";

const PromotionController = {
  // 1. Kiểm tra mã giảm giá (Dùng cho trang Checkout)
  validatePromoCode: async (req, res) => {
    try {
      const { code, orderValue, userId, cartItems } = req.body;

      // Tìm mã đang active
      const promo = await Promotion.findOne({ 
        code: code.toUpperCase(), 
        status: "active" 
      });

      if (!promo) return res.status(404).json({ message: "Mã giảm giá không tồn tại hoặc đã hết hạn." });

      // Kiểm tra các điều kiện cơ bản
      if (promo.isExpired) return res.status(400).json({ message: "Mã đã hết hạn sử dụng." });
      if (promo.isUsageLimitReached) return res.status(400).json({ message: "Mã đã hết lượt sử dụng." });
      if (orderValue < promo.minOrderValue) {
        return res.status(400).json({ message: `Đơn hàng tối thiểu phải từ ${promo.minOrderValue}đ` });
      }

      // TODO: Kiểm tra xem userId này đã dùng quá usageLimitPerUser chưa (truy vấn bảng Order)

      res.json({
        success: true,
        message: "Áp dụng mã thành công",
        data: {
          name: promo.name,
          discountType: promo.discountType,
          discountValue: promo.discountValue,
          maxDiscount: promo.maxDiscount
        }
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  // 2. Lấy danh sách Flash Sale (Hiện ở trang chủ React)
  getActiveFlashSales: async (req, res) => {
    try {
      const flashSales = await Promotion.find({
        discountType: "flash_sale",
        status: "active",
        startDate: { $lte: new Date() },
        endDate: { $gte: new Date() }
      }).populate("flashSaleItems.product", "name images basePrice slug");

      res.json({ success: true, data: flashSales });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  // 3. Admin: Tạo chương trình khuyến mãi mới
  createPromotion: async (req, res) => {
    try {
      const newPromo = new Promotion(req.body);
      await newPromo.save();
      res.status(201).json({ success: true, data: newPromo });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }
};

export default PromotionController;