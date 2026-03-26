import "dotenv/config";
import mongoose from "mongoose";
import { connectDB } from "./config/db.js";

// Import toàn bộ Models (Đảm bảo tất cả đều đã là ES Modules: export default)
import User from "./models/User.js";
import Category from "./models/Category.js";
import Product from "./models/Product.js";
import Promotion from "./models/Promotion.js";
import Cart from "./models/Cart.js";
import Invoice from "./models/Invoice.js";
import ChatSession from "./models/Chat.js";

const seedDatabase = async () => {
  try {
    await connectDB();
    console.log("⏳ Đang dọn dẹp và nạp dữ liệu mẫu MangaShop...");

    // Xóa index cũ để tránh lỗi E11000 Duplicate Key do thay đổi schema
    await Product.collection.dropIndexes().catch(() => {});
    await Promotion.collection.dropIndexes().catch(() => {});

    // ─── 1. TẠO USERS (Admin & Khách hàng) ──────────────────────────────────
    // Xóa user cũ để tạo lại nhằm kích hoạt hash password
    await User.deleteMany({
      email: { $in: ["admin@mangashop.vn", "phong@gmail.com"] },
    });

    const adminUser = await new User({
      username: "admin_mangashop",
      email: "admin@mangashop.vn",
      password: "password123",
      fullName: "Admin System",
      role: "admin",
    }).save();

    const customerUser = await new User({
      username: "thanhphong",
      email: "phong@gmail.com",
      password: "password123",
      fullName: "Đỗ Thanh Phong",
      phone: "0901234567",
      address: {
        province: "Hồ Chí Minh",
        district: "Quận 1",
        ward: "Phường Bến Nghé",
        street: "123 Đường Lê Lợi",
      },
      role: "customer",
    }).save();
    console.log("✅ Đã tạo Users (Admin & Customer).");

    // ─── 2. TẠO CATEGORIES ──────────────────────────────────────────────────
    const catShounen = await Category.findOneAndUpdate(
      { slug: "shounen" },
      {
        name: "Shounen",
        slug: "shounen",
        description: "Truyện tranh hành động thiếu niên",
      },
      { upsert: true, new: true },
    );
    console.log("✅ Đã tạo Categories.");

    // ─── 3. TẠO PRODUCTS ────────────────────────────────────────────────────
    const productsData = [
      {
        name: "Naruto Tập 1 - Uzumaki Naruto",
        slug: "naruto-tap-1",
        category: catShounen._id,
        basePrice: 25000,
        salePrice: 20000, // Đang giảm giá trực tiếp
        stock: 100,
        status: "active",
        images: [{ url: "https://example.com/naruto1.jpg", isPrimary: true }],
      },
      {
        name: "One Piece Tập 1 - Romance Dawn",
        slug: "one-piece-tap-1",
        category: catShounen._id,
        basePrice: 25000,
        salePrice: 25000,
        stock: 50,
        status: "active",
        images: [{ url: "https://example.com/op1.jpg", isPrimary: true }],
      },
    ];

    const insertedProducts = [];
    for (const p of productsData) {
      const prod = await Product.findOneAndUpdate({ slug: p.slug }, p, {
        upsert: true,
        new: true,
      });
      insertedProducts.push(prod);
    }
    const [naruto, onePiece] = insertedProducts;
    console.log("✅ Đã tạo Products.");

    // ─── 4. TẠO PROMOTIONS (Mã giảm giá) ────────────────────────────────────
    await Promotion.deleteMany({ code: "GIAM10K" });
    const promo = await Promotion.create({
      name: "Giảm 10K cho fan One Piece",
      code: "GIAM10K",
      discountType: "fixed",
      discountValue: 10000,
      applyTo: "products",
      applicableProducts: [onePiece._id], // Chỉ áp dụng cho One Piece
      startDate: new Date(Date.now() - 86400000), // Hôm qua
      endDate: new Date(Date.now() + 86400000 * 30), // 30 ngày tới
      usageLimit: 100,
      status: "active",
      createdBy: adminUser._id,
    });
    console.log("✅ Đã tạo Promotions.");

    // ─── 5. TẠO GIỎ HÀNG (Cart) ─────────────────────────────────────────────
    await Cart.findOneAndDelete({ user: customerUser._id });
    const cart = new Cart({
      user: customerUser._id,
      items: [
        { product: naruto._id, quantity: 2, price: naruto.salePrice },
        { product: onePiece._id, quantity: 1, price: onePiece.basePrice },
      ],
      couponCode: promo.code,
      discount: 10000, // App mã GIAM10K
    });
    await cart.save(); // pre('save') sẽ tự tính totalPrice và totalItems
    console.log("✅ Đã tạo Giỏ hàng mẫu.");

    // ─── 6. TẠO HÓA ĐƠN (Invoice) ───────────────────────────────────────────
    await Invoice.deleteMany({ user: customerUser._id });
    const invoice = new Invoice({
      user: customerUser._id,
      items: [
        {
          product: naruto._id,
          title: naruto.name,
          quantity: 1,
          unitPrice: naruto.salePrice,
          subtotal: naruto.salePrice * 1,
        },
      ],
      shippingAddress: {
        fullName: customerUser.fullName,
        phone: customerUser.phone,
        province: customerUser.address.province,
        district: customerUser.address.district,
        ward: customerUser.address.ward,
        street: customerUser.address.street,
      },
      payment: {
        method: "COD",
        status: "PENDING",
      },
      subtotal: 20000,
      shippingFee: 15000,
      discount: 0,
      totalAmount: 35000, // (20k + 15k ship)
      status: "CONFIRMED",
    });
    await invoice.save(); // pre('save') tự sinh invoiceCode
    console.log("✅ Đã tạo Hóa đơn (Order) mẫu.");

    // ─── 7. TẠO PHIÊN CHAT ──────────────────────────────────────────────────
    await ChatSession.deleteMany({ user: customerUser._id });
    const chatSession = new ChatSession({
      user: customerUser._id,
      sessionType: "LIVE_SUPPORT",
      topic: "ORDER_INQUIRY",
      assignedStaff: adminUser._id,
      status: "ACTIVE",
      messages: [
        {
          role: "user",
          content:
            "Admin ơi cho mình hỏi đơn hàng của mình bao giờ giao tới nơi?",
        },
        {
          role: "staff",
          content:
            "Chào bạn, đơn hàng của bạn đang được đóng gói và sẽ giao cho đơn vị vận chuyển trong chiều nay nhé!",
        },
      ],
    });
    await chatSession.save();
    console.log("✅ Đã tạo Phiên Chat mẫu.");

    console.log("------------------------------------------------");
    console.log("🎉 SEED DỮ LIỆU THÀNH CÔNG TẤT CẢ MODULES!");
    console.log("Tài khoản test (Khách mua hàng):");
    console.log(" - Email: phong@gmail.com");
    console.log(" - Password: password123");
    console.log("Tài khoản test (Admin/Staff):");
    console.log(" - Email: admin@mangashop.vn");
    console.log(" - Password: password123");
    console.log("Mã giảm giá để test: GIAM10K");
    console.log("------------------------------------------------");

    process.exit(0);
  } catch (error) {
    console.error("❌ Lỗi khi seed dữ liệu:", error);
    process.exit(1);
  }
};

seedDatabase();
