import { Router } from "express";
import { storage } from "../storage";
import { GameRoom, Player, BuzzEvent } from "../db/schema";
import { logger } from "../logger";

const router = Router();

// List all active rooms
router.get("/", (req, res) => {
    const rooms = storage.getActiveRooms().map(room => ({
        code: room.code,
        hostName: room.hostName,
        playerCount: room.participants.length,
        status: room.status,
        createdAt: room.createdAt,
    }));
    res.json({ rooms });
});

// Get specific room details
router.get("/:code", (req, res) => {
    const code = req.params.code ? req.params.code.toUpperCase() : "";
    const room = storage.getRoom(code);

    if (!room) {
        return res.status(404).json({ error: "Room not found" });
    }

    res.json({ room });
});

// Get room history (if exists in DB)
router.get("/:code/history", async (req, res) => {
    const code = req.params.code ? req.params.code.toUpperCase() : "";
    try {
        const room = await GameRoom.findOne({ roomCode: code });

        if (!room) {
            return res.status(404).json({ error: "Room history not found" });
        }

        // Fetch related data
        const players = await Player.find({ roomId: room._id });
        const buzzEvents = await BuzzEvent.find({ roomId: room._id });

        res.json({
            history: {
                ...room.toObject(),
                players,
                buzzEvents
            }
        });
    } catch (e) {
        logger.error("Error fetching room history", e);
        res.status(500).json({ error: "Internal server error" });
    }
});

export default router;
