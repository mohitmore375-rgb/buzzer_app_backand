import { Router } from "express";
import { storage } from "../storage";
import { GameRoom, Player, BuzzEvent } from "../db/schema";
import { logger } from "../logger";

const router = Router();

router.get("/", async (req, res) => {
    try {
        // Get live stats
        const activeRoomCount = storage.getActiveRooms().length;

        // Get aggregated stats from DB
        const totalRooms = await GameRoom.countDocuments();
        const totalPlayers = await Player.countDocuments();
        const totalBuzzes = await BuzzEvent.countDocuments();

        res.json({
            activeRooms: activeRoomCount,
            totalRooms,
            totalPlayers,
            totalBuzzes,
            uptime: process.uptime(),
        });
    } catch (error) {
        logger.error("Error fetching stats:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

export default router;
