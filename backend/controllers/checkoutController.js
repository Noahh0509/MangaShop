import Cart from "../models/Cart.js";
// Nhớ đổi Invoice.js của bạn sang ES Module (export default Invoice) và đổi 'manga' -> 'product' nhé
import Invoice from "../models/Invoice.js";

export const createOrder = async (req, res) => {
  try {
    const { shippingAddress, paymentMethod } = req.body;
    const userId = req.user._id;

    // 1. Lấy giỏ hàng
    const cart = await Cart.findOne({ user: userId }).populate("items.product");
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ message: "Giỏ hàng trống" });
    }

    // 2. Map dữ liệu từ Cart sang cấu trúc Invoice items
    const orderItems = cart.items.map((item) => ({
      product: item.product._id, // Nếu bạn giữ chữ 'manga' trong Invoice thì đổi key này thành 'manga'
      title: item.product.name,
      coverImage: item.product.images[0]?.url || "",
      quantity: item.quantity,
      unitPrice: item.price,
      subtotal: item.price * item.quantity,
    }));

    // 3. Tạo hóa đơn
    const newInvoice = new Invoice({
      user: userId,
      items: orderItems,
      shippingAddress,
      payment: {
        method: paymentMethod || "COD",
        status: "PENDING",
      },
      subtotal: cart.totalPrice + cart.discount, // Tổng trước giảm
      discount: cart.discount,
      totalAmount: cart.totalPrice, // Có thể cộng thêm shippingFee nếu cần
      couponCode: cart.couponCode,
    });

    await newInvoice.save();

    // 4. Xóa giỏ hàng sau khi đặt thành công
    await cart.clearCart();

    // 5. Rẽ nhánh thanh toán (MoMo sẽ xử lý ở đây)
    if (paymentMethod === "MOMO") {
      // TODO: Gọi API MoMo tạo link thanh toán và trả về cho client
      return res.status(200).json({
        success: true,
        message: "Chờ thanh toán MoMo (Đang phát triển)",
        invoice: newInvoice,
      });
    }

    res
      .status(201)
      .json({
        success: true,
        message: "Đặt hàng thành công",
        invoice: newInvoice,
      });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Lỗi khi tạo đơn hàng", error: error.message });
  }
};
