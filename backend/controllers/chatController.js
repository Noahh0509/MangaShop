import Groq from "groq-sdk";
import ChatSession from "../models/Chat.js";
// Nhớ import các model tương ứng của bạn vào đây nhé
import Product from "../models/Product.js"; 
//import Order from "../models/Order.js";   

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ─── 1. HỆ ĐIỀU HÀNH AI (SYSTEM PROMPT) ─────────────────────────
const SYSTEM_PROMPT = `
Bạn là "Manga Management & Sales Expert" của Manga Paradise.

--- CHẾ ĐỘ 1: TƯ VẤN KHÁCH HÀNG (Role: User) ---
- Vibe: Thân thiện, dùng icon 📚✨, gọi khách là "mình/bạn" hoặc "quý độc giả".
- Chốt đơn: Gợi ý top 3 truyện cùng thể loại nếu khách hỏi.
- Xử lý kho: Nếu dữ liệu đính kèm báo tồn kho < 3 cuốn, hãy nhắc khách: "Bộ này chỉ còn vài cuốn cuối thôi ạ, mình nhanh tay nhé!".
- Handover: Khi khách khiếu nại, bức xúc, hoặc muốn gặp người thật, hãy trả lời: "Dạ, em sẽ kết nối ngay với nhân viên để hỗ trợ mình ạ!" VÀ BẮT BUỘC chèn thêm mã [ACTION:TRANSFER] vào cuối câu trả lời.

--- CHẾ ĐỘ 2: HỖ TRỢ NGHIỆP VỤ (Role: Staff/Admin) ---
- Vibe: Chuyên nghiệp, báo cáo bằng Table (Markdown) hoặc Bullet points cho dễ nhìn.
- Nghiệp vụ: Thống kê doanh thu, báo cáo đơn hàng, báo sản phẩm sắp hết (Stock < 5) dựa trên dữ liệu được cung cấp.
- Marketing: Soạn caption FB/Shopee theo cấu trúc: [Tiêu đề hấp dẫn] - [Tóm tắt] - [Call to action].

--- QUY TẮC CỐ ĐỊNH ---
1. Không bịa đặt số lượng tồn kho hoặc doanh thu nếu không có trong ngữ cảnh đính kèm.
2. Tuyệt đối bảo mật thông tin khách hàng.
3. Ngôn ngữ: Tiếng Việt.
`;

// ─── 2. CONTROLLER CHÍNH ────────────────────────────────────────
export const chatWithAI = async (req, res) => {
  try {
    const { sessionId, content } = req.body;
    const { _id: userId, role, name } = req.user; 
    const lowerContent = content.toLowerCase();

    if (!content || content.trim() === "") {
      return res.status(400).json({ message: "Nội dung tin nhắn không được để trống." });
    }

    // --- A. Quản lý Session ---
    let session;
    if (sessionId) {
      session = await ChatSession.findOne({ _id: sessionId, user: userId });
    }
    
    if (!session) {
      session = new ChatSession({ user: userId, sessionType: "BOT", status: "ACTIVE", messages: [] });
    }

    if (session.status !== "ACTIVE" || session.sessionType !== "BOT") {
      return res.status(400).json({ message: "Phiên chat này đã kết thúc hoặc đang chờ nhân viên xử lý." });
    }

    // Lưu tin nhắn của User
    session.messages.push({ role: "user", content });

    // --- B. Bơm dữ liệu nghiệp vụ (Context Injection / RAG) ---
    let businessContext = "DỮ LIỆU THỰC TẾ HIỆN TẠI (Hãy dùng dữ liệu này để trả lời, nếu trống thì báo không có thông tin):\n";
    
    try {
      if (role === 'admin' || role === 'staff') {
        // Staff hỏi về kho hàng
        if (lowerContent.includes("kho") || lowerContent.includes("tồn") || lowerContent.includes("hàng")) {
          const lowStock = await Product.find({ stock: { $lt: 5 } }).select('name stock price').limit(10).lean();
          businessContext += `- Các truyện sắp hết hàng: ${JSON.stringify(lowStock)}\n`;
        }
        // // Staff hỏi về đơn hàng / doanh thu
        // if (lowerContent.includes("đơn") || lowerContent.includes("thống kê") || lowerContent.includes("doanh thu")) {
        //   const pendingOrders = await Order.countDocuments({ status: 'PENDING' });
        //   businessContext += `- Số đơn hàng đang chờ xử lý (PENDING): ${pendingOrders}\n`;
        // }
      } else {
        // Khách hàng hỏi tư vấn (Bơm top truyện hot)
        if (lowerContent.includes("gợi ý") || lowerContent.includes("hot") || lowerContent.includes("hay")) {
          const hotManga = await Product.find({ isHot: true }).select('name price stock').limit(3).lean();
          businessContext += `- Truyện Hot gợi ý cho khách: ${JSON.stringify(hotManga)}\n`;
        }
        // Khách hỏi cụ thể 1 bộ truyện (Tìm tương đối tên truyện trong nội dung chat)
        // (Đây là logic cơ bản, có thể dùng text search của MongoDB để tối ưu sau)
        const productMentioned = await Product.findOne({ $text: { $search: content } }).select('name price stock').lean();
        if (productMentioned) {
          businessContext += `- Thông tin bộ truyện khách đang hỏi: ${JSON.stringify(productMentioned)}\n`;
        }
      }
    } catch (dbError) {
      console.error("Lỗi khi lấy business context:", dbError);
      // Bỏ qua lỗi DB để AI vẫn có thể chat bình thường
    }

    // --- C. Xây dựng lịch sử hội thoại ---
    const chatHistory = session.messages.slice(-8).map(msg => ({
      role: msg.role === "bot" ? "assistant" : "user",
      content: msg.content
    }));

    // --- D. Gọi AI (Groq API) ---
    const completion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "system", content: `Vai trò của người dùng hiện tại: ${role.toUpperCase()}. Tên: ${name}.\n${businessContext}` },
        ...chatHistory
      ],
      model: "llama-3.3-70b-versatile",
      // Nhiệt độ: Khách cần AI dẻo miệng (0.7), Staff cần AI nghiêm túc báo cáo số liệu (0.2)
      temperature: role === 'user' ? 0.7 : 0.2, 
      max_tokens: 1024,
    });

    let aiReply = completion.choices[0]?.message?.content || "Dạ hệ thống đang quá tải một xíu, anh/chị nhắn lại giúp em nhé!";
    let isHandover = false;

    // --- E. Xử lý Logic Chuyển đổi (Handover) ---
    if (aiReply.includes("[ACTION:TRANSFER]")) {
      isHandover = true;
      // Cắt bỏ cái tag [ACTION:TRANSFER] để không hiện ra màn hình của khách
      aiReply = aiReply.replace("[ACTION:TRANSFER]", "").trim();
      
      // Chuyển đổi trạng thái Session sang cho nhân viên
      session.sessionType = "LIVE_SUPPORT";
      session.status = "PENDING";
    }

    // --- F. Lưu và Trả kết quả ---
    session.messages.push({ role: "bot", content: aiReply });
    await session.save();

    res.status(200).json({
      success: true,
      sessionId: session._id,
      reply: aiReply,
      action: isHandover ? "SWITCH_TO_STAFF" : "CONTINUE",
    });

  } catch (error) {
    console.error(">>> ERROR AT CHAT CONTROLLER:", error);
    res.status(500).json({ message: "Lỗi kết nối máy chủ AI." });
  }
};