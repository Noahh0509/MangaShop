import mongoose from "mongoose";
import "dotenv/config";
import Product from "./models/Product.js";
import Category from "./models/Category.js";
import slugify from "slugify";

const seedData = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("--- 💡 Đang kết nối Database (Chế độ an toàn)... ---");

    // 1. Tạo Category mẫu (Chỉ tạo nếu chưa tồn tại)
    const categoriesData = [
      { name: "Shounen", slug: "shounen" },
      { name: "Seinen", slug: "seinen" },
      { name: "Romance", slug: "romance" },
      { name: "Action", slug: "action" }
    ];

    for (const cat of categoriesData) {
      await Category.findOneAndUpdate(
        { name: cat.name }, // Tìm theo tên
        cat,               // Dữ liệu cập nhật
        { upsert: true, new: true } // Không có thì tạo mới
      );
    }
    console.log("✅ Đã kiểm tra/cập nhật Thể loại.");

    // Lấy lại list Category để có ID chính xác
    const allCats = await Category.find();

    // 2. Danh sách truyện mẫu muốn thêm
    const productsData = [
      {
        name: "Naruto Tập 1",
        basePrice: 25000,
        stock: 100,
        categoryName: "Shounen",
        description: "Hành trình trở thành Hokage."
      },
      {
        name: "One Piece Tập 1",
        basePrice: 30000,
        stock: 50,
        categoryName: "Shounen",
        description: "Bắt đầu cuộc phiêu lưu."
      },
      {
        name: "Monster Tập 1",
        basePrice: 85000,
        stock: 20,
        categoryName: "Seinen",
        description: "Siêu phẩm trinh thám."
      }
    ];

    // 3. Bơm dữ liệu (Chỉ thêm nếu chưa có tên này trong DB)
    let count = 0;
    for (const p of productsData) {
      const exists = await Product.findOne({ name: p.name });
      
      if (!exists) {
        const catObj = allCats.find(c => c.name === p.categoryName);
        
        await Product.create({
          ...p,
          category: catObj ? catObj._id : null,
          slug: slugify(p.name, { lower: true, strict: true }) + "-" + Date.now(),
          images: [{ url: "https://placehold.co/400x600/111/c9a84c?text=MANGA+COVER", isPrimary: true }],
          status: "active"
        });
        count++;
      }
    }

    console.log(`🚀 HOÀN TẤT: Đã thêm mới ${count} truyện. Giữ nguyên các truyện cũ.`);
    process.exit();
  } catch (error) {
    console.error("❌ Lỗi Seed:", error);
    process.exit(1);
  }
};

seedData();