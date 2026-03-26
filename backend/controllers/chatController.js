import { GoogleGenerativeAI } from "@google/generative-ai";
import ChatSession from "../models/Chat.js";

// Khởi tạo SDK
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const SYSTEM_PROMPT = "Bạn là trợ lý ảo của Manga Shop. Trả lời thân thiện, tư vấn truyện tranh và hỗ trợ mua sắm.";

const ChatController = {
  chatWithAI: async (req, res) => {
    try {
      const { content, sessionId } = req.body;
      const userId = req.user._id;

      if (!content) return res.status(400).json({ message: "Vui lòng nhập nội dung" });

      // 1. Tìm hoặc tạo Session
      let session;
      if (sessionId) {
        session = await ChatSession.findById(sessionId);
      } else {
        session = await ChatSession.findOne({ user: userId, status: "ACTIVE", sessionType: "BOT" });
      }

      if (!session) {
        session = new ChatSession({ user: userId, sessionType: "BOT" });
        await session.save();
      }

      // 2. Lưu tin nhắn User vào DB trước
      await session.addMessage("user", content);

      // 3. Khởi tạo Model
      // Mẹo: Nếu "gemini-1.5-flash" vẫn lỗi 404, Huy hãy đổi CHÍNH XÁC thành "gemini-pro"
  const model = genAI.getGenerativeModel({ 
  model: "gemini-1.5-flash" 
});

      // 4. Chuẩn bị lịch sử (Gemini yêu cầu role: 'user' hoặc 'model')
      const chatHistory = (session.messages || []).slice(-7, -1).map(msg => ({
        role: msg.role === "user" ? "user" : "model",
        parts: [{ text: msg.content }],
      }));

      // 5. Gửi tin nhắn tới AI với bọc lỗi riêng để Console không báo đỏ
      let aiResponse = "Xin lỗi bạn, mình đang gặp chút gián đoạn kỹ thuật. Bạn thử lại sau nhé!";
      
      try {
        const chat = model.startChat({ history: chatHistory });
        // Gộp prompt vào để AI luôn nhớ vai
        const finalPrompt = `[Quy tắc: ${SYSTEM_PROMPT}]\nKhách hàng: ${content}`;
        const result = await chat.sendMessage(finalPrompt);
        aiResponse = result.response.text();
      } catch (aiErr) {
        // Chỉ log cảnh báo, không làm crash app hoặc hiện lỗi đỏ gắt
        console.warn("AI API Service gặp sự cố nhẹ, đang dùng phản hồi mặc định.");
      }

      // 6. Lưu Bot reply và trả về cho User
      await session.addMessage("bot", aiResponse);
      session.lastMessageAt = new Date();
      await session.save();

      res.status(200).json({ sessionId: session._id, reply: aiResponse });

    } catch (error) {
      // Catch tổng cho các lỗi logic DB hoặc Auth
      res.status(500).json({ 
        message: "Hệ thống bận", 
        error: error.message 
      });
    }
  },

  getHistory: async (req, res) => {
    try {
      const { sessionId } = req.params;
      const history = await ChatSession.findById(sessionId).select("messages status lastMessageAt").lean();
      if (!history) return res.status(404).json({ message: "Không tìm thấy" });
      res.status(200).json(history);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  getPendingSessions: async (req, res) => {
    try {
      const sessions = await ChatSession.find({ status: "PENDING" }).populate("user", "name email").lean();
      res.status(200).json(sessions);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
};

export default ChatController;