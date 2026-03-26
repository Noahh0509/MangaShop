import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import swaggerSpec from "./config/swaggerConfig.js";
import { connectDB } from "./config/db.js";
import usersRouter from "./routes/usersRouters.js";
import authRouter from "./routes/authRouters.js";
import cartRouter from "./routes/cartRouters.js";
import checkoutRouter from "./routes/checkoutRouters.js";
import productRouter from "./routes/productRouters.js";
import promotionRouter from "./routes/promotionRouters.js";
import chatRoutes from "./routes/chatRouters.js";
connectDB();

const app = express();
app.use(
  cors({
    origin: process.env.CLIENT_URL,
    //origin: "https://manga-shop-fe.vercel.app",
    credentials: true,
  }),
);

app.use(express.json());
app.use(cookieParser());

// ─── Swagger UI ─────────────────────────────────────────────────
app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    customSiteTitle: "MangaShop API Docs",
    customCss: `
        .swagger-ui .topbar { background-color: #0e0e0e; }
        .swagger-ui .topbar-wrapper img { display: none; }
        .swagger-ui .topbar-wrapper::after { content: 'MangaShop API'; color: #c9a84c; font-size: 18px; font-weight: 600; }
    `,
  }),
);

// ─── Routes ─────────────────────────────────────────────────────
app.use("/api/auth", authRouter);
app.use("/api/users", usersRouter);
app.use("/api/cart", cartRouter);
app.use("/api/checkout", checkoutRouter);
app.use("/api/products", productRouter);
app.use("/api/promotions", promotionRouter);
app.use("/api/chat", chatRoutes);
// ─── 404 ────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ message: "Route không tồn tại." });
});

app.listen(5000, () => {
  console.log("Server chạy tại http://localhost:5000");
  console.log("Swagger UI tại http://localhost:5000/api-docs");
});
