import Promotion from "../models/Promotion.js";
import Product from "../models/Product.js";

const PromotionController = {
  // 1. Kiểm tra mã giảm giá (Dùng cho trang Checkout / Giỏ hàng)
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
        return res.status(400).json({ message: `Đơn hàng tối thiểu phải từ ${promo.minOrderValue.toLocaleString()}đ` });
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
      }).populate("flashSaleItems.product", "name images basePrice salePrice slug");

      res.json({ success: true, data: flashSales });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  // 3. Admin: Tạo chương trình khuyến mãi mới VÀ ĐỒNG BỘ GIÁ SALE
  createPromotion: async (req, res) => {
    try {
      const newPromo = new Promotion(req.body);
      await newPromo.save();

      // --- ĐỒNG BỘ GIÁ XUỐNG BẢNG PRODUCT ---
      // Nếu là Flash Sale và status đang là 'active' thì cập nhật giá sale luôn
      if (newPromo.status === 'active' && newPromo.discountType === 'flash_sale') {
        const flashItems = newPromo.flashSaleItems || [];
        
        for (const item of flashItems) {
          // Lấy ID sản phẩm và mức giá Flash Sale muốn áp dụng
          const productId = item.product;
          const newSalePrice = item.flashPrice;

          // Cập nhật giá salePrice và đẩy ID promotion này vào mảng promotions của Product
          await Product.findByIdAndUpdate(productId, { 
            salePrice: newSalePrice,
            $addToSet: { promotions: newPromo._id } // Lưu vết để biết SP đang tham gia KM nào
          });
        }
      }

      res.status(201).json({ 
        success: true, 
        message: "Tạo khuyến mãi và đồng bộ giá thành công!",
        data: newPromo 
      });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  },

  // 4. Admin: Dừng chương trình khuyến mãi VÀ KHÔI PHỤC GIÁ GỐC
  stopPromotion: async (req, res) => {
    try {
      const { id } = req.params;
      
      const promo = await Promotion.findById(id);
      if (!promo) {
        return res.status(404).json({ message: "Không tìm thấy chương trình khuyến mãi." });
      }

      // Đổi trạng thái thành expired (hết hạn)
      promo.status = 'expired';
      await promo.save();

      // --- KHÔI PHỤC GIÁ GỐC CHO CÁC SẢN PHẨM TRONG FLASH SALE ---
      if (promo.discountType === 'flash_sale') {
        const flashItems = promo.flashSaleItems || [];
        
        for (const item of flashItems) {
          // Trả salePrice về null và xóa ID promotion khỏi mảng promotions của Product
          await Product.findByIdAndUpdate(item.product, {
            salePrice: null,
            $pull: { promotions: promo._id }
          });
        }
      }

      res.status(200).json({
        success: true,
        message: "Đã dừng khuyến mãi và khôi phục giá gốc cho các sản phẩm."
      });

    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
};

export default PromotionController; 