import axios from "axios";
import crypto from "crypto";
import Cart from "../models/Cart.js";
import Invoice from "../models/Invoice.js";
import Product from "../models/Product.js";

// =========================================================
// 1. TẠO ĐƠN HÀNG (Xử lý chung cho cả COD và khởi tạo MoMo)
// =========================================================
export const createOrder = async (req, res) => {
  try {
    const { shippingAddress, paymentMethod } = req.body;
    const userId = req.user._id;

    // 1. Lấy giỏ hàng
    const cart = await Cart.findOne({ user: userId }).populate("items.product");
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ message: "Giỏ hàng trống" });
    }

    // 2. Kiểm tra tồn kho
    for (const item of cart.items) {
      if (item.product.stock < item.quantity) {
        return res.status(400).json({
          message: `Sản phẩm ${item.product.name} chỉ còn ${item.product.stock} cuốn.`,
        });
      }
    }

    // 3. Map dữ liệu sang Hóa đơn
    const orderItems = cart.items.map((item) => ({
      product: item.product._id,
      title: item.product.name,
      coverImage: item.product.images[0]?.url || "",
      quantity: item.quantity,
      unitPrice: item.price,
      subtotal: item.price * item.quantity,
    }));

    const finalAmount = cart.totalPrice + cart.discount; // Cộng phí ship vào đây nếu cần

    // 4. Luôn tạo Hóa đơn vào DB trước (trạng thái UNPAID hoặc PENDING)
    const newInvoice = new Invoice({
      user: userId,
      items: orderItems,
      shippingAddress,
      payment: {
        method: paymentMethod || "COD",
        status: "PENDING", // Sửa chỗ này: Khởi tạo luôn là PENDING cho mọi hình thức
      },
      subtotal: cart.totalPrice + cart.discount,
      discount: cart.discount,
      totalAmount: finalAmount,
    });

    await newInvoice.save();

    // ==========================================
    // RẼ NHÁNH: NẾU THANH TOÁN MOMO
    // ==========================================
    if (paymentMethod === "MOMO") {
      const partnerCode = process.env.MOMO_PARTNER_CODE;
      const accessKey = process.env.MOMO_ACCESS_KEY;
      const secretKey = process.env.MOMO_SECRET_KEY;
      const requestId = partnerCode + new Date().getTime();

      // Sử dụng chính invoiceCode làm orderId cho MoMo
      const orderId = newInvoice.invoiceCode;
      const orderInfo = `Thanh toán đơn hàng ${orderId} tại MangaShop`;

      const redirectUrl = `${process.env.CLIENT_URL}/payment-result`;
      const ipnUrl = `${process.env.SERVER_URL}/api/checkout/momo/callback`;
      const requestType = "captureWallet";
      const extraData = ""; // Không cần nhồi nhét data vì đã lưu Invoice ở DB

      // Tạo chữ ký
      const rawSignature = `accessKey=${accessKey}&amount=${finalAmount}&extraData=${extraData}&ipnUrl=${ipnUrl}&orderId=${orderId}&orderInfo=${orderInfo}&partnerCode=${partnerCode}&redirectUrl=${redirectUrl}&requestId=${requestId}&requestType=${requestType}`;
      const signature = crypto
        .createHmac("sha256", secretKey)
        .update(rawSignature)
        .digest("hex");

      const requestBody = {
        partnerCode,
        accessKey,
        requestId,
        amount: finalAmount.toString(),
        orderId,
        orderInfo,
        redirectUrl,
        ipnUrl,
        partnerName: "MangaShop",
        storeId: "MangaShopStore",
        extraData,
        requestType,
        signature,
        lang: "vi",
      };

      try {
        const result = await axios.post(
          "https://test-payment.momo.vn/v2/gateway/api/create",
          requestBody,
        );
        return res.status(200).json({
          success: true,
          paymentType: "MOMO",
          payUrl: result.data.payUrl,
        });
      } catch (error) {
        console.error("Lỗi tạo MoMo:", error?.response?.data || error.message);
        return res
          .status(500)
          .json({ message: "Lỗi kết nối cổng thanh toán MoMo" });
      }
    }

    // ==========================================
    // RẼ NHÁNH: NẾU THANH TOÁN COD
    // ==========================================
    await processSuccessfulOrder(newInvoice.invoiceCode); // Trừ tồn kho & Xóa giỏ

    return res.status(201).json({
      success: true,
      message: "Đặt hàng thành công",
      invoice: newInvoice,
    });
  } catch (error) {
    console.error("Lỗi tạo đơn:", error);
    res.status(500).json({ message: "Lỗi hệ thống khi tạo đơn hàng" });
  }
};

// =========================================================
// 2. CALLBACK MOMO (MoMo gọi ngầm về Server)
// =========================================================
export const momoCallback = async (req, res) => {
  try {
    const {
      partnerCode,
      orderId,
      requestId,
      amount,
      orderInfo,
      orderType,
      transId,
      resultCode,
      message,
      payType,
      responseTime,
      extraData,
      signature,
    } = req.body;

    const accessKey = process.env.MOMO_ACCESS_KEY;
    const secretKey = process.env.MOMO_SECRET_KEY;

    // Kiểm tra chữ ký bảo mật
    const rawSignature = `accessKey=${accessKey}&amount=${amount}&extraData=${extraData}&message=${message}&orderId=${orderId}&orderInfo=${orderInfo}&orderType=${orderType}&partnerCode=${partnerCode}&payType=${payType}&requestId=${requestId}&responseTime=${responseTime}&resultCode=${resultCode}&transId=${transId}`;
    const expectedSignature = crypto
      .createHmac("sha256", secretKey)
      .update(rawSignature)
      .digest("hex");

    if (signature !== expectedSignature) {
      return res.status(400).json({ message: "Chữ ký không hợp lệ" });
    }

    // Nếu thanh toán thành công
    if (resultCode === 0) {
      await processSuccessfulOrder(orderId, transId);
    } else {
      // Nếu hủy hoặc thất bại
      const invoice = await Invoice.findOne({ invoiceCode: orderId });
      if (invoice && invoice.payment.status === "PENDING") {
        invoice.payment.status = "FAILED";
        invoice.status = "CANCELLED";
        invoice.cancelReason = message;
        await invoice.save();
      }
    }

    return res.status(204).json({});
  } catch (error) {
    console.error("Lỗi Callback MoMo:", error);
    return res.status(500).json({ message: "Lỗi xử lý IPN" });
  }
};

// =========================================================
// 3. CHECK STATUS (FE gọi để kiểm tra thủ công nếu Webhook lỗi)
// =========================================================
export const checkMomoTransactionStatus = async (req, res) => {
  try {
    const { orderId } = req.body;
    if (!orderId)
      return res.status(400).json({ message: "Thiếu orderId (mã hóa đơn)" });

    const partnerCode = process.env.MOMO_PARTNER_CODE;
    const accessKey = process.env.MOMO_ACCESS_KEY;
    const secretKey = process.env.MOMO_SECRET_KEY;
    const requestId = partnerCode + new Date().getTime();

    const rawSignature = `accessKey=${accessKey}&orderId=${orderId}&partnerCode=${partnerCode}&requestId=${requestId}`;
    const signature = crypto
      .createHmac("sha256", secretKey)
      .update(rawSignature)
      .digest("hex");

    const requestBody = {
      partnerCode,
      accessKey,
      requestId,
      orderId,
      signature,
      lang: "vi",
    };
    const result = await axios.post(
      "https://test-payment.momo.vn/v2/gateway/api/query",
      requestBody,
    );

    const { resultCode, transId } = result.data;

    const invoice = await Invoice.findOne({ invoiceCode: orderId });
    if (!invoice)
      return res.status(404).json({ message: "Không tìm thấy hóa đơn" });

    if (resultCode === 0) {
      await processSuccessfulOrder(orderId, transId);
      return res.status(200).json({ message: "Đã thanh toán", status: "PAID" });
    }

    return res.status(400).json({
      message: "Chưa thanh toán hoặc thất bại",
      status: invoice.payment.status,
    });
  } catch (error) {
    console.error("Lỗi Check Status:", error?.response?.data || error.message);
    res.status(500).json({ message: "Lỗi kiểm tra trạng thái giao dịch" });
  }
};

// =========================================================
// HELPER: XỬ LÝ LOGIC KHI ĐƠN HÀNG THÀNH CÔNG (DÙNG CHUNG)
// =========================================================
const processSuccessfulOrder = async (invoiceCode, transId = null, resultCode = 0) => {
  const invoice = await Invoice.findOne({ invoiceCode });

  // 🛡️ 1. Chống lỗi & Chống cộng dồn (Idempotency)
  // Nếu không thấy đơn hoặc đơn đã thanh toán/đã hủy rồi thì không làm gì nữa
  if (!invoice || invoice.payment.status === "PAID" || invoice.status === "CANCELLED") {
    return invoice;
  }

  try {
    // 🎯 2. KIỂM TRA KẾT QUẢ TỪ MOMO
    // resultCode === 0 (hoặc "0") là thành công rực rỡ
    const isSuccess = Number(resultCode) === 0;

    if (!isSuccess) {
      // ❌ TRƯỜNG HỢP THANH TOÁN THẤT BẠI / KHÁCH BẤM HỦY TRÊN MOMO
      invoice.payment.status = "FAILED";
      invoice.status = "CANCELLED"; // Sếp muốn nó về CANCELLED nè
      if (transId) invoice.payment.transactionId = transId;
      await invoice.save();
      
      console.log(`⚠️ Hóa đơn ${invoiceCode} đã bị HỦY do thanh toán thất bại (Mã lỗi: ${resultCode})`);
      return invoice;
    }

    // ✅ 3. TRƯỜNG HỢP THANH TOÁN THÀNH CÔNG
    // Cập nhật trạng thái thanh toán
    invoice.payment.status = "PAID";
    if (transId) invoice.payment.transactionId = transId;
    invoice.payment.paidAt = new Date();
    
    // Đơn hàng chuyển sang PENDING để Admin duyệt giao hàng
    invoice.status = "PENDING"; 
    await invoice.save();

    // 🚀 4. TRỪ TỒN KHO & TĂNG LƯỢT BÁN (Chỉ chạy khi thành công)
    const bulkOps = invoice.items.map((item) => ({
      updateOne: {
        filter: { _id: item.product },
        update: { $inc: { stock: -item.quantity, soldCount: item.quantity } },
      },
    }));
    await Product.bulkWrite(bulkOps);

    // 🛒 5. LÀM TRỐNG GIỎ HÀNG
    await Cart.findOneAndDelete({ user: invoice.user });

    console.log(`✅ Hóa đơn ${invoiceCode} xử lý THÀNH CÔNG -> Chuyển trạng thái: PENDING`);
    return invoice;

  } catch (error) {
    console.error("❌ Lỗi processSuccessfulOrder:", error);
    throw error;
  }
};
