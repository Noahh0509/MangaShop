import mongoose from "mongoose";

// ─── Constants ──────────────────────────────────────────────────
const DISCOUNT_TYPE = {
  PERCENTAGE:  "percentage",   // giảm theo %
  FIXED:       "fixed",        // giảm theo số tiền
  BUY_X_GET_Y: "buy_x_get_y", // mua X tặng Y
  FLASH_SALE:  "flash_sale",   // flash sale (% + thời gian + giới hạn slot)
};

const APPLY_TO = {
  ALL: "all",
  CATEGORIES: "categories",
  PRODUCTS: "products",
};

const STATUS = {
  DRAFT: "draft",
  ACTIVE: "active",
  INACTIVE: "inactive",
  EXPIRED: "expired",
};

// ─── Sub-schema: mua X tặng Y ───────────────────────────────────
const buyXGetYSchema = new mongoose.Schema(
  {
    buyQuantity: { type: Number, required: true, min: 1 },
    getQuantity: { type: Number, required: true, min: 1 },
    getProduct:  {                                          // null = tặng chính SP đó
      type: mongoose.Schema.Types.ObjectId, ref: "Product", default: null,
    },
  },
  { _id: false },
);

// ─── Sub-schema: flash sale slot theo từng sản phẩm ─────────────
const flashSaleItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    discountPercent: { type: Number, required: true, min: 1, max: 100 },
    flashPrice: { type: Number, required: true, min: 0 },
    stockLimit: { type: Number, required: true, min: 1 },
    soldCount: { type: Number, default: 0 },
  },
  { _id: true },
);

flashSaleItemSchema.virtual("remainingStock").get(function () {
  return Math.max(0, this.stockLimit - this.soldCount);
});

flashSaleItemSchema.virtual("isAvailable").get(function () {
  return this.soldCount < this.stockLimit;
});

// ─── Main schema ────────────────────────────────────────────────
const promotionSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    code: {
      type: String, unique: true, sparse: true,  // null nếu tự động áp dụng
      uppercase: true, trim: true, default: null,
    },
    description: { type: String, trim: true, maxlength: 500, default: null },
    banner: { type: String, default: null },

    // ─── Loại khuyến mãi ─────────────────────────────────────────
    discountType: {
      type: String,
      enum: Object.values(DISCOUNT_TYPE),
      required: true,
    },

    // ─── Giá trị giảm (percentage / fixed / flash_sale) ──────────
    discountValue: { type: Number, default: null, min: 0 }, // % hoặc số tiền
    maxDiscount:   { type: Number, default: null, min: 0 }, // trần giảm tối đa (cho %)
    minOrderValue: { type: Number, default: 0,    min: 0 }, // đơn tối thiểu

    // ─── Cấu hình đặc thù ────────────────────────────────────────
    buyXGetY: { type: buyXGetYSchema, default: null },
    flashSaleItems: { type: [flashSaleItemSchema], default: [] },

    // ─── Phạm vi áp dụng ─────────────────────────────────────────
    applyTo: {
      type: String,
      enum: Object.values(APPLY_TO),
      default: APPLY_TO.ALL,
    },
    applicableCategories: [
      { type: mongoose.Schema.Types.ObjectId, ref: "Category" },
    ],
    applicableProducts: [
      { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
    ],
    excludedProducts: [
      { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
    ],

    // ─── Thời gian & Giới hạn ────────────────────────────────────
    startDate: { type: Date, required: true },
    endDate:   { type: Date, required: true },

    // ─── Giới hạn sử dụng ────────────────────────────────────────
    usageLimit:        { type: Number, default: null, min: 1 },
    usageLimitPerUser: { type: Number, default: 1,    min: 1 },
    usedCount:         { type: Number, default: 0 },

    // ─── Cấu hình ────────────────────────────────────────────────
    status:      { type: String, enum: Object.values(STATUS), default: STATUS.DRAFT },
    isAutoApply: { type: Boolean, default: false },  // tự áp dụng, không cần code
    priority:    { type: Number,  default: 0 },      // ưu tiên khi nhiều KM trùng

    // ─── Audit ───────────────────────────────────────────────────
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

// ─── Indexes ─────────────────────────────────────────────────────
promotionSchema.index({ status: 1, startDate: 1, endDate: 1 });
promotionSchema.index({ applicableProducts: 1 });

// ─── Virtuals ────────────────────────────────────────────────────
promotionSchema.virtual("isExpired").get(function () {
  return new Date() > this.endDate;
});

promotionSchema.virtual("isUsageLimitReached").get(function () {
  return this.usageLimit ? this.usedCount >= this.usageLimit : false;
});

promotionSchema.virtual("isCurrentlyActive").get(function () {
  const now = new Date();
  return (
    this.status === STATUS.ACTIVE &&
    now >= this.startDate &&
    now <= this.endDate &&
    !this.isUsageLimitReached
  );
});

// ─── Methods (Instance) ──────────────────────────────────────────

// Tính giá sau khuyến mãi
promotionSchema.methods.calculateDiscount = function (originalPrice, quantity = 1) {
  if (!this.isCurrentlyActive) return { discountAmount: 0, finalPrice: originalPrice };

  let discountAmount = 0;

  switch (this.discountType) {
    case DISCOUNT_TYPE.FLASH_SALE: {
      // Tìm giá flash sale riêng của sản phẩm này
      const flashItem = this.flashSaleItems.find(item => item.product.toString() === productId.toString());
      if (flashItem && flashItem.isAvailable) {
        discountAmount = originalPrice - flashItem.flashPrice;
      }
      break;
    }
    case DISCOUNT_TYPE.PERCENTAGE: {
      discountAmount = (originalPrice * this.discountValue) / 100;
      if (this.maxDiscount)
        discountAmount = Math.min(discountAmount, this.maxDiscount);
      break;
    }
    case DISCOUNT_TYPE.FIXED: {
      discountAmount = this.discountValue;
      break;
    }
    case DISCOUNT_TYPE.BUY_X_GET_Y: {
      if (!this.buyXGetY) break;
      const { buyQuantity, getQuantity } = this.buyXGetY;
      const freeSets = Math.floor(quantity / (buyQuantity + getQuantity));
      const freeItems = freeSets * getQuantity;
      discountAmount = (originalPrice / quantity) * freeItems;
      break;
    }
  }

  discountAmount = Math.max(0, Math.min(discountAmount, originalPrice));
  return {
    discountAmount: Math.round(discountAmount),
    finalPrice:     Math.round(Math.max(0, originalPrice - discountAmount)),
  };
};

// Kiểm tra KM có áp dụng được cho sản phẩm không
promotionSchema.methods.isApplicableToProduct = function (productId, categoryId) {
  const pid = productId.toString();
  const cid = categoryId?.toString();

  if (this.excludedProducts.map(String).includes(pid)) return false;

  switch (this.applyTo) {
    case APPLY_TO.ALL:        return true;
    case APPLY_TO.PRODUCTS:   return this.applicableProducts.map(String).includes(pid);
    case APPLY_TO.CATEGORIES: return !!cid && this.applicableCategories.map(String).includes(cid);
    default: return false;
  }
};

// Tăng usedCount sau khi dùng
promotionSchema.methods.incrementUsage = async function () {
  await this.constructor.updateOne({ _id: this._id }, { $inc: { usedCount: 1 } });
};

// Tăng soldCount flash sale item
promotionSchema.methods.incrementFlashSaleSold = async function (productId, quantity = 1) {
  await this.constructor.updateOne(
    { _id: this._id, "flashSaleItems.product": productId },
    { $inc: { "flashSaleItems.$.soldCount": quantity } }
  );
};

// Tự động chuyển EXPIRED nếu quá hạn
promotionSchema.methods.checkAndExpire = async function () {
  if (this.isExpired && this.status === STATUS.ACTIVE) {
    await this.constructor.updateOne({ _id: this._id }, { status: STATUS.EXPIRED });
  }
};

// ─── Statics ─────────────────────────────────────────────────────
promotionSchema.statics.DISCOUNT_TYPE = DISCOUNT_TYPE;
promotionSchema.statics.APPLY_TO      = APPLY_TO;
promotionSchema.statics.STATUS        = STATUS;

// Tất cả KM đang active + tự động áp dụng
promotionSchema.statics.findAutoApply = function () {
  const now = new Date();
  return this.find({
    isAutoApply: true,
    status:      STATUS.ACTIVE,
    startDate:   { $lte: now },
    endDate:     { $gte: now },
  }).sort({ priority: -1 });
};

// Tìm theo code
promotionSchema.statics.findByCode = function (code) {
  const now = new Date();
  return this.findOne({
    code:      code.toUpperCase().trim(),
    status:    STATUS.ACTIVE,
    startDate: { $lte: now },
    endDate:   { $gte: now },
  });
};

// Flash sale đang chạy
promotionSchema.statics.findActiveFlashSales = function () {
  const now = new Date();
  return this.find({
    discountType: DISCOUNT_TYPE.FLASH_SALE,
    status:       STATUS.ACTIVE,
    startDate:    { $lte: now },
    endDate:      { $gte: now },
  }).populate("flashSaleItems.product");
};

// KM áp dụng được cho 1 sản phẩm cụ thể
promotionSchema.statics.findForProduct = function (productId, categoryId) {
  const now = new Date();
  return this.find({
    status:           STATUS.ACTIVE,
    startDate:        { $lte: now },
    endDate:          { $gte: now },
    excludedProducts: { $nin: [productId] },
    $or: [
      { applyTo: APPLY_TO.ALL },
      { applyTo: APPLY_TO.PRODUCTS, applicableProducts: productId },
      { applyTo: APPLY_TO.CATEGORIES, applicableCategories: categoryId },
    ],
  }).sort({ priority: -1 });
};

const Promotion = mongoose.model("Promotion", promotionSchema);
export default Promotion;
