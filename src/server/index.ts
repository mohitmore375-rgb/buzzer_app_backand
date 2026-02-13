import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import helmet from "helmet";
import { registerSocketRoutes } from "./routes";
import { logger } from "./logger";
import { apiLimiter } from "./middleware/rateLimiter";
import roomsRouter from "./api/rooms";
import statsRouter from "./api/stats";
import dotenv from "dotenv";
import { connectDB } from "./db";

dotenv.config();

// Connect to MongoDB
connectDB();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: process.env.CORS_ORIGIN || "*",
        methods: ["GET", "POST"],
    },
});

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use("/api", apiLimiter);

// API Routes
app.use("/api/rooms", roomsRouter);
app.use("/api/stats", statsRouter);

app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Socket.IO
registerSocketRoutes(io);

const PORT = parseInt(process.env.PORT || "5000", 10);

httpServer.listen(PORT, "0.0.0.0", () => {
    logger.info(`Server running on port ${PORT}`);
});

// Graceful shutdown
process.on("SIGTERM", () => {
    logger.info("SIGTERM received. Shutting down gracefully");
    httpServer.close(() => {
        logger.info("Process terminated");
        process.exit(0);
    });
});
