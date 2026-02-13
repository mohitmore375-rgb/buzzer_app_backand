import { Server, Socket } from "socket.io";
import { storage } from "./storage";
import { logger } from "./logger";
import { ClientToServerEvents, ServerToClientEvents, SocketData, Player, BuzzResult } from "../shared/schema";
import { GameRoom, Player as PlayerModel, BuzzEvent } from "./db/schema";
import { createRoomSchema, joinRoomSchema } from "./middleware/validation";

export function registerSocketRoutes(io: Server) {
    io.on("connection", (socket: Socket<ClientToServerEvents, ServerToClientEvents, {}, SocketData>) => {
        logger.info(`Socket connected: ${socket.id}`);

        // Create Room
        socket.on("createRoom", async (data, callback) => {
            try {
                // Validate input
                const validation = createRoomSchema.safeParse(data);
                if (!validation.success) {
                    const errorMsg = validation.error.errors.map(e => e.message).join(", ");
                    socket.emit("error", errorMsg);
                    if (callback) callback({ error: errorMsg });
                    return;
                }

                const { hostName, maxParticipants, timerEnabled, timerDuration } = data;

                // Generate unique code
                let code = "";
                let isUnique = false;
                while (!isUnique) {
                    code = Math.random().toString(36).substring(2, 8).toUpperCase();
                    if (!storage.getRoom(code)) {
                        isUnique = true;
                    }
                }

                const room = await storage.createRoom(code, hostName, maxParticipants, timerEnabled, timerDuration);

                // Prepare host player object
                const player: Player = {
                    id: socket.id,
                    name: hostName,
                    role: "host",
                    score: 0,
                    connected: true
                };

                await storage.addPlayer(code, player, socket.id);

                socket.data.roomId = code;
                socket.data.isHost = true;
                socket.data.role = "host";
                socket.data.name = hostName;

                socket.join(code);

                // Send success response via callback if provided (standard pattern)
                if (callback) callback({ success: true, room });

                // Frontend expects 'roomCreated' event or just success callback? 
                // Based on schema, 'roomCreated' is ServerToClient. 
                socket.emit("roomCreated", room);

                logger.info(`Room created: ${code} by ${hostName}`);
            } catch (err) {
                logger.error("Error creating room:", err);
                socket.emit("error", "Internal server error");
                if (callback) callback({ error: "Internal server error" });
            }
        });

        // Join Room
        socket.on("joinRoom", async (data, callback) => {
            try {
                // Validate input
                const validation = joinRoomSchema.safeParse(data);
                if (!validation.success) {
                    const errorMsg = validation.error.errors.map(e => e.message).join(", ");
                    socket.emit("error", errorMsg);
                    if (callback) callback({ error: errorMsg });
                    return;
                }

                const { code, playerName, teamName } = data;
                const room = storage.getRoom(code);

                if (!room) {
                    socket.emit("error", "Room not found");
                    if (callback) callback({ error: "Room not found" });
                    return;
                }

                const player: Player = {
                    id: socket.id,
                    name: playerName,
                    teamName,
                    role: "participant",
                    score: 0,
                    connected: true
                };

                await storage.addPlayer(code, player, socket.id);

                socket.data.roomId = code;
                socket.data.playerId = socket.id;
                socket.data.name = playerName;
                socket.data.isHost = false;
                socket.data.role = "participant";

                socket.join(code);
                socket.to(code).emit("playerJoined", player);

                // Send room state to joining player
                socket.emit("roomCreated", room); // Frontend uses 'roomCreated' or 'roomUpdate' to init state?
                // Actually typically we send the current room state.

                if (callback) callback({ success: true, room });

                logger.info(`Player ${playerName} joined room ${code}`);
            } catch (err) {
                logger.error("Error joining room:", err);
                socket.emit("error", "Internal server error");
            }
        });

        // Start Game
        socket.on("startGame", (code) => {
            const room = storage.getRoom(code);
            if (room && socket.data.role === 'host') {
                room.isGameStarted = true;
                room.status = "active";
                io.to(code).emit("gameStarted");
                io.to(code).emit("roomUpdate", room);
            }
        });

        // Press Buzzer
        socket.on("pressBuzzer", async (code) => {
            const room = storage.getRoom(code);
            if (!room || !room.isGameStarted) return;

            if (!room.isBuzzerLocked) {
                room.isBuzzerLocked = true;

                const result: BuzzResult = {
                    playerId: socket.id,
                    playerName: socket.data.name || "Unknown",
                    timestamp: Date.now()
                };

                room.buzzResults.push(result);

                io.to(code).emit("buzzerLocked", result);
                io.to(code).emit("roomUpdate", room);

                // Persist buzz
                try {
                    const dbRoom = await GameRoom.findOne({ roomCode: code });
                    if (dbRoom) {
                        const dbPlayer = await PlayerModel.findOne({
                            socketId: socket.id,
                            roomId: dbRoom._id
                        });

                        if (dbPlayer) {
                            // Need to track round number, assuming 1 for now or from room state
                            await BuzzEvent.create({
                                roomId: dbRoom._id,
                                playerId: dbPlayer._id,
                                roundNumber: room.currentRound || 1,
                                buzzedAt: new Date(result.timestamp),
                            });
                        }
                    }
                } catch (e) {
                    logger.error("Failed to log buzz event", e);
                }
            }
        });

        // Reset Buzzer
        socket.on("resetBuzzer", (code) => {
            const room = storage.getRoom(code);
            if (room && socket.data.role === 'host') {
                room.isBuzzerLocked = false;
                room.buzzResults = [];
                io.to(code).emit("buzzerReset");
                io.to(code).emit("roomUpdate", room);
            }
        });

        // Leave Room
        socket.on("leaveRoom", (code) => {
            // Logic handled in disconnect mostly, but explicit leave:
            const playerId = socket.id;
            storage.removePlayer(code, playerId);
            socket.leave(code);
            io.to(code).emit("playerLeft", playerId);
        });

        socket.on("disconnect", () => {
            const { roomId, role } = socket.data;
            if (roomId) {
                logger.info(`Socket disconnected: ${socket.id} (Room: ${roomId})`);

                storage.removePlayer(roomId, socket.id);
                io.to(roomId).emit("playerLeft", socket.id);

                if (role === 'host') {
                    // Optional: warn players host left
                }
            }
        });
    });
}
