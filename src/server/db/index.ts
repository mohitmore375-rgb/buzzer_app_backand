import mongoose from "mongoose";
import { logger } from "../logger";

export async function connectDB() {
    try {
        const uri = process.env.DATABASE_URL || "mongodb://localhost:27017/buzzer_app";
        console.log("Connecting to MongoDB");
        await mongoose.connect(uri);
        logger.info("Connected to MongoDB");
    } catch (error) {
        logger.error("Error connecting to MongoDB", error);
        process.exit(1);
    }
}
