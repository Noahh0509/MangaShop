// models/category.model.js
import mongoose from "mongoose";

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String, required: true, unique: true, trim: true, maxlength: 50,
    },
    slug: {
      type: String, required: true, unique: true, lowercase: true, trim: true,
    },
    description: { type: String, trim: true, maxlength: 500, default: null },
    thumbnail:   { type: String, default: null },
    isActive:    { type: Boolean, default: true },
  },
  { timestamps: true }
);

// ─── Statics ────────────────────────────────────────────────────
categorySchema.statics.findBySlug = function (slug) {
  return this.findOne({ slug: slug.toLowerCase().trim() });
};

const Category = mongoose.model("Category", categorySchema);
export default Category;