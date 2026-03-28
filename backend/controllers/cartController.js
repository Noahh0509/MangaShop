import Cart from "../models/Cart.js";
import Product from "../models/Product.js";

// 1. Lấy giỏ hàng (Read)
export const getCart = async (req, res) => {
  try {
    let cart = await Cart.findOne({ user: req.user._id }).populate(
      "items.product",
      "name slug images basePrice salePrice stock status"
    );

    // Nếu khách chưa có giỏ, tạo mới rỗng
    if (!cart) {
      cart = await Cart.create({ user: req.user._id, items: [] });
      return res.status(200).json({ success: true, cart });
    }

    // Kiểm tra và dọn dẹp sản phẩm rác (đã bị xóa khỏi DB)
    const originalLength = cart.items.length;
    cart.items = cart.items.filter(item => item.product !== null);

    // Nếu có rác, lưu lại bản sạch
    if (cart.items.length !== originalLength) {
      await cart.save(); 
    }

    res.status(200).json({ success: true, cart });
  } catch (error) {
    res.status(500).json({ message: "Lỗi khi lấy giỏ hàng", error: error.message });
  }
};

// 2. Thêm sản phẩm vào giỏ (Create)
export const addToCart = async (req, res) => {
  try {
    const { productId, quantity = 1 } = req.body;

    const product = await Product.findById(productId);
    if (!product || !product.isAvailable()) {
      return res.status(404).json({ message: "Sản phẩm không tồn tại hoặc đã hết hàng" });
    }

    let cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      cart = new Cart({ user: req.user._id, items: [] });
    }

    // SỬ DỤNG METHOD: addItem đã bao gồm logic check trùng và tính lại tổng
    await cart.addItem(productId, product.displayPrice, quantity);

    // Populate để trả về FE hiển thị ngay
    const updatedCart = await Cart.findById(cart._id).populate(
      "items.product",
      "name slug images basePrice salePrice stock status"
    );

    res.status(200).json({ success: true, message: "Đã thêm vào giỏ hàng", cart: updatedCart });
  } catch (error) {
    res.status(500).json({ message: "Lỗi khi thêm vào giỏ hàng", error: error.message });
  }
};

// 3. Cập nhật số lượng (Update)
export const updateCartItem = async (req, res) => {
  try {
    const { productId, quantity } = req.body;

    if (quantity < 0) return res.status(400).json({ message: "Số lượng không hợp lệ." });

    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) return res.status(404).json({ message: "Không tìm thấy giỏ hàng." });

    const itemIndex = cart.items.findIndex(p => p.product.toString() === productId);

    if (itemIndex > -1) {
      if (quantity === 0) {
        cart.items.splice(itemIndex, 1);
      } else {
        cart.items[itemIndex].quantity = quantity;
      }

      // Lưu để middleware tính lại tổng tiền tự động (nếu có trong Schema)
      await cart.save();

      const updatedCart = await Cart.findById(cart._id).populate(
        "items.product",
        "name slug images basePrice salePrice stock status"
      );

      return res.status(200).json({ success: true, cart: updatedCart });
    }

    res.status(404).json({ message: "Sản phẩm không có trong giỏ hàng." });
  } catch (error) {
    res.status(500).json({ message: "Lỗi cập nhật giỏ hàng", error: error.message });
  }
};

// 4. Xóa 1 sản phẩm khỏi giỏ (Delete)
export const removeFromCart = async (req, res) => {
  try {
    const { productId } = req.params;
    const cart = await Cart.findOne({ user: req.user._id });

    if (!cart) return res.status(404).json({ message: "Giỏ hàng rỗng" });

    // SỬ DỤNG METHOD: removeItem (đảm bảo method này đã có trong Cart.js của bạn)
    await cart.removeItem(productId);

    const updatedCart = await Cart.findById(cart._id).populate(
      "items.product",
      "name slug images basePrice salePrice stock status"
    );
    
    res.status(200).json({ success: true, message: "Đã xóa sản phẩm", cart: updatedCart });
  } catch (error) {
    res.status(500).json({ message: "Lỗi khi xóa sản phẩm", error: error.message });
  }
};

// 5. Làm trống giỏ hàng (Delete All)
export const clearAllCart = async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user._id });
    if (cart) {
      await cart.clearCart(); // SỬ DỤNG METHOD TRONG MODEL
    }
    res.status(200).json({ success: true, message: "Giỏ hàng đã được làm trống" });
  } catch (error) {
    res.status(500).json({ message: "Lỗi khi dọn dẹp giỏ hàng", error: error.message });
  }
};