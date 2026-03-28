import Cart from "../models/Cart.js";
import Product from "../models/Product.js";

// 1. Lấy giỏ hàng (Read)
export const getCart = async (req, res) => {
  try {
    // Tìm giỏ và populate thông tin sản phẩm để hiển thị lên giao diện
    let cart = await Cart.findOne({ user: req.user._id }).populate(
      "items.product",
      "name slug images basePrice salePrice stock status",
    );

    if (cart && cart.items.length > 0) {
      // 1. Lọc rác (Giữ nguyên như nãy)
      const validItems = cart.items.filter(item => item.product !== null);

      // 2. 🎯 NẾU CÓ RÁC THÌ TÍNH LẠI TỔNG NGAY TẠI ĐÂY
      if (validItems.length !== cart.items.length) {
        cart.items = validItems;

        // Tính lại tổng tiền và số lượng để Frontend hiện đúng
        cart.totalPrice = validItems.reduce((total, item) => total + (item.price * item.quantity), 0);
        cart.totalItems = validItems.reduce((total, item) => total + item.quantity, 0);

        await cart.save(); // Lưu lại bản "sạch" vào DB
      }
    }

    // Nếu khách chưa có giỏ, tạo mới một cái rỗng
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

// 2. Thêm sản phẩm vào giỏ (Create)
export const addToCart = async (req, res) => {
  try {
    const { productId, quantity = 1 } = req.body;

    // Kiểm tra sản phẩm có tồn tại và còn hàng không bằng method có sẵn trong Product.js
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

    // Tận dụng Virtual 'displayPrice' để lấy giá đúng (giá sale hoặc giá gốc)
    // Tận dụng Method 'addItem' để tự động xử lý trùng lặp và save
    await cart.addItem(productId, product.displayPrice, quantity);

    res
      .status(200)
      .json({ success: true, message: "Đã thêm vào giỏ hàng", cart });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Lỗi khi thêm vào giỏ hàng", error: error.message });
  }
};

// 3. Cập nhật số lượng (Update)
// Cập nhật hàm updateCartItem
export const updateCartItem = async (req, res) => {
  try {
    const { productId, quantity } = req.body;

    if (quantity < 0) {
      return res.status(400).json({ message: "Số lượng không hợp lệ." });
    }

    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart)
      return res.status(404).json({ message: "Không tìm thấy giỏ hàng." });

    const itemIndex = cart.items.findIndex(
      (p) => p.product.toString() === productId,
    );

    if (itemIndex > -1) {
      if (quantity === 0) {
        cart.items.splice(itemIndex, 1);
      } else {
        cart.items[itemIndex].quantity = quantity;
      }

      await cart.save();

      // QUAN TRỌNG: Phải populate lại trước khi gửi về FE
      // để FE có dữ liệu product.name, images... để hiển thị
      const updatedCart = await Cart.findById(cart._id).populate(
        "items.product",
        "name slug images basePrice salePrice stock status",
      );

      return res.status(200).json({ success: true, cart: updatedCart });
    }

    res.status(404).json({ message: "Sản phẩm không có trong giỏ hàng." });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Lỗi cập nhật giỏ hàng", error: error.message });
  }
};

// 4. Xóa 1 sản phẩm khỏi giỏ (Delete)
export const removeFromCart = async (req, res) => {
  try {
    const { productId } = req.params;
    const cart = await Cart.findOne({ user: req.user._id });

    if (cart) {
      // 1. Xóa sản phẩm ra khỏi mảng (Code cũ của sếp)
      cart.items = cart.items.filter(item => item.product.toString() !== productId);

      // 2. 🚀 THÊM ĐOẠN NÀY: Quét sạch rác (null) thêm một lần nữa cho chắc
      // Populate lại để kiểm tra xem có ông nào bị xóa khỏi DB không
      await cart.populate("items.product");
      cart.items = cart.items.filter(item => item.product !== null);

      // 3. Tính lại tổng tiền/số lượng (Nếu sếp có dùng các trường này)
      cart.totalPrice = cart.items.reduce((total, item) => total + (item.price * item.quantity), 0);
      cart.totalItems = cart.items.reduce((total, item) => total + item.quantity, 0);

      await cart.save();
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

// 5. Làm trống giỏ hàng (Delete All)
export const clearAllCart = async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user._id });
    if (cart) {
      // Tận dụng Method 'clearCart' trong Cart.js
      await cart.clearCart();
    }
    res
      .status(200)
      .json({ success: true, message: "Giỏ hàng đã được làm trống" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Lỗi khi dọn dẹp giỏ hàng", error: error.message });
  }
};
