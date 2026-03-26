import mongoose from "mongoose";

// ─── Constants ──────────────────────────────────────────────────
const STATUS = {
  ACTIVE:        "active",
  INACTIVE:      "inactive",
  OUT_OF_STOCK:  "out_of_stock",
  DISCONTINUED:  "discontinued",
};

// ─── Sub-schema: Ảnh sản phẩm ───────────────────────────────────
const imageSchema = new mongoose.Schema(
  {
    url:       { type: String, required: true },
    altText:   { type: String, default: null },
    isPrimary: { type: Boolean, default: false },
  },
  { _id: false }
);

// ─── Main Schema ────────────────────────────────────────────────
const productSchema = new mongoose.Schema(
  {
    name: {
      type: String, required: true, trim: true, maxlength: 200,
    },
    slug: {
      type: String, required: true, unique: true, lowercase: true, trim: true,
    },
    description:      { type: String, trim: true, default: null },
    shortDescription: { type: String, trim: true, maxlength: 300, default: null },

    // ─── Danh mục & Tags ─────────────────────────────────────────
    category: {
      type: mongoose.Schema.Types.ObjectId, ref: "Category", required: true,
    },
    tags: { type: [String], default: [] },

    // ─── Giá & Tồn kho ───────────────────────────────────────────
    basePrice: { type: Number, required: true, min: 0 },
    salePrice: { 
      type: Number, 
      default: null, 
      min: 0,
      validate: {
        validator: function(value) {
          // Giá sale phải nhỏ hơn hoặc bằng giá gốc
          return !value || value <= this.basePrice;
        },
        message: "Giá khuyến mãi ({VALUE}) phải nhỏ hơn hoặc bằng giá gốc."
      }
    },
    stock: { type: Number, default: 0, min: 0 },

    // ─── Hình ảnh ────────────────────────────────────────────────
    images: { type: [imageSchema], default: [] },

    // ─── Attributes linh hoạt (Màu sắc, chất liệu...) ────────────
    attributes: {
      type: Map, of: mongoose.Schema.Types.Mixed, default: {},
    },

    // ─── Khuyến mãi & SEO ────────────────────────────────────────
    promotions: [{ type: mongoose.Schema.Types.ObjectId, ref: "Promotion" }],
    seo: {
      metaTitle:       { type: String, default: null },
      metaDescription: { type: String, default: null },
    },

    // ─── Trạng thái ──────────────────────────────────────────────
    status:     { type: String, enum: Object.values(STATUS), default: STATUS.ACTIVE },
    isFeatured: { type: Boolean, default: false },

    // ─── Thống kê ────────────────────────────────────────────────
    soldCount:     { type: Number, default: 0 },
    viewCount:     { type: Number, default: 0 },
    averageRating: { type: Number, default: 0, min: 0, max: 5 },
    reviewCount:   { type: Number, default: 0 },

    // ─── Audit ───────────────────────────────────────────────────
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { 
    timestamps: true,
    // Cho phép hiển thị các trường Virtual khi biến đổi thành JSON (gửi về Client)
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// ─── Indexes ─────────────────────────────────────────────────────
productSchema.index({ name: "text", description: "text", tags: "text" });
productSchema.index({ category: 1, status: 1 });
productSchema.index({ slug: 1 });
productSchema.index({ basePrice: 1 });
productSchema.index({ soldCount: -1 });

// ─── Virtuals ────────────────────────────────────────────────────
productSchema.virtual("displayPrice").get(function () {
  return this.salePrice ?? this.basePrice;
});

productSchema.virtual("isInStock").get(function () {
  return this.stock > 0;
});

productSchema.virtual("discountPercent").get(function () {
  if (!this.salePrice || this.salePrice >= this.basePrice) return 0;
  return Math.round(((this.basePrice - this.salePrice) / this.basePrice) * 100);
});

// ─── Methods (Instance) ──────────────────────────────────────────
productSchema.methods.isAvailable = function () {
  return this.status === STATUS.ACTIVE && this.stock > 0;
};

productSchema.methods.incrementView = async function () {
  this.viewCount += 1;
  return await this.save();
};

productSchema.methods.updateRating = async function (newRating, isNew = true) {
  const totalPoints = this.averageRating * this.reviewCount + newRating;
  const newCount = this.reviewCount + (isNew ? 1 : 0);
  
  // Cập nhật cả RAM và DB
  this.set({
    averageRating: +(totalPoints / newCount).toFixed(1),
    reviewCount: newCount
  });
  
  return await this.save();
};

productSchema.methods.addPromotion = async function (promotionId) {
  if (!this.promotions.includes(promotionId)) {
    this.promotions.push(promotionId);
    return await this.save();
  }
};

productSchema.methods.removePromotion = async function (promotionId) {
  this.promotions.pull(promotionId);
  return await this.save();
};

// ─── Statics (Model) ─────────────────────────────────────────────
productSchema.statics.STATUS = STATUS;

productSchema.statics.findBySlug = function (slug) {
  return this.findOne({ slug: slug.toLowerCase().trim() })
    .populate("category")
    .populate("promotions");
};

productSchema.statics.findByCategory = function (categoryId, options = {}) {
  return this.find({ category: categoryId, status: STATUS.ACTIVE, ...options })
    .sort({ createdAt: -1 })
    .populate("promotions");
};

productSchema.statics.findFeatured = function (limit = 10) {
  return this.find({ isFeatured: true, status: STATUS.ACTIVE })
    .sort({ soldCount: -1 })
    .limit(limit)
    .populate("category");
};

const Product = mongoose.model("Product", productSchema);
export default Product;