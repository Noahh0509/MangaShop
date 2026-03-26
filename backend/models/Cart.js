import mongoose from "mongoose";

const cartItemSchema = new mongoose.Schema(
  {
    product: {
      // Sửa từ manga -> product để khớp với Product.js
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: [1, "Số lượng phải ít nhất là 1"],
      default: 1,
    },
    price: {
      type: Number,
      required: true,
    },
  },
  { _id: false },
);

const cartSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    items: [cartItemSchema],
    totalPrice: { type: Number, default: 0 },
    totalItems: { type: Number, default: 0 },
    couponCode: { type: String, default: null },
    discount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

// Tự động tính tổng tiền & tổng số lượng trước khi save
cartSchema.pre("save", function () {
  this.totalItems = this.items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = this.items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );
  this.totalPrice = subtotal - this.discount;
});

// Method: Thêm sản phẩm vào giỏ
cartSchema.methods.addItem = function (productId, price, quantity = 1) {
  const existingItem = this.items.find(
    (item) => item.product.toString() === productId.toString(),
  );
  if (existingItem) {
    existingItem.quantity += quantity;
  } else {
    this.items.push({ product: productId, price, quantity });
  }
  return this.save();
};

// Method: Xóa sản phẩm khỏi giỏ
cartSchema.methods.removeItem = function (productId) {
  this.items = this.items.filter(
    (item) => item.product.toString() !== productId.toString(),
  );
  return this.save();
};

// Method: Xóa toàn bộ giỏ hàng
cartSchema.methods.clearCart = function () {
  this.items = [];
  this.couponCode = null;
  this.discount = 0;
  return this.save();
};

const Cart = mongoose.model("Cart", cartSchema);
export default Cart;
