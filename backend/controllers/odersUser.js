import Invoice from "../models/Invoice.js";
import Product from "../models/Product.js";

export const getMyOrders = async (req, res) => {
  try {
    const userId = req.user._id;

    const orders = await Invoice.find({ user: userId })
      .populate("items.product", "name images price")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      orders,
    });
  } catch (error) {
    console.error("Lỗi lấy đơn hàng:", error);
    res.status(500).json({ message: "Lỗi server" });
  }
};
export const confirmReceivedOrder = async (req, res) => {
  try {
    const { invoiceCode } = req.params;

    const invoice = await Invoice.findOne({ invoiceCode });

    if (!invoice) {
      return res.status(404).json({ message: "Không tìm thấy đơn hàng" });
    }

    // 🔥 CHECK QUYỀN
    if (invoice.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Không có quyền" });
    }

    // 🔥 CHẶN DOUBLE CLICK
    if (invoice.status === "DELIVERED") {
      return res.status(400).json({ message: "Đơn đã được xác nhận rồi" });
    }

    if (invoice.status !== "SHIPPING") {
      return res.status(400).json({
        message: "Chỉ có thể xác nhận khi đơn đang giao",
      });
    }

    await invoice.updateStatus("DELIVERED", "Khách đã nhận hàng");

    res.status(200).json({
      success: true,
      message: "Xác nhận nhận hàng thành công",
    });
  } catch (error) {
    console.error("Lỗi confirm:", error);
    res.status(500).json({ message: "Lỗi server" });
  }
};

export const rejectOrder = async (req, res) => {
  try {
    const { invoiceCode } = req.params;
    const { reason } = req.body;

    const invoice = await Invoice.findOne({ invoiceCode });

    if (!invoice) {
      return res.status(404).json({ message: "Không tìm thấy đơn hàng" });
    }

    // 🔐 CHECK QUYỀN
    if (invoice.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Không có quyền" });
    }

    // ❌ CHẶN DOUBLE
    if (invoice.status === "RETURNED") {
      return res.status(400).json({ message: "Đơn đã bị từ chối rồi" });
    }

    if (invoice.status !== "SHIPPING") {
      return res.status(400).json({
        message: "Chỉ có thể từ chối khi đang giao",
      });
    }

    await invoice.updateStatus(
      "RETURNED",
      reason || "Khách từ chối nhận hàng"
    );

    // 🔥 HOÀN LẠI KHO
    const bulkOps = invoice.items.map((item) => ({
      updateOne: {
        filter: { _id: item.product },
        update: {
          $inc: {
            stock: item.quantity,
            soldCount: -item.quantity,
          },
        },
      },
    }));

    await Product.bulkWrite(bulkOps);

    res.status(200).json({
      success: true,
      message: "Đã từ chối nhận hàng",
    });
  } catch (error) {
    console.error("Lỗi reject:", error);
    res.status(500).json({ message: "Lỗi server" });
  }
};