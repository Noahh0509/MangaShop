import Product from "../models/Product.js";
import Promotion from "../models/Promotion.js";
import Category from "../models/Category.js";

const ProductController = {
  // 1. Lấy danh sách sản phẩm (có kèm lọc, phân trang và tính giá KM)
  getAllProducts: async (req, res) => {
    try {
      const { category, tag, sort, page = 1, limit = 10 } = req.query;
      const query = { status: Product.STATUS.ACTIVE };

      if (category) query.category = category;
      if (tag) query.tags = tag;

      const products = await Product.find(query)
        .populate("category", "name slug")
        .sort(sort || "-createdAt")
        .limit(limit * 1)
        .skip((page - 1) * limit);

      // Map qua từng sản phẩm để đính kèm logic Promotion
      const enrichedProducts = await Promise.all(
        products.map(async (product) => {
          // SỬA 1: Đổi tên hàm thành findForProduct (cho khớp với models/Promotion.js)
          // SỬA 2: Thêm dấu ? vào category?._id để đề phòng trường hợp sản phẩm chưa có danh mục gây lỗi sập app
          const promo = await Promotion.findForProduct(
            product._id,
            product.category?._id,
          );

          // Lấy khuyến mãi có ưu tiên cao nhất (priority)
          const bestPromo = promo[0] || null;

          let finalPrice = product.displayPrice;
          let promoInfo = null;

          if (bestPromo) {
            // SỬA 3: Hàm calculateDiscount trong Model chỉ nhận 2 tham số: (originalPrice, quantity)
            // Bạn truyền product._id vào tham số đầu sẽ làm code tính ra NaN (Not a Number). Chỉ cần truyền product.basePrice là đủ.
            const calculation = bestPromo.calculateDiscount(product.basePrice);

            finalPrice = calculation.finalPrice;
            promoInfo = {
              name: bestPromo.name,
              discountType: bestPromo.discountType,
              endDate: bestPromo.endDate,
            };
          }

          return {
            ...product.toObject(),
            finalPrice,
            appliedPromotion: promoInfo,
          };
        }),
      );

      res.json({
        success: true,
        count: enrichedProducts.length,
        data: enrichedProducts,
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  // 2. Chi tiết sản phẩm (Dùng slug để tốt cho SEO)
  getProductBySlug: async (req, res) => {
    try {
      const product = await Product.findBySlug(req.params.slug);
      if (!product)
        return res.status(404).json({ message: "Không tìm thấy sản phẩm" });

      // Tăng lượt xem
      await product.incrementView();

      // SỬA 4: Tương tự ở trên, đổi tên hàm thành findForProduct
      const promotions = await Promotion.findForProduct(
        product._id,
        product.category?._id,
      );

      res.json({
        success: true,
        data: product,
        activePromotions: promotions,
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },
};

export default ProductController;
