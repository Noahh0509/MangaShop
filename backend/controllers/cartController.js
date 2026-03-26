import Cart from "../models/Cart.js";
import Product from "../models/Product.js";

// 1. Lấy giỏ hàng của user
export const getCart = async (req, res) => {
  try {
    let cart = await Cart.findOne({ user: req.user._id }).populate(
      "items.product",
      "name images displayPrice",
    );
    if (!cart) {
      cart = await Cart.create({ user: req.user._id, items: [] });
    }
    res.status(200).json({ success: true, cart });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Lỗi khi lấy giỏ hàng", error: error.message });
  }
};

// 2. Thêm sản phẩm vào giỏ
export const addToCart = async (req, res) => {
  try {
    const { productId, quantity } = req.body;

    const product = await Product.findById(productId);
    if (!product || !product.isAvailable()) {
      return res
        .status(404)
        .json({ message: "Sản phẩm không tồn tại hoặc đã hết hàng" });
    }

    let cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      cart = new Cart({ user: req.user._id, items: [] });
    }

    // Dùng displayPrice (giá đã sale nếu có) từ virtual của Product.js
    await cart.addItem(productId, product.displayPrice, quantity || 1);

    res
      .status(200)
      .json({ success: true, message: "Đã thêm vào giỏ hàng", cart });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Lỗi khi thêm vào giỏ hàng", error: error.message });
  }
};

// 3. Cập nhật số lượng 1 sản phẩm
export const updateCartItem = async (req, res) => {
  try {
    const { productId, quantity } = req.body;
    if (quantity < 1)
      return res.status(400).json({ message: "Số lượng không hợp lệ" });

    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart)
      return res.status(404).json({ message: "Không tìm thấy giỏ hàng" });

    const itemIndex = cart.items.findIndex(
      (p) => p.product.toString() === productId,
    );
    if (itemIndex > -1) {
      cart.items[itemIndex].quantity = quantity;
      await cart.save();
      return res.status(200).json({ success: true, cart });
    }
    res.status(404).json({ message: "Sản phẩm không có trong giỏ hàng" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Lỗi cập nhật giỏ hàng", error: error.message });
  }
};

// 4. Xóa 1 sản phẩm khỏi giỏ
export const removeFromCart = async (req, res) => {
  try {
    const { productId } = req.params;
    const cart = await Cart.findOne({ user: req.user._id });

    if (cart) {
      await cart.removeItem(productId);
    }
    res
      .status(200)
      .json({ success: true, message: "Đã xóa sản phẩm khỏi giỏ", cart });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Lỗi khi xóa sản phẩm", error: error.message });
  }
};
