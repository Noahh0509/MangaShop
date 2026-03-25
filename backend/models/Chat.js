const mongoose = require("mongoose");

// --- Sub-schema: từng tin nhắn ---
const messageSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ["user", "bot", "staff"], // user = khách, bot = AI, staff = nhân viên hỗ trợ
      required: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: [5000, "Tin nhắn không được vượt quá 5000 ký tự"],
    },
    // Đính kèm (nếu có): hình ảnh, link manga, ...
    attachments: [
      {
        type: { type: String, enum: ["IMAGE", "MANGA_LINK", "FILE"] },
        url: { type: String },
        label: { type: String }, // VD: tên truyện, tên file
      },
    ],
    isRead: {
      type: Boolean,
      default: false,
    },
    sentAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

// --- Main schema: phiên chat ---
const chatSessionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Loại chat: AI chatbot hay hỗ trợ trực tiếp với staff
    sessionType: {
      type: String,
      enum: ["BOT", "LIVE_SUPPORT"],
      default: "BOT",
    },

    // Nếu là LIVE_SUPPORT thì lưu staff đang xử lý
    assignedStaff: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // Chủ đề / lý do liên hệ
    topic: {
      type: String,
      enum: [
        "ORDER_INQUIRY",    // Hỏi về đơn hàng
        "PRODUCT_INQUIRY",  // Hỏi về truyện
        "RETURN_REFUND",    // Đổi trả, hoàn tiền
        "TECHNICAL",        // Lỗi kỹ thuật
        "GENERAL",          // Thắc mắc chung
        "OTHER",
      ],
      default: "GENERAL",
    },

    messages: [messageSchema],

    status: {
      type: String,
      enum: [
        "ACTIVE",    // Đang diễn ra
        "RESOLVED",  // Đã giải quyết
        "CLOSED",    // Đóng (user tự đóng hoặc timeout)
        "PENDING",   // Chờ staff xử lý
      ],
      default: "ACTIVE",
    },

    // Đánh giá sau khi kết thúc chat
    rating: {
      score: { type: Number, min: 1, max: 5, default: null },
      comment: { type: String, default: "" },
      ratedAt: { type: Date, default: null },
    },

    // Metadata
    startedAt: { type: Date, default: Date.now },
    endedAt: { type: Date, default: null },
    lastMessageAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
  }
);

// --- Cập nhật lastMessageAt mỗi khi có tin nhắn mới ---
chatSessionSchema.pre("save", function (next) {
  if (this.isModified("messages") && this.messages.length > 0) {
    this.lastMessageAt = this.messages[this.messages.length - 1].sentAt;
  }
  next();
});

// --- Method: thêm tin nhắn mới ---
chatSessionSchema.methods.addMessage = function (role, content, attachments = []) {
  this.messages.push({ role, content, attachments });
  return this.save();
};

// --- Method: đóng phiên chat ---
chatSessionSchema.methods.closeSession = function (status = "CLOSED") {
  this.status = status;
  this.endedAt = new Date();
  return this.save();
};

// --- Method: đánh giá chat ---
chatSessionSchema.methods.rateSession = function (score, comment = "") {
  this.rating = { score, comment, ratedAt: new Date() };
  return this.save();
};

// --- Method: đánh dấu tất cả tin nhắn đã đọc ---
chatSessionSchema.methods.markAllRead = function () {
  this.messages.forEach((msg) => {
    msg.isRead = true;
  });
  return this.save();
};

// --- Static: lấy lịch sử chat của user (tất cả phiên) ---
chatSessionSchema.statics.getHistoryByUser = function (userId, limit = 10) {
  return this.find({ user: userId })
    .sort({ lastMessageAt: -1 })
    .limit(limit)
    .select("-messages"); // trả về metadata, không lấy toàn bộ tin nhắn
};

// --- Static: lấy các phiên đang chờ staff ---
chatSessionSchema.statics.getPendingSessions = function () {
  return this.find({ status: "PENDING", sessionType: "LIVE_SUPPORT" })
    .sort({ startedAt: 1 })
    .populate("user", "name email avatar");
};

// --- Index ---
chatSessionSchema.index({ user: 1, lastMessageAt: -1 });
chatSessionSchema.index({ status: 1, sessionType: 1 });
chatSessionSchema.index({ assignedStaff: 1, status: 1 });

const ChatSession = mongoose.model("ChatSession", chatSessionSchema);
module.exports = ChatSession;