// models/product.model.js
import mongoose from "mongoose";

// ─── Constants ──────────────────────────────────────────────────
const STATUS = {
  ACTIVE:       "active",
  INACTIVE:     "inactive",
  OUT_OF_STOCK: "out_of_stock",
  DISCONTINUED: "discontinued",
};

// ─── Sub-schema: ảnh sản phẩm ───────────────────────────────────
const imageSchema = new mongoose.Schema(
  {
    url:       { type: String, required: true },
    altText:   { type: String, default: null },
    isPrimary: { type: Boolean, default: false },
  },
  { _id: false }
);

// ─── Sub-schema: biến thể ───────────────────────────────────────
const variantSchema = new mongoose.Schema(
  {
    name:     { type: String, required: true, trim: true },
    sku:      { type: String, required: true, trim: true, unique: true },
    price:    { type: Number, required: true, min: 0 },
    stock:    { type: Number, required: true, min: 0, default: 0 },
    images:   { type: [imageSchema], default: [] },
    isActive: { type: Boolean, default: true },
  },
  { _id: true }
);

// ─── Main schema ────────────────────────────────────────────────
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

    // ─── Danh mục & tags ─────────────────────────────────────────
    category: {
      type: mongoose.Schema.Types.ObjectId, ref: "Category", required: true,
    },
    tags: { type: [String], default: [] },

    // ─── Giá & tồn kho ───────────────────────────────────────────
    basePrice: { type: Number, required: true, min: 0 },
    salePrice: { type: Number, default: null, min: 0 },
    stock:     { type: Number, default: 0, min: 0 },

    // ─── Biến thể ────────────────────────────────────────────────
    hasVariants: { type: Boolean, default: false },
    variants:    { type: [variantSchema], default: [] },

    // ─── Hình ảnh ────────────────────────────────────────────────
    images: { type: [imageSchema], default: [] },

    // ─── Attributes linh hoạt ────────────────────────────────────
    attributes: {
      type: Map, of: mongoose.Schema.Types.Mixed, default: {},
    },

    // ─── Khuyến mãi ──────────────────────────────────────────────
    promotions: [{ type: mongoose.Schema.Types.ObjectId, ref: "Promotion" }],

    // ─── SEO ─────────────────────────────────────────────────────
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
  { timestamps: true }
);

// ─── Indexes ─────────────────────────────────────────────────────
productSchema.index({ name: "text", description: "text", tags: "text" });
productSchema.index({ category: 1, status: 1 });
productSchema.index({ slug: 1 });
productSchema.index({ basePrice: 1 });
productSchema.index({ soldCount: -1 });
productSchema.index({ promotions: 1 });

// ─── Virtuals ────────────────────────────────────────────────────
productSchema.virtual("displayPrice").get(function () {
  return this.salePrice ?? this.basePrice;
});

productSchema.virtual("totalStock").get(function () {
  if (!this.hasVariants || this.variants.length === 0) return this.stock;
  return this.variants.reduce((sum, v) => sum + (v.isActive ? v.stock : 0), 0);
});

productSchema.virtual("isInStock").get(function () {
  return this.totalStock > 0;
});

productSchema.virtual("discountPercent").get(function () {
  if (!this.salePrice || this.salePrice >= this.basePrice) return 0;
  return Math.round(((this.basePrice - this.salePrice) / this.basePrice) * 100);
});

// ─── Methods ─────────────────────────────────────────────────────
productSchema.methods.isAvailable = function () {
  return this.status === STATUS.ACTIVE && this.totalStock > 0;
};

productSchema.methods.incrementView = async function () {
  await this.constructor.updateOne({ _id: this._id }, { $inc: { viewCount: 1 } });
};

productSchema.methods.updateRating = async function (newRating, isNew = true) {
  const total = this.averageRating * this.reviewCount + newRating;
  const count = this.reviewCount + (isNew ? 1 : 0);
  await this.constructor.updateOne(
    { _id: this._id },
    { averageRating: +(total / count).toFixed(1), reviewCount: count }
  );
};

// Gắn khuyến mãi vào sản phẩm
productSchema.methods.addPromotion = async function (promotionId) {
  await this.constructor.updateOne(
    { _id: this._id },
    { $addToSet: { promotions: promotionId } }
  );
};

// Gỡ khuyến mãi khỏi sản phẩm
productSchema.methods.removePromotion = async function (promotionId) {
  await this.constructor.updateOne(
    { _id: this._id },
    { $pull: { promotions: promotionId } }
  );
};

// ─── Statics ─────────────────────────────────────────────────────
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
    .populate("category")
    .populate("promotions");
};

productSchema.statics.searchProducts = function (keyword, options = {}) {
  return this.find(
    { $text: { $search: keyword }, status: STATUS.ACTIVE, ...options },
    { score: { $meta: "textScore" } }
  )
    .sort({ score: { $meta: "textScore" } })
    .populate("category")
    .populate("promotions");
};

// Tìm sản phẩm đang có khuyến mãi
productSchema.statics.findWithPromotion = function (promotionId) {
  return this.find({ promotions: promotionId, status: STATUS.ACTIVE })
    .populate("category")
    .populate("promotions");
};

const Product = mongoose.model("Product", productSchema);
export default Product;