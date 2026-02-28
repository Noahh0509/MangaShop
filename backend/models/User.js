import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const ROLES = {
  CUSTOMER: "customer",
  ADMIN: "admin",
};

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String, required: true, unique: true, trim: true, minlength: 3, maxlength: 30,
    },
    email: {
      type: String, required: true, unique: true, lowercase: true, trim: true,
    },
    password: {
      type: String, required: true, minlength: 6,
    },
    fullName:  { type: String, trim: true, maxlength: 50 },
    phone:     { type: String, trim: true, default: null },
    avatar:    { type: String, default: null },
    address: {
      province: { type: String, default: null },
      district: { type: String, default: null },
      ward:     { type: String, default: null },
      street:   { type: String, default: null },
    },
    role: {
      type: String, enum: Object.values(ROLES), default: ROLES.CUSTOMER,
    },
    isActive:             { type: Boolean, default: true },
    refreshToken:         { type: String,  default: null },
    passwordChangedAt:    { type: Date,    default: null },
    resetPasswordToken:   { type: String,  default: null },
    resetPasswordExpires: { type: Date,    default: null },
    lastLoginAt:          { type: Date,    default: null },
  },
  { timestamps: true }
);

// ─── Hash password (chỉ chạy khi password thay đổi) ─────────────
userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  if (!this.isNew) {
    this.passwordChangedAt = new Date(Date.now() - 1000);
  }
});

// ─── Methods ────────────────────────────────────────────────────
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.generateAccessToken = function () {
  return jwt.sign(
    { id: this._id, role: this.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "15m" }
  );
};

// Dùng updateOne thay vì save() để tránh trigger pre save hook
userSchema.methods.generateRefreshToken = async function () {
  const token = jwt.sign(
    { id: this._id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d" }
  );
  await this.constructor.updateOne({ _id: this._id }, { refreshToken: token });
  return token;
};

userSchema.methods.isTokenValidAfterPasswordChange = function (iat) {
  if (!this.passwordChangedAt) return true;
  return iat > Math.floor(this.passwordChangedAt.getTime() / 1000);
};

// Dùng updateOne thay vì save() để tránh trigger pre save hook
userSchema.methods.logout = async function () {
  await this.constructor.updateOne({ _id: this._id }, { refreshToken: null });
};

userSchema.methods.isAdmin = function () {
  return this.role === ROLES.ADMIN;
};

userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.refreshToken;
  delete obj.resetPasswordToken;
  delete obj.resetPasswordExpires;
  delete obj.passwordChangedAt;
  return obj;
};

userSchema.statics.ROLES = ROLES;
userSchema.statics.findByEmail = function (email) {
  return this.findOne({ email: email.toLowerCase().trim() });
};

const User = mongoose.model("User", userSchema);
export default User;