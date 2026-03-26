import mongoose from "mongoose";

// ─── Constants ──────────────────────────────────────────────────
const DISCOUNT_TYPE = {
  PERCENTAGE:  "percentage",   // giảm theo %
  FIXED:       "fixed",        // giảm theo số tiền
  BUY_X_GET_Y: "buy_x_get_y",  // mua X tặng Y
  FLASH_SALE:  "flash_sale",   // flash sale (giá riêng từng SP + giới hạn slot)
};

const APPLY_TO = {
  ALL:        "all",
  CATEGORIES: "categories",
  PRODUCTS:   "products",
};

const STATUS = {
  DRAFT:    "draft",
  ACTIVE:   "active",
  INACTIVE: "inactive",
  EXPIRED:  "expired",
};

// ─── Sub-schema: mua X tặng Y ───────────────────────────────────
const buyXGetYSchema = new mongoose.Schema(
  {
    buyQuantity: { type: Number, required: true, min: 1 },
    getQuantity: { type: Number, required: true, min: 1 },
    getProduct:  { // null = tặng chính SP đó
      type: mongoose.Schema.Types.ObjectId, ref: "Product", default: null,
    },
  },
  { _id: false }
);

// ─── Sub-schema: flash sale slot theo từng sản phẩm ─────────────
const flashSaleItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true,
    },
    discountPercent: { type: Number, required: true, min: 1, max: 100 },
    flashPrice:      { type: Number, required: true, min: 0 },
    stockLimit:      { type: Number, required: true, min: 1 },
    soldCount:       { type: Number, default: 0 },
  },
  { _id: true }
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
      type: String, required: true, trim: true, maxlength: 200,
    },
    code: {
      type: String, unique: true, sparse: true,
      uppercase: true, trim: true, default: null,
    },
    description: { type: String, trim: true, maxlength: 500, default: null },
    banner:      { type: String, default: null },

    // ─── Loại khuyến mãi ─────────────────────────────────────────
    discountType: {
      type: String, enum: Object.values(DISCOUNT_TYPE), required: true,
    },

    // ─── Giá trị giảm chung (cho % hoặc tiền mặt cố định) ─────────
    discountValue: { type: Number, default: null, min: 0 }, 
    maxDiscount:   { type: Number, default: null, min: 0 }, // Trần giảm cho %
    minOrderValue: { type: Number, default: 0,    min: 0 }, // Đơn tối thiểu

    // ─── Cấu hình đặc thù ────────────────────────────────────────
    buyXGetY: { type: buyXGetYSchema, default: null },
    flashSaleItems: { type: [flashSaleItemSchema], default: [] },

    // ─── Phạm vi áp dụng ─────────────────────────────────────────
    applyTo: {
      type: String, enum: Object.values(APPLY_TO), default: APPLY_TO.ALL,
    },
    applicableCategories: [{ type: mongoose.Schema.Types.ObjectId, ref: "Category" }],
    applicableProducts:   [{ type: mongoose.Schema.Types.ObjectId, ref: "Product"  }],
    excludedProducts:     [{ type: mongoose.Schema.Types.ObjectId, ref: "Product"  }],

    // ─── Thời gian & Giới hạn ────────────────────────────────────
    startDate: { type: Date, required: true },
    endDate:   { type: Date, required: true },
    usageLimit:        { type: Number, default: null, min: 1 },
    usageLimitPerUser: { type: Number, default: 1,    min: 1 },
    usedCount:         { type: Number, default: 0 },

    // ─── Cấu hình hệ thống ───────────────────────────────────────
    status:      { type: String, enum: Object.values(STATUS), default: STATUS.DRAFT },
    isAutoApply: { type: Boolean, default: false },
    priority:    { type: Number,  default: 0 },

    // ─── Audit ───────────────────────────────────────────────────
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// ─── Indexes ─────────────────────────────────────────────────────
promotionSchema.index({ code: 1 });
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

/**
 * Tính toán số tiền được giảm cho một sản phẩm cụ thể
 */
promotionSchema.methods.calculateDiscount = function (productId, originalPrice, quantity = 1) {
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
      if (this.maxDiscount) discountAmount = Math.min(discountAmount, this.maxDiscount);
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
    finalPrice: Math.round(originalPrice - discountAmount),
  };
};

promotionSchema.methods.incrementUsage = async function () {
  this.usedCount += 1;
  if (this.isUsageLimitReached) this.status = STATUS.EXPIRED;
  return await this.save();
};

promotionSchema.methods.incrementFlashSaleSold = async function (productId, quantity = 1) {
  const item = this.flashSaleItems.find(i => i.product.toString() === productId.toString());
  if (item) {
    item.soldCount += quantity;
    return await this.save();
  }
};

// ─── Statics (Model) ─────────────────────────────────────────────
promotionSchema.statics.findActiveForProduct = function (productId, categoryId) {
  const now = new Date();
  return this.find({
    status: STATUS.ACTIVE,
    startDate: { $lte: now },
    endDate: { $gte: now },
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