import Groq from "groq-sdk";
import ChatSession from "../models/Chat.js"; 
import Product from "../models/Product.js"; 
import Category from "../models/Category.js"; 
import Cart from "../models/Cart.js";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ─── 1. HỆ ĐIỀU HÀNH AI (SYSTEM PROMPT TỐI THƯỢNG) ─────────────
const SYSTEM_PROMPT = `
Bạn là "Manga Management & Sales Expert" - nhân viên tư vấn của Manga Paradise.
Dưới đây là [DỮ LIỆU TỪ DATABASE] của cửa hàng. BẠN BẮT BUỘC PHẢI TUÂN THỦ CÁC LUẬT SAU:

1. CHỈ TRẢ LỜI DỰA TRÊN DỮ LIỆU ĐƯỢC CUNG CẤP. Tuyệt đối không tự bịa ra tên truyện, giá tiền, hoặc tồn kho không có trong [DỮ LIỆU TỪ DATABASE].
2. NGUYÊN TẮC TỪ CHỐI: Nếu khách hỏi một bộ truyện hoặc thông tin KHÔNG CÓ trong phần kết quả tìm kiếm, bạn PHẢI trả lời: "Dạ, hiện tại cửa hàng em không có sẵn bộ này ạ. Mình tham khảo thử các bộ truyện đang hot bên em nhé!". Tuyệt đối không cung cấp kiến thức bên ngoài (như tóm tắt truyện mà shop không bán).
3. Xưng hô "em", gọi khách là "mình/bạn". Thêm icon 📚✨ cho thân thiện.
4. Đọc giá tiền: Dùng 'salePrice' (nếu có), không có thì dùng 'basePrice'. Format: 50.000đ.
5. Tồn kho: Nếu 'stock' = 0 -> Báo hết hàng. Nếu 'stock' từ 1 đến 5 -> Nhắc khách chốt sớm kẻo hết.
6. Khi khách khó chịu, muốn khiếu nại, hoặc yêu cầu gặp người thật -> Xin lỗi và CHÈN MÃ [ACTION:TRANSFER] vào cuối câu.
`;

export const chatWithAI = async (req, res) => {
  try {
    const { sessionId, content } = req.body;
    const { _id: userId, role, name } = req.user; 
    const lowerContent = content.toLowerCase();

    if (!content || content.trim() === "") {
      return res.status(400).json({ message: "Nội dung tin nhắn không được để trống." });
    }

    // --- 2. QUẢN LÝ PHIÊN CHAT ---
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

    // --- 3. BỘ MÁY TÌM KIẾM DATABASE (THÔNG MINH & CHẮC CHẮN 100%) ---
    let dbContext = "=== DỮ LIỆU TỪ DATABASE (CẬP NHẬT REALTIME) ===\n";
    
    // A. XỬ LÝ CHO STAFF / ADMIN
    if (role === 'admin' || role === 'staff') {
      if (lowerContent.includes("kho") || lowerContent.includes("tồn") || lowerContent.includes("hết")) {
        const lowStock = await Product.find({ stock: { $lt: 5 }, status: "active" })
          .select('name stock basePrice salePrice').limit(10).lean();
        dbContext += `[HÀNG SẮP HẾT TRONG KHO]: ${JSON.stringify(lowStock)}\n`;
      }
    } 
    // B. XỬ LÝ CHO KHÁCH HÀNG (USER)
    else {
      // 1. LUÔN LUÔN lấy 5 Truyện Nổi Bật (Để AI luôn có hàng chào khách)
      const featuredProducts = await Product.findFeatured(5)
        .populate("category", "name").select('name basePrice salePrice stock').lean();
      dbContext += `[CÁC TRUYỆN NỔI BẬT ĐANG BÁN]: ${JSON.stringify(featuredProducts)}\n`;

      // 2. Xử lý Giỏ Hàng
      if (lowerContent.includes("giỏ hàng") || lowerContent.includes("cart") || lowerContent.includes("tổng tiền") || lowerContent.includes("mua")) {
        const cart = await Cart.findOne({ user: userId })
          .populate("items.product", "name").select('items totalPrice totalItems discount').lean();
        dbContext += `[GIỎ HÀNG HIỆN TẠI CỦA KHÁCH]: ${cart && cart.items.length > 0 ? JSON.stringify(cart) : "Giỏ hàng đang trống."}\n`;
      }

      // 3. TÌM KIẾM TRUYỆN SIÊU CHÍNH XÁC (Loại bỏ triệt để từ rác tiếng Việt)
      // Các từ này sẽ bị bỏ đi để lấy đúng "lõi" từ khóa (VD: "có naruto ko" -> chỉ giữ lại "naruto")
      const stopWords = ['có', 'không', 'ko', 'tìm', 'cho', 'mình', 'hỏi', 'truyện', 'bộ', 'quyển', 'tập', 'giỏ', 'hàng', 'đang', 'bán', 'gì', 'nào', 'shop', 'nha', 'nhé', 'ạ', 'nhỉ', 'này', 'kia', 'muốn', 'xem', 'thử'];
      
      // Tách câu thành các từ, lọc bỏ stopWords và các ký tự đặc biệt
      const rawWords = lowerContent.replace(/[?.,!]/g, '').split(/\s+/);
      const keywords = rawWords.filter(w => !stopWords.includes(w) && w.length > 1);

      if (keywords.length > 0) {
        // Tạo mảng điều kiện Regex để tìm các từ khóa này trong tên truyện hoặc tags
        const regexQueries = keywords.map(w => ({
          $or: [
            { name: { $regex: w, $options: 'i' } },
            { tags: { $regex: w, $options: 'i' } }
          ]
        }));

        const searchResults = await Product.find({
          status: "active",
          $and: regexQueries // Bắt buộc phải chứa các từ khóa (VD: "Naruto" VÀ "Tập 1")
        })
        .populate("category", "name")
        .select('name basePrice salePrice stock tags')
        .limit(5).lean();

        if (searchResults.length > 0) {
          dbContext += `[KẾT QUẢ TÌM KIẾM THEO YÊU CẦU CỦA KHÁCH]: ${JSON.stringify(searchResults)}\n`;
        } else {
          dbContext += `[KẾT QUẢ TÌM KIẾM THEO YÊU CẦU CỦA KHÁCH]: Không tìm thấy sản phẩm nào khớp với yêu cầu.\n`;
        }
      }
    }
    dbContext += "=================================================\n";

    // --- 4. GỌI GROQ AI VỚI NHIỆT ĐỘ CỰC THẤP ---
    await session.addMessage("user", content);

    const chatHistory = session.messages.slice(-8).map(msg => ({
      role: msg.role === "bot" ? "assistant" : "user",
      content: msg.content
    }));

    const completion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "system", content: `THÔNG TIN NGỮ CẢNH:\n- Tên khách hàng: ${name}\n- Quyền: ${role}\n\n${dbContext}` },
        ...chatHistory
      ],
      model: "llama-3.3-70b-versatile",
      temperature: 0.1, // Nhiệt độ 0.1 ÉP AI chỉ được nói sự thật từ DB
      max_tokens: 1024,
    });

    let aiReply = completion.choices[0]?.message?.content || "Hệ thống đang bảo trì, bạn đợi chút nhé!";
    let isHandover = false;

    // --- 5. XỬ LÝ HANDOVER ---
    if (aiReply.includes("[ACTION:TRANSFER]")) {
      isHandover = true;
      aiReply = aiReply.replace("[ACTION:TRANSFER]", "").trim();
      session.sessionType = "LIVE_SUPPORT";
      session.status = "PENDING";
    }

    // --- 6. LƯU DB VÀ TRẢ KẾT QUẢ ---
    await session.addMessage("bot", aiReply);

    res.status(200).json({
      success: true,
      sessionId: session._id,
      reply: aiReply,
      action: isHandover ? "SWITCH_TO_STAFF" : "CONTINUE",
    });

  } catch (error) {
    console.error(">>> LỖI CHAT CONTROLLER:", error);
    res.status(500).json({ message: "Lỗi kết nối máy chủ AI." });
  }
};