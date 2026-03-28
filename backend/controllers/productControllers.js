import Product from "../models/Product.js";
import Promotion from "../models/Promotion.js";
import Category from "../models/Category.js";
import slugify from "slugify";
import cloudinary from "../config/cloudinary.js";

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
      const page = parseInt(req.query.page) || 1;
      const limit = 5;
      const skip = (page - 1) * limit;

      const search = req.query.search || '';
      const query = search ? { name: { $regex: search, $options: 'i' } } : {};

      const products = await Product.find(query)
        .populate("category", "name")
        .populate("promotions")
        .sort("-createdAt")
        .skip(skip)
        .limit(limit);

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

      // 1. Validation cơ bản (Giữ nguyên của sếp)
      if (!name || !basePrice || !category) {
        return res.status(400).json({ message: "Thiếu Tên, Giá hoặc Thể loại !" });
      }
      if (Number(basePrice) <= 0) return res.status(400).json({ message: "Giá sản phẩm phải lớn hơn 0 !" });
      if (Number(stock) < 0) return res.status(400).json({ message: "Số lượng không được là số âm." });

      const existingProduct = await Product.findOne({
        name: { $regex: new RegExp(`^${name}$`, 'i') }
      });
      if (existingProduct) {
        return res.status(400).json({
          success: false,
          message: `Bộ truyện "${name}" đã có trong kho rồi!`
        });
      }

      // 2. Tạo Slug
      const baseSlug = slugify(name, { lower: true, locale: 'vi', strict: true });
      const finalSlug = baseSlug + '-' + Date.now();

      // 🕵️‍♂️ 3. XỬ LÝ UPLOAD ẢNH & CHỐNG TRÙNG
      // Nếu sếp gửi mảng ảnh (dạng base64 hoặc file) từ FE lên
      let finalImages = [];
      if (images && images.length > 0) {
        const uploadPromises = images.map(async (img, index) => {
          // 1. Kiểm tra nếu img đã là Object có url (đã up rồi) thì trả về luôn
          // Dành cho trường hợp sếp lấy data cũ từ DB rồi gửi ngược lên
          if (typeof img === 'object' && img.url && img.url.startsWith('http')) {
            return img;
          }

          // 2. Nếu img là chuỗi URL cũ (chống lỗi format từ FE)
          if (typeof img === 'string' && img.startsWith('http')) {
            return { url: img };
          }

          // 🚀 3. CHỈ UPLOAD KHI LÀ FILE MỚI (Base64 hoặc Buffer)
          try {
            // Đặt tên theo kiểu: naruto-tap-2-0, naruto-tap-2-1...
            const imagePublicId = `${baseSlug}-${index}`;

            const uploadRes = await cloudinary.uploader.upload(img, {
              folder: 'MangaShop/Products',
              public_id: imagePublicId,
              overwrite: true,  // Trùng tên là đè luôn, cực sạch kho!
              invalidate: true, // Xóa cache để khách thấy ảnh mới ngay lập tức
              resource_type: "auto" // Tự nhận diện png, jpg, webp...
            });

            return {
              url: uploadRes.secure_url,
              public_id: uploadRes.public_id
            };
          } catch (error) {
            console.error(`Lỗi upload tấm ảnh thứ ${index}:`, error);
            return null; // Hoặc ném lỗi tùy sếp
          }
        });

        // Lọc bỏ những tấm bị lỗi (null) để DB không bị rác
        finalImages = (await Promise.all(uploadPromises)).filter(img => img !== null);
      }

      // 4. Lưu vào DB
      const newProduct = new Product({
        name,
        slug: finalSlug,
        basePrice: Number(basePrice),
        stock: Number(stock) || 0,
        category,
        description,
        images: finalImages, // Lưu mảng Object có cả URL và Public_ID
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

      if (updateData.basePrice !== undefined && Number(updateData.basePrice) <= 0) {
        return res.status(400).json({
          success: false,
          message: "Giá truyện phải lớn hơn 0."
        });
      }

      // Check số lượng kho
      if (updateData.stock !== undefined && Number(updateData.stock) < 0) {
        return res.status(400).json({
          success: false,
          message: "Số lượng tồn kho không được là số âm!"
        });
      }

      const updatedProduct = await Product.findByIdAndUpdate(
        id,
        updateData,
        { new: true, runValidators: true }
      );

      if (!updatedProduct) {
        return res.status(404).json({ success: false, message: "Không tìm thấy truyện này " });
      }

      res.json({
        success: true,
        message: "Đã cập nhật bộ " + updatedProduct.name,
        data: updatedProduct
      });
    } catch (error) {
      console.error("Lỗi Update Product:", error);
      res.status(500).json({ success: false, message: "Lỗi Server rồi!" });
    }
  },

  // 3. Xóa sản phẩm (Admin)
  deleteProduct: async (req, res) => {
    try {
      const { id } = req.params;
      const product = await Product.findById(id);

      if (!product) {
        return res.status(404).json({ message: "Không thấy truyện!" });
      }

      // 🚀 BƯỚC 1: Xóa ảnh trên Cloudinary trước khi xóa DB
      // Giả sử sếp lưu images là một mảng các URL
      if (product.images && product.images.length > 0) {
        const deletePromises = product.images.map(imgObj => {
          // 🕵️‍♂️ LẤY URL TỪ OBJECT:
          const url = imgObj.url;

          if (!url) return Promise.resolve();

          // Tách Public ID từ URL Cloudinary
          // URL của sếp có folder /products/... nên mình lấy từ sau chữ /upload/
          const parts = url.split('/');
          const uploadIndex = parts.indexOf('upload');

          // Lấy phần sau /v12345678/ (thường là index + 2)
          // Sau đó bỏ cái đuôi .jpg/.png đi bằng cách split('.')
          const publicIdWithExtension = parts.slice(uploadIndex + 2).join('/');
          const publicId = publicIdWithExtension.split('.')[0];

          console.log("Đang xóa ảnh có Public ID:", publicId);
          return cloudinary.uploader.destroy(publicId);
        });

        await Promise.all(deletePromises);
      }

      // 🚀 BƯỚC 2: Xóa trong DB
      await Product.findByIdAndDelete(id);

      res.json({ success: true, message: "Đã xóa sạch cả truyện lẫn ảnh!" });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  // 3. API cho khách xem (Có tính toán khuyến mãi phức tạp)
  getAllProducts: async (req, res) => {
    try {
      const { category, tag, sort, keyword, page = 1, limit = 10 } = req.query;
      const query = { status: Product.STATUS.ACTIVE };

      if (category) query.category = category;
      if (tag) query.tags = tag;

      if (keyword) {
        query.name = { $regex: keyword, $options: "i" };
      }

      const products = await Product.find(query)
        .populate("category", "name slug")
        .populate("promotions")
        .sort(sort || "-createdAt")
        .limit(limit * 1)
        .skip((page - 1) * limit);

      const enrichedProducts = await Promise.all(
        products.map(async (product) => {
          let bestPromo = null;

          // 🎯 1. ƯU TIÊN MÃ GÁN RIÊNG (Đã được populate thành Object)
          if (product.promotions && product.promotions.length > 0) {
            bestPromo = product.promotions[0];
          }

          // 🎯 2. NẾU KHÔNG CÓ RIÊNG -> TÌM CHUNG
          // (Check xem bestPromo có phải object chưa, nếu chưa hoặc null thì tìm tiếp)
          if (!bestPromo || typeof bestPromo !== 'object') {
            const commonPromos = await Promotion.findForProduct(
              product._id,
              product.category?._id
            );
            bestPromo = commonPromos[0] || null;
          }

          let finalPrice = product.basePrice;
          let promoInfo = null;

          // 🎯 3. TÍNH TOÁN (Đảm bảo bestPromo là object có data)
          if (bestPromo && typeof bestPromo === 'object' && bestPromo.discountValue) {
            const now = new Date();
            const start = new Date(bestPromo.startDate);
            const end = bestPromo.endDate ? new Date(bestPromo.endDate) : null;

            // Kiểm tra thời hạn
            if (now >= start && (!end || now <= end)) {
              // Gọi hàm tính toán trong model Promotion của sếp
              const calculation = bestPromo.calculateDiscount(product.basePrice);
              finalPrice = calculation.finalPrice;

              promoInfo = {
                name: bestPromo.name,
                discountType: bestPromo.discountType,
                discountValue: bestPromo.discountValue,
                endDate: bestPromo.endDate,
              };
            }
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

  applyPromotion: async (req, res) => {
    try {
      const { productId } = req.params;
      const { promotionId } = req.body;

      // 🎯 Chuẩn bị mảng để đưa vào trường 'promotions' trong Model
      const updateValue = promotionId ? [promotionId] : [];

      const updatedProduct = await Product.findByIdAndUpdate(
        productId,
        // 🚀 PHẢI DÙNG ĐÚNG TÊN TRƯỜNG LÀ 'promotions' (SỐ NHIỀU)
        { $set: { promotions: updateValue } },
        { new: true }
      );

      if (!updatedProduct) {
        return res.status(404).json({ success: false, message: "Không tìm thấy truyện này sếp ơi!" });
      }

      res.status(200).json({
        success: true,
        message: "Đã cập nhật ưu đãi cho tác phẩm!",
        data: updatedProduct
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // ✅ 2. Áp dụng (hoặc Hủy) khuyến mãi cho TẤT CẢ sản phẩm (Sale All)
  applyPromotionToAll: async (req, res) => {
    try {
      const { promotionId } = req.body;
      const updateValue = promotionId ? [promotionId] : [];

      // UpdateMany sẽ quét toàn bộ Collection Product
      await Product.updateMany({}, { $set: { promotions: updateValue } });

      res.status(200).json({
        success: true,
        message: promotionId ? "Đã nhuộm vàng toàn bộ cửa hàng!" : "Đã gỡ bỏ toàn bộ khuyến mãi!"
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },
};

export default ProductController;