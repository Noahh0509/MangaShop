// models/Log.js
const logSchema = new mongoose.Schema({
  action: String,    // Ví dụ: "UPDATE_PRODUCT", "DELETE_USER"
  admin: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  details: String,   // Ví dụ: "Đã xóa bộ Naruto tập 1"
  timestamp: { type: Date, default: Date.now }
});