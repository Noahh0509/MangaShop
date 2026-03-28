import Cart from "../models/Cart.js";
import Product from "../models/Product.js";
import Promotion from "../models/Promotion.js";

// ─── HÀM HELPER: ĐI QUA PROMOTION ĐỂ TRỪ TIỀN ĐỘNG (CÓ LOG CHI TIẾT) ───
const getCalculatedPrice = async (product) => {
  let currentPrice = product.basePrice;
  if (!currentPrice) return 0;

  console.log(`\n======================================================`);
  console.log(`[BƯỚC 1] BẮT ĐẦU TÍNH GIÁ CHO SẢN PHẨM: ${product.name}`);
  console.log(`- ID Sản phẩm: ${product._id}`);
  console.log(`- Giá gốc (basePrice): ${product.basePrice}`);
  console.log(`- Category ID: ${product.category || "Không có"}`);

  try {
    const promotions = await Promotion.findForProduct(
      product._id,
      product.category,
    );

    console.log(
      `[BƯỚC 2] SỐ KHUYẾN MÃI TÌM THẤY TRONG DB: ${promotions.length}`,
    );
    if (promotions.length > 0) {
      promotions.forEach((p, index) => {
        console.log(
          `  + KM ${index + 1}: '${p.name}' | Type: ${p.discountType} | isAutoApply: ${p.isAutoApply}`,
        );
      });
    }

    const validPromo = promotions.find(
      (p) =>
        p.isAutoApply || p.discountType === Promotion.DISCOUNT_TYPE.FLASH_SALE,
    );

    if (validPromo) {
      console.log(
        `[BƯỚC 3] ĐÃ CHỌN ĐƯỢC KM HỢP LỆ ĐỂ ÁP DỤNG: '${validPromo.name}'`,
      );

      const result = validPromo.calculateDiscount(
        product.basePrice,
        1,
        product._id,
      );

      console.log(`[BƯỚC 4] KẾT QUẢ SAU KHI CHẠY HÀM calculateDiscount:`);
      console.log(
        `  - Tiền được giảm (discountAmount): ${result.discountAmount}`,
      );
      console.log(`  - Giá chốt sau cùng (finalPrice): ${result.finalPrice}`);

      currentPrice = result.finalPrice;
    } else {
      console.log(
        `[BƯỚC 3] KHÔNG TÌM THẤY KM (Lý do: Số lượng KM = 0, hoặc KM chưa bật isAutoApply, hoặc không phải Flash Sale)`,
      );
    }
  } catch (error) {
    console.error(
      "[LỖI NGHIÊM TRỌNG] Lỗi khi tính giá KM từ Promotion:",
      error,
    );
  }

  console.log(
    `[BƯỚC 5] -> GIÁ CUỐI CÙNG LƯU VÀO GIỎ HÀNG SẼ LÀ: ${currentPrice}`,
  );
  console.log(`======================================================\n`);

  return currentPrice;
};

// ─── 1. Lấy giỏ hàng (Read) ──────────────────────────────────────
export const getCart = async (req, res) => {
  try {
    let cart = await Cart.findOne({ user: req.user._id }).populate(
      "items.product",
      "name slug images basePrice stock status category",
    );

    if (!cart) {
      cart = await Cart.create({ user: req.user._id, items: [] });
      return res.status(200).json({ success: true, cart });
    }

    let needsSave = false;

    // 1. Lọc rác (Xóa các SP đã bị xóa khỏi DB nhưng còn kẹt trong giỏ)
    const originalLength = cart.items.length;
    cart.items = cart.items.filter((item) => item.product !== null);
    if (cart.items.length !== originalLength) needsSave = true;

    // 2. Quét qua từng sản phẩm để tính lại giá động
    for (let item of cart.items) {
      if (item.product) {
        const currentPrice = await getCalculatedPrice(item.product);
        if (item.price !== currentPrice) {
          item.price = currentPrice;
          needsSave = true;
        }
      }
    }

    // 3. Lưu lại nếu có thay đổi (Model Cart sẽ tự động tính lại tổng)
    if (needsSave) {
      await cart.save();
    }

    // 4. Chuyển cart thành object tĩnh để gắn thêm thông tin hiển thị (Tên khuyến mãi)
    const cartResponse = cart.toObject();

    for (let item of cartResponse.items) {
      if (item.product && item.price < item.product.basePrice) {
        const promotions = await Promotion.findForProduct(
          item.product._id,
          item.product.category,
        );
        const validPromo = promotions.find(
          (p) =>
            p.isAutoApply ||
            p.discountType === Promotion.DISCOUNT_TYPE.FLASH_SALE,
        );

        item.promoName = validPromo ? validPromo.name : "Khuyến mãi đặc biệt";
      }
    }

    // Trả về cartResponse thay vì cart gốc
    res.status(200).json({ success: true, cart: cartResponse });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Lỗi khi lấy giỏ hàng", error: error.message });
  }
};

// ─── 2. Thêm sản phẩm vào giỏ (Create) ──────────────────────────
export const addToCart = async (req, res) => {
  try {
    const { productId, quantity = 1 } = req.body;

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

    const currentPrice = await getCalculatedPrice(product);
    await cart.addItem(productId, currentPrice, quantity);

    const updatedCart = await Cart.findById(cart._id).populate(
      "items.product",
      "name slug images basePrice stock status category",
    );

    res
      .status(200)
      .json({
        success: true,
        message: "Đã thêm vào giỏ hàng",
        cart: updatedCart,
      });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Lỗi khi thêm vào giỏ hàng", error: error.message });
  }
};

// ─── 3. Cập nhật số lượng (Update) ──────────────────────────────
export const updateCartItem = async (req, res) => {
  try {
    const { productId, quantity } = req.body;

    if (quantity < 0)
      return res.status(400).json({ message: "Số lượng không hợp lệ." });

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

        const productData = await Product.findById(productId);
        if (productData) {
          cart.items[itemIndex].price = await getCalculatedPrice(productData);
        }
      }

      await cart.save();

      const updatedCart = await Cart.findById(cart._id).populate(
        "items.product",
        "name slug images basePrice stock status category",
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

// ─── 4. Xóa 1 sản phẩm khỏi giỏ (Delete) ────────────────────────
export const removeFromCart = async (req, res) => {
  try {
    const { productId } = req.params;
    const cart = await Cart.findOne({ user: req.user._id });

    if (!cart) return res.status(404).json({ message: "Giỏ hàng rỗng" });

    await cart.removeItem(productId);

    const updatedCart = await Cart.findById(cart._id).populate(
      "items.product",
      "name slug images basePrice stock status category",
    );

    res
      .status(200)
      .json({ success: true, message: "Đã xóa sản phẩm", cart: updatedCart });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Lỗi khi xóa sản phẩm", error: error.message });
  }
};

// ─── 5. Làm trống giỏ hàng (Delete All) ─────────────────────────
export const clearAllCart = async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user._id });
    if (cart) {
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
