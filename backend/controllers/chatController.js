import Groq from "groq-sdk";
import ChatSession from "../models/Chat.js"; 
import Product from "../models/Product.js"; 
import Cart from "../models/Cart.js";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ─── 1. SYSTEM PROMPT (LUẬT CỨNG) ─────────────
const SYSTEM_PROMPT = `
Bạn là "Manga Paradise Assistant". 
NHIỆM VỤ: Chỉ tư vấn dựa trên [DANH SÁCH TRUYỆN THỰC TẾ] được cung cấp.
LUẬT CẤM: 
- Tuyệt đối không nhắc đến bất kỳ bộ truyện nào KHÔNG có trong danh sách dưới đây.
- Không được tự bịa giá hoặc nội dung truyện.
- Nếu khách hỏi truyện không có trong danh sách, hãy nói: "Dạ hiện tại shop em chưa có bộ này, mình xem thử các bộ khác đang sẵn hàng nhé! 📚✨"
XƯNG HÔ: Gọi khách là "mình/bạn", xưng "em". Thêm icon 📚✨ cho thân thiện.
`;

export const chatWithAI = async (req, res) => {
  try {
    const { sessionId, content } = req.body;
    const { _id: userId, role, name } = req.user; 
    const lowerContent = content.toLowerCase();

    if (!content?.trim()) {
      return res.status(400).json({ message: "Nội dung không được trống." });
    }

    // --- 2. QUẢN LÝ PHIÊN CHAT (Sửa lỗi ObjectId) ---
    let session;
    if (sessionId?.match(/^[0-9a-fA-F]{24}$/)) {
      session = await ChatSession.findOne({ _id: sessionId, user: userId });
    }
    if (!session) {
      session = new ChatSession({ user: userId, sessionType: "BOT", status: "ACTIVE", messages: [] });
    }

    // --- 3. TRUY XUẤT DỮ LIỆU THỰC TẾ (CHÌA KHÓA ĐỂ AI KHÔNG BỊA) ---
    let dbContext = "=== [DANH SÁCH TRUYỆN THỰC TẾ ĐANG CÓ] ===\n";

    // A. LẤY DỮ LIỆU SẢN PHẨM (Format thành String để AI dễ đọc hơn JSON)
    // Ưu tiên lấy các truyện đang Active
    let products = await Product.find({ status: "active" })
      .select('name basePrice salePrice stock')
      .limit(20).lean();

    if (products.length > 0) {
      products.forEach(p => {
        const price = p.salePrice || p.basePrice;
        const stockStatus = p.stock > 0 ? `Còn ${p.stock} cuốn` : "Hết hàng";
        dbContext += `- ${p.name} | Giá: ${price.toLocaleString()}đ | Tình trạng: ${stockStatus}\n`;
      });
    } else {
      dbContext += "(Hiện tại database chưa có sản phẩm nào được kích hoạt)\n";
    }

    // B. NẾU LÀ ADMIN: BÁO CÁO KHO CHI TIẾT
    if ((role === 'admin' || role === 'staff') && (lowerContent.includes("kho") || lowerContent.includes("tồn"))) {
      const lowStock = products.filter(p => p.stock < 5);
      dbContext += "\n[BÁO CÁO QUẢN TRỊ]: Các truyện sắp hết hàng: " + 
        lowStock.map(p => `${p.name} (${p.stock})`).join(", ") + "\n";
    }

    // C. GIỎ HÀNG (Nếu khách hỏi)
    if (lowerContent.includes("giỏ") || lowerContent.includes("mua")) {
      const cart = await Cart.findOne({ user: userId }).populate("items.product", "name").lean();
      if (cart && cart.items.length > 0) {
        dbContext += "\n[GIỎ HÀNG CỦA KHÁCH]: " + cart.items.map(i => i.product.name).join(", ") + "\n";
      }
    }
    dbContext += "==========================================\n";

    // --- 4. GỌI AI ---
    session.messages.push({ role: "user", content });

    const chatHistory = session.messages.slice(-6).map(msg => ({
      role: msg.role === "bot" ? "assistant" : "user",
      content: msg.content
    }));

    const completion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { 
          role: "system", 
          content: `DỮ LIỆU HIỆN TẠI CỦA SHOP:\n${dbContext}\n\nKhách tên: ${name}. Quyền: ${role}.` 
        },
        ...chatHistory
      ],
      model: "llama-3.3-70b-versatile",
      temperature: 0.1, // Nhiệt độ thấp giúp AI trả lời chính xác dữ liệu cung cấp
    });

    let aiReply = completion.choices[0]?.message?.content || "Em chưa rõ ý mình lắm ạ.";
    
    // Xử lý chuyển cho người thật (Handover)
    const isHandover = aiReply.includes("[ACTION:TRANSFER]");
    if (isHandover) {
      aiReply = aiReply.replace("[ACTION:TRANSFER]", "").trim();
      session.sessionType = "LIVE_SUPPORT";
      session.status = "PENDING";
    }

    session.messages.push({ role: "bot", content: aiReply });
    await session.save();

    res.status(200).json({
      success: true,
      sessionId: session._id,
      reply: aiReply,
      action: isHandover ? "SWITCH_TO_STAFF" : "CONTINUE",
    });

  } catch (error) {
    console.error(">>> LỖI CHAT CONTROLLER:", error.message);
    res.status(500).json({ message: "Lỗi kết nối máy chủ AI." });
  }
};