import Product from "../models/Product.js";
import Promotion from "../models/Promotion.js";
import Category from "../models/Category.js";
import slugify from "slugify"; 

const ProductController = {
  // 1. Lấy danh sách thể loại cho Modal Admin
  getCategories: async (req, res) => {
    try {
      const categories = await Category.find().sort({ name: 1 });
      res.status(200).json(categories);
    } catch (error) {
      res.status(500).json({ message: "Lỗi lấy danh sách thể loại" });
    }
  },

  // 2. Lấy list sản phẩm cho Admin (có search & phân trang)
  getAdminProducts: async (req, res) => {
    try {
      // 1. Lấy số trang từ Query, mặc định là trang 1
      // Ví dụ khách gọi: /api/products/admin-all?page=2
      const page = parseInt(req.query.page) || 1;
      const limit = 5; // ✅ Sếp muốn 5 cuốn mỗi trang
      const skip = (page - 1) * limit; // Tính toán số lượng bỏ qua

      const search = req.query.search || '';
      const query = search ? { name: { $regex: search, $options: 'i' } } : {};

      // 2. Lấy dữ liệu đã phân trang
      const products = await Product.find(query)
        .populate("category", "name")
        .sort("-createdAt") // Hàng mới về lên đầu
        .skip(skip)         // Bỏ qua các cuốn của trang trước
        .limit(limit);      // Chỉ lấy đúng 5 cuốn

      // 3. Đếm tổng số để FE biết đường làm nút "Trang sau/Trang trước"
      const totalProducts = await Product.countDocuments(query);
      const totalPages = Math.ceil(totalProducts / limit);

      res.json({
        success: true,
        data: products,
        pagination: {
          currentPage: page,
          totalPages: totalPages,
          totalItems: totalProducts,
          limit: limit
        }
      });

    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },
  // 1. Tạo sản phẩm mới (Admin)
  createProduct: async (req, res) => {
    try {
      const { name, basePrice, stock, category, description, images } = req.body;

      if (!name || !basePrice || !category) {
        return res.status(400).json({ message: "Thiếu Tên, Giá hoặc Thể loại sếp ơi!" });
      }

      const existingProduct = await Product.findOne({
        name: { $regex: new RegExp(`^${name}$`, 'i') }
      });

      if (existingProduct) {
        return res.status(400).json({
          success: false,
          message: `Bộ truyện "${name}" đã có trong kho rồi sếp ơi! Sếp check lại thử xem.`
        });
      }
      // Tạo slug tự động
      const slug = slugify(name, { lower: true, locale: 'vi', strict: true }) + '-' + Date.now();

      const newProduct = new Product({
        name,
        slug,
        basePrice: Number(basePrice),
        stock: Number(stock) || 0,
        category,
        description,
        images,
        status: Number(stock) > 0 ? "active" : "out_of_stock"
      });

      await newProduct.save();
      res.status(201).json({ success: true, message: "Đã nhập kho bộ " + name, data: newProduct });
    } catch (error) {
      console.error("Lỗi Create Product:", error);
      res.status(500).json({ message: "Lỗi Server rồi!" });
    }
  },
  // 2. Cập nhật sản phẩm (Admin)
  updateProduct: async (req, res) => {
    try {
      const { id } = req.params;
      const updateData = req.body;

      // Tìm và cập nhật theo ID
      const updatedProduct = await Product.findByIdAndUpdate(
        id,
        updateData,
        { new: true, runValidators: true }
      );

      if (!updatedProduct) {
        return res.status(404).json({ success: false, message: "Không tìm thấy truyện này sếp ơi!" });
      }

      res.json({
        success: true,
        message: "Đã cập nhật bộ " + updatedProduct.name,
        data: updatedProduct
      });
    } catch (error) {
      console.error("Lỗi Update Product:", error);
      res.status(500).json({ success: false, message: "Lỗi Server rồi sếp!" });
    }
  },
  // 3. Xóa sản phẩm (Admin)
  deleteProduct: async (req, res) => {
    try {
      const { id } = req.params;
      const deletedProduct = await Product.findByIdAndDelete(id);

      if (!deletedProduct) {
        return res.status(404).json({ success: false, message: "Không tìm thấy truyện để xóa!" });
      }

      res.json({
        success: true,
        message: `Đã tiêu hủy cuốn "${deletedProduct.name}" khỏi kho!`
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },
  // 3. API cho khách xem (Có tính toán khuyến mãi phức tạp)
  getAllProducts: async (req, res) => {
    try {
<<<<<<< HEAD
      const { category, tag, sort, page = 1, limit = 10 } = req.query;
      const query = { status: "active" }; // Sửa lại 'active' cho chắc ăn
=======
      // ĐÃ SỬA CHỖ NÀY 1: Thêm keyword vào destructuring
      const { category, tag, sort, keyword, page = 1, limit = 10 } = req.query;
      const query = { status: Product.STATUS.ACTIVE };
>>>>>>> 1b50f00367a47fef9f448eb08487435dac7479c6

      if (category) query.category = category;
      if (tag) query.tags = tag;

      // ĐÃ SỬA CHỖ NÀY 2: Bắt biến keyword để tìm kiếm theo tên truyện bằng Regex (không phân biệt chữ hoa thường)
      if (keyword) {
        query.name = { $regex: keyword, $options: "i" };
      }

      const products = await Product.find(query)
        .populate("category", "name slug")
        .sort(sort || "-createdAt")
        .limit(limit * 1)
        .skip((page - 1) * limit);

      const enrichedProducts = await Promise.all(
        products.map(async (product) => {
          const promo = await Promotion.findForProduct(
            product._id,
            product.category?._id,
          );

          const bestPromo = promo[0] || null;
          let finalPrice = product.basePrice; // Dùng basePrice làm gốc
          let promoInfo = null;

          if (bestPromo) {
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

  // 4. Chi tiết sản phẩm qua Slug
  getProductBySlug: async (req, res) => {
    try {
      const product = await Product.findBySlug(req.params.slug);
      if (!product) return res.status(404).json({ message: "Không tìm thấy" });

      await product.incrementView();
      const promotions = await Promotion.findForProduct(product._id, product.category?._id);

      res.json({ success: true, data: product, activePromotions: promotions });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },


};

export default ProductController;