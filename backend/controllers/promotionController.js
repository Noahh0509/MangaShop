import Promotion from "../models/Promotion.js";

const promotionController = {
    // 1. Lấy tất cả KM cho Admin (Bảng sếp vừa làm FE)
    getAllPromotions: async (req, res) => {
        try {
            const promotions = await Promotion.find()
                .sort("-createdAt")
                .populate("applicableCategories", "name")
                .populate("applicableProducts", "name");

            res.status(200).json({ success: true, data: promotions });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    },

    // 2. Tạo KM mới (Dành cho Modal "Tạo mã mới")
    createPromotion: async (req, res) => {
        try {
            const data = { ...req.body, createdBy: req.user?._id };
            const newPromo = await Promotion.create(data);
            res.status(201).json({ success: true, data: newPromo });
        } catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    },

    // 3. Gạt công tắc trạng thái (Dành cho cái Switch Toggle của sếp)
    toggleStatus: async (req, res) => {
        try {
            const { id } = req.params;
            const { status } = req.body;

            const promo = await Promotion.findByIdAndUpdate(
                id,
                { status, updatedBy: req.user?._id },
                { new: true }
            );

            res.status(200).json({ success: true, data: promo });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    },

    // 4. API check mã code (Dành cho khách hàng lúc thanh toán)
    checkPromoCode: async (req, res) => {
        try {
            const { code, originalPrice } = req.body;
            const promo = await Promotion.findByCode(code);

            if (!promo) {
                return res.status(404).json({ success: false, message: "Mã giảm giá không tồn tại hoặc đã hết hạn sếp ơi!" });
            }

            // Sử dụng Method calculateDiscount sếp đã viết trong Model
            const result = promo.calculateDiscount(originalPrice);

            res.status(200).json({
                success: true,
                message: `Áp dụng thành công: ${promo.name}`,
                data: {
                    discountAmount: result.discountAmount,
                    finalPrice: result.finalPrice,
                    promoId: promo._id
                }
            });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    },
    validatePromoCode: async (req, res) => {
        try {
            const { code, orderValue, userId, cartItems } = req.body;

            // Tìm mã đang active
            const promo = await Promotion.findOne({
                code: code.toUpperCase(),
                status: "active"
            });

            if (!promo) return res.status(404).json({ message: "Mã giảm giá không tồn tại hoặc đã hết hạn." });

            // Kiểm tra các điều kiện cơ bản
            if (promo.isExpired) return res.status(400).json({ message: "Mã đã hết hạn sử dụng." });
            if (promo.isUsageLimitReached) return res.status(400).json({ message: "Mã đã hết lượt sử dụng." });
            if (orderValue < promo.minOrderValue) {
                return res.status(400).json({ message: `Đơn hàng tối thiểu phải từ ${promo.minOrderValue}đ` });
            }

            // TODO: Kiểm tra xem userId này đã dùng quá usageLimitPerUser chưa (truy vấn bảng Order)

            res.json({
                success: true,
                message: "Áp dụng mã thành công",
                data: {
                    name: promo.name,
                    discountType: promo.discountType,
                    discountValue: promo.discountValue,
                    maxDiscount: promo.maxDiscount
                }
            });
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    },

    // 2. Lấy danh sách Flash Sale (Hiện ở trang chủ React)
    getActiveFlashSales: async (req, res) => {
        try {
            const flashSales = await Promotion.find({
                discountType: "flash_sale",
                status: "active",
                startDate: { $lte: new Date() },
                endDate: { $gte: new Date() }
            }).populate("flashSaleItems.product", "name images basePrice slug");

            res.json({ success: true, data: flashSales });
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    },

    // 3. Admin: Tạo chương trình khuyến mãi mới
    createPromotion: async (req, res) => {
        try {
            const newPromo = new Promotion(req.body);
            await newPromo.save();
            res.status(201).json({ success: true, data: newPromo });
        } catch (error) {
            res.status(400).json({ message: error.message });
        }
    }
};

export default promotionController;