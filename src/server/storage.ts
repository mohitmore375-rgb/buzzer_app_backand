import { GameRoom, Player, BuzzEvent } from "./db/schema";
import { GameRoom as SharedGameRoom, Player as SharedPlayer } from "../shared/schema";
import { logger } from "./logger";

// In-memory cache for active rooms to ensure high performance
// maintaining this for quick access, but standardizing on Mongoose for persistence
const activeRooms = new Map<string, SharedGameRoom>();

// Cleanup inactive rooms every 5 minutes
setInterval(() => {
    const now = Date.now();
    activeRooms.forEach((room, code) => {
        const createdAt = room.createdAt ? room.createdAt.getTime() : now;
        const timeSinceCreation = now - createdAt;

        if (room.participants.length === 0 && timeSinceCreation > 30 * 60 * 1000) {
            storage.deleteRoom(code);
        }
    });
}, 5 * 60 * 1000);

export class GameRoomStorage {
    async createRoom(
        code: string,
        hostName: string,
        maxParticipants: number,
        timerEnabled: boolean,
        timerDuration: number
    ): Promise<SharedGameRoom> {
        logger.info(`Creating room ${code} for host ${hostName}`);

        // Save to database
        try {
            await GameRoom.create({
                roomCode: code,
                hostName: hostName,
                status: "waiting",
                maxPlayers: maxParticipants,
                timerEnabled: timerEnabled,
                timerDuration: timerDuration,
            });
        } catch (e) {
            logger.error("Failed to create room in DB", e);
        }

        const room: SharedGameRoom = {
            code,
            hostName,
            hostId: "",
            maxParticipants,
            timerEnabled,
            timerDuration,
            participants: [],
            isGameStarted: false,
            isBuzzerLocked: false,
            buzzResults: [],
            currentRound: 0,
            status: "waiting",
            createdAt: new Date(),
        };

        activeRooms.set(code, room);
        return room;
    }

    getRoom(code: string): SharedGameRoom | undefined {
        return activeRooms.get(code);
    }

    async addPlayer(code: string, player: SharedPlayer, socketId: string): Promise<void> {
        const room = activeRooms.get(code);
        if (!room) return;

        // Check if player already exists in memory
        const existingPlayer = room.participants.find(p => p.id === player.id);
        if (!existingPlayer) {
            room.participants.push(player);
        } else {
            // Update existing player connections status
            existingPlayer.connected = true;
        }

        // If host, update hostId
        if (player.role === 'host') {
            room.hostId = player.id;
        }

        try {
            // Find room document
            const dbRoom = await GameRoom.findOne({ roomCode: code });

            if (dbRoom) {
                // Check if player exists in DB
                // We use socketId and roomId to check uniqueness for now as per previous logic
                // But typically player ID should be persistent. Here player.id is socket.id from routes.ts often.
                // Let's stick to the previous logic of syncing.

                const dbPlayer = await Player.findOne({
                    socketId: socketId,
                    roomId: dbRoom._id
                });

                if (!dbPlayer) {
                    await Player.create({
                        roomId: dbRoom._id,
                        name: player.name,
                        teamName: player.teamName || null,
                        role: player.role,
                        socketId: socketId,
                    });
                }
            }
        } catch (err) {
            logger.error(`Failed to persist player ${player.name} to DB:`, err);
        }
    }

    removePlayer(code: string, playerId: string): void {
        const room = activeRooms.get(code);
        if (!room) return;

        room.participants = room.participants.filter(p => p.id !== playerId);
    }

    async deleteRoom(code: string): Promise<void> {
        logger.info(`Deleting room ${code}`);
        activeRooms.delete(code);

        // Mark as archived in DB
        try {
            await GameRoom.findOneAndUpdate(
                { roomCode: code },
                { status: "archived", archivedAt: new Date() }
            );
        } catch (e) {
            logger.error("Error archiving room in DB", e);
        }
    }

    getActiveRooms(): SharedGameRoom[] {
        return Array.from(activeRooms.values());
    }
}

export const storage = new GameRoomStorage();
