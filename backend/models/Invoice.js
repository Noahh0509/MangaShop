import mongoose from "mongoose";

// --- Sub-schema: từng dòng sản phẩm trong hóa đơn ---
const orderItemSchema = new mongoose.Schema(
  {
    product: {
      // Đã sửa từ manga thành product
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product", // Đã sửa từ Manga thành Product
      required: true,
    },
    title: { type: String, required: true }, // snapshot tên tại thời điểm mua
    coverImage: { type: String }, // snapshot ảnh bìa
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true }, // giá gốc 1 cuốn
    subtotal: { type: Number, required: true }, // quantity * unitPrice
  },
  { _id: false },
);

// --- Sub-schema: địa chỉ giao hàng ---
const shippingAddressSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true },
    phone: { type: String, required: true },
    province: { type: String, required: true },
    district: { type: String, required: true },
    ward: { type: String, required: true },
    street: { type: String, required: true },
    note: { type: String, default: "" },
  },
  { _id: false },
);

// --- Sub-schema: thông tin thanh toán ---
const paymentSchema = new mongoose.Schema(
  {
    method: {
      type: String,
      enum: ["COD", "MOMO", "VNPAY", "ZALOPAY", "BANK_TRANSFER", "CREDIT_CARD"],
      required: true,
    },
    status: {
      type: String,
      enum: ["PENDING", "PAID", "FAILED", "REFUNDED"],
      default: "PENDING",
    },
    transactionId: { type: String, default: null }, // mã giao dịch từ cổng thanh toán
    paidAt: { type: Date, default: null },
  },
  { _id: false },
);

// --- Main schema: Hóa đơn ---
const invoiceSchema = new mongoose.Schema(
  {
    invoiceCode: {
      type: String,
      unique: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    items: {
      type: [orderItemSchema],
      validate: [(arr) => arr.length > 0, "Hóa đơn phải có ít nhất 1 sản phẩm"],
    },
    shippingAddress: {
      type: shippingAddressSchema,
      required: true,
    },
    payment: {
      type: paymentSchema,
      required: true,
    },

    // --- Giá tiền ---
    subtotal: { type: Number, required: true }, // tổng trước giảm giá
    shippingFee: { type: Number, default: 0 },
    discount: { type: Number, default: 0 }, // giảm từ coupon / khuyến mãi
    totalAmount: { type: Number, required: true }, // số tiền khách thực trả

    couponCode: { type: String, default: null },

    // --- Trạng thái đơn hàng ---
    status: {
      type: String,
      enum: [
        "PENDING", // Chờ xác nhận
        "CONFIRMED", // Đã xác nhận
        "PREPARING", // Đang đóng gói
        "SHIPPING", // Đang giao hàng
        "DELIVERED", // Giao thành công
        "CANCELLED", // Đã hủy
        "RETURNED", // Trả hàng
      ],
      default: "PENDING",
    },

    cancelReason: { type: String, default: null },
    cancelledAt: { type: Date, default: null },

    statusHistory: [
      {
        status: { type: String },
        changedAt: { type: Date, default: Date.now },
        note: { type: String, default: "" },
      },
    ],
  },
  {
    timestamps: true,
  },
);

// --- Tự sinh invoiceCode trước khi save ---
invoiceSchema.pre("save", async function (next) {
  if (!this.invoiceCode) {
    const date = new Date();
    const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
    const count = await mongoose.model("Invoice").countDocuments({
      createdAt: {
        $gte: new Date(date.setHours(0, 0, 0, 0)),
        $lt: new Date(date.setHours(23, 59, 59, 999)),
      },
    });
    this.invoiceCode = `INV-${dateStr}-${String(count + 1).padStart(6, "0")}`;
  }
});

// --- Method: cập nhật trạng thái đơn hàng ---
invoiceSchema.methods.updateStatus = function (newStatus, note = "") {
  this.status = newStatus;
  this.statusHistory.push({ status: newStatus, note });
  if (newStatus === "CANCELLED") {
    this.cancelReason = note;
    this.cancelledAt = new Date();
  }
  return this.save();
};

// --- Static: lấy doanh thu ---
invoiceSchema.statics.getRevenue = function (from, to) {
  return this.aggregate([
    {
      $match: {
        status: "DELIVERED",
        createdAt: { $gte: new Date(from), $lte: new Date(to) },
      },
    },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: "$totalAmount" },
        totalOrders: { $sum: 1 },
      },
    },
  ]);
};

// --- Index ---
invoiceSchema.index({ user: 1, createdAt: -1 });
invoiceSchema.index({ status: 1 });

const Invoice = mongoose.model("Invoice", invoiceSchema);
export default Invoice; // Đã sửa sang export default chuẩn ES Module
