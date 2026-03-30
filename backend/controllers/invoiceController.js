import Invoice from "../models/Invoice.js";
import Product from "../models/Product.js";

const invoiceController = {
    // 1. Lấy danh sách đơn hàng PENDING (Dành cho trang chủ Panel)
    getPendingInvoices: async (req, res) => {
        try {
            // 🎯 Lấy cả đơn PENDING và PREPARING để sếp xử lý liên tục
            const invoices = await Invoice.find({
                status: { $in: ["PENDING", "PREPARING", "SHIPPING"] }
            })
                .populate("user", "name email")
                .sort("-updatedAt"); // Đơn nào vừa cập nhật (ví dụ sếp vừa bấm xác nhận) sẽ lên đầu

            res.status(200).json({ success: true, data: invoices });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    },

    // 2. Lấy CHI TIẾT một đơn hàng (Khi sếp bấm nút "Chi tiết")
    getInvoiceDetail: async (req, res) => {
        try {
            const { id } = req.params;
            const invoice = await Invoice.findById(id)
                .populate("user", "name email")
                .populate("items.product", "name image price"); // Lấy chi tiết từng cuốn Manga

            if (!invoice) {
                return res.status(404).json({ success: false, message: "Không tìm thấy hóa đơn!" });
            }

            res.status(200).json({ success: true, data: invoice });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    },

    // 3. Duyệt đơn hàng (Chuyển từ PENDING sang SHIPPING)
    // Trong invoiceController.js
    updateOrderStatus: async (req, res) => {
        try {
            const { id } = req.params;
            const { status } = req.body; // Frontend sẽ gửi status mới lên

            // Kiểm tra status gửi lên có nằm trong danh sách enum của sếp không
            const validStatus = ["PENDING", "CONFIRMED", "PREPARING", "SHIPPING", "DELIVERED", "CANCELLED", "RETURNED"];
            if (!validStatus.includes(status)) {
                return res.status(400).json({ success: false, message: "Status không hợp lệ!" });
            }

            const invoice = await Invoice.findByIdAndUpdate(id, { status }, { new: true });
            res.status(200).json({ success: true, message: `Đã chuyển đơn sang ${status}`, data: invoice });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    },

    // 4. Hủy đơn hàng (Và hoàn lại kho nếu cần)
    cancelOrder: async (req, res) => {
        try {
            const { id } = req.params;
            const { reason } = req.body; // Lý do hủy từ Admin

            const invoice = await Invoice.findById(id);
            if (!invoice) return res.status(404).json({ success: false, message: "Không thấy đơn!" });

            // Nếu đơn đã thanh toán hoặc đang chờ, mình hoàn lại kho cho chắc nhen sếp
            const bulkOps = invoice.items.map((item) => ({
                updateOne: {
                    filter: { _id: item.product },
                    update: { $inc: { stock: item.quantity, soldCount: -item.quantity } },
                },
            }));
            await Product.bulkWrite(bulkOps);

            invoice.status = "CANCELLED";
            invoice.cancelReason = reason || "Hủy bởi Admin";
            invoice.cancelledAt = new Date();
            await invoice.save();

            res.status(200).json({ success: true, message: "Đã hủy đơn và hoàn lại kho!" });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    },
};

export default invoiceController;