const Room = require('../models/Room');

// Generate a random 6-character room code
function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

// Convert a Mongoose Room document to a GameRoom object matching the frontend schema
function toGameRoom(room) {
    return {
        code: room.code,
        hostId: room.hostSocketId,
        hostName: room.hostName,
        maxParticipants: room.maxParticipants,
        timerEnabled: room.timerEnabled,
        timerDuration: room.timerDuration,
        participants: room.participants || [],
        isGameStarted: room.isGameStarted,
        isBuzzerLocked: room.isBuzzerLocked,
        buzzResults: room.buzzResults || [],
        currentRound: room.currentRound,
    };
}

module.exports = (io) => {
    // Map of room code -> timer interval (for server-side countdown)
    const timerMap = {};

    io.on('connection', (socket) => {
        console.log('[Socket] Client connected:', socket.id);

        // ─── CREATE ROOM ───────────────────────────────────────────────────────
        socket.on('createRoom', async ({ hostName, maxParticipants, timerEnabled, timerDuration }) => {
            try {
                // Generate unique room code
                console.log('[Socket] Generating room code for', hostName);
                let code;
                let attempts = 0;
                do {
                    code = generateRoomCode();
                    console.log(`[Socket] Attempt ${attempts + 1}: code ${code}`);
                    attempts++;
                } while (await Room.findOne({ code }) && attempts < 10);

                console.log(`[Socket] Selected code: ${code}`);

                // Create the host player object
                const hostPlayer = {
                    id: socket.id,
                    name: hostName || 'Host',
                    role: 'host',
                    score: 0,
                };

                // Create room document
                const room = new Room({
                    code,
                    hostSocketId: socket.id,
                    hostName: hostName || 'Host',
                    maxParticipants: maxParticipants || 10,
                    timerEnabled: !!timerEnabled,
                    timerDuration: timerDuration || 10,
                    participants: [], // Host is no longer a participant
                    isGameStarted: false,
                    isBuzzerLocked: false,
                    buzzResults: [],
                    currentRound: 0,
                });
                await room.save();

                socket.join(code);
                socket.roomCode = code;

                const gameRoom = toGameRoom(room);
                socket.emit('roomCreated', gameRoom);
                console.log(`[Socket] Room ${code} created by ${hostName}`);
            } catch (err) {
                console.error('[Socket] createRoom error:', err);
                socket.emit('error', 'Could not create room');
            }
        });

        // ─── JOIN ROOM ─────────────────────────────────────────────────────────
        socket.on('joinRoom', async ({ code, playerName, teamName }) => {
            try {
                const room = await Room.findOne({ code });
                if (!room) {
                    return socket.emit('error', 'Room not found. Check the room code.');
                }
                if (room.isGameStarted) {
                    return socket.emit('error', 'Game has already started.');
                }
                if (room.participants.length >= room.maxParticipants) {
                    return socket.emit('error', 'Room is full.');
                }

                const newPlayer = {
                    id: socket.id,
                    name: playerName || 'Player',
                    teamName: teamName || undefined,
                    role: 'participant',
                    score: 0,
                };

                room.participants.push(newPlayer);
                await room.save();

                socket.join(code);
                socket.roomCode = code;

                const gameRoom = toGameRoom(room);

                // Tell this socket the full updated room
                socket.emit('roomUpdate', gameRoom);
                // Tell all OTHER sockets in the room a player joined
                socket.to(code).emit('playerJoined', newPlayer);
                socket.to(code).emit('roomUpdate', gameRoom);

                console.log(`[Socket] ${playerName} joined room ${code}`);
            } catch (err) {
                console.error('[Socket] joinRoom error:', err);
                socket.emit('error', 'Could not join room');
            }
        });

        // ─── START GAME ────────────────────────────────────────────────────────
        socket.on('startGame', async (code) => {
            try {
                const room = await Room.findOne({ code });
                if (!room) return;
                if (room.hostSocketId !== socket.id) {
                    return socket.emit('error', 'Only the host can start the game.');
                }

                // Award point to the first player who buzzed in the previous round
                if (room.buzzResults && room.buzzResults.length > 0) {
                    const winnerId = room.buzzResults[0].playerId;
                    const winnerIndex = room.participants.findIndex(p => p.id === winnerId);
                    if (winnerIndex !== -1) {
                        room.participants[winnerIndex].score += 1;
                        console.log(`[Socket] Point awarded to ${room.participants[winnerIndex].name}. New score: ${room.participants[winnerIndex].score}`);
                    }
                }

                room.isGameStarted = true;
                room.isBuzzerLocked = false;
                room.currentRound = (room.currentRound || 0) + 1;
                room.buzzResults = [];
                await room.save();

                const gameRoom = toGameRoom(room);
                io.to(code).emit('gameStarted');
                io.to(code).emit('roomUpdate', gameRoom);

                // Start server-side timer if enabled
                if (room.timerEnabled && room.timerDuration > 0) {
                    // Clear any existing timer for this room
                    if (timerMap[code]) {
                        clearInterval(timerMap[code].interval);
                        clearTimeout(timerMap[code].timeout);
                    }

                    let secondsLeft = room.timerDuration;
                    io.to(code).emit('timerUpdate', secondsLeft);

                    timerMap[code] = {};
                    timerMap[code].interval = setInterval(() => {
                        secondsLeft--;
                        io.to(code).emit('timerUpdate', secondsLeft);
                        if (secondsLeft <= 0) {
                            clearInterval(timerMap[code].interval);
                            io.to(code).emit('timerExpired');
                        }
                    }, 1000);
                }

                console.log(`[Socket] Game started in room ${code}, round ${room.currentRound}`);
            } catch (err) {
                console.error('[Socket] startGame error:', err);
                socket.emit('error', 'Could not start game');
            }
        });

        // ─── PRESS BUZZER ──────────────────────────────────────────────────────
        socket.on('pressBuzzer', async (code) => {
            try {
                const room = await Room.findOne({ code });
                if (!room) return;
                if (!room.isGameStarted || room.isBuzzerLocked) return; // Already locked

                const player = room.participants.find(p => p.id === socket.id);
                if (!player) return;

                const buzzResult = {
                    playerId: socket.id,
                    playerName: player.name,
                    teamName: player.teamName,
                    timestamp: Date.now(),
                };

                room.isBuzzerLocked = true;
                room.buzzResults.push(buzzResult);
                await room.save();

                // Stop timer if running
                if (timerMap[code]) {
                    clearInterval(timerMap[code].interval);
                    clearTimeout(timerMap[code].timeout);
                    delete timerMap[code];
                }

                const gameRoom = toGameRoom(room);
                io.to(code).emit('buzzerLocked', buzzResult);
                io.to(code).emit('roomUpdate', gameRoom);

                console.log(`[Socket] ${player.name} buzzed in room ${code}`);
            } catch (err) {
                console.error('[Socket] pressBuzzer error:', err);
            }
        });

        // ─── RESET BUZZER ──────────────────────────────────────────────────────
        socket.on('resetBuzzer', async (code) => {
            try {
                const room = await Room.findOne({ code });
                if (!room) return;
                if (room.hostSocketId !== socket.id) {
                    return socket.emit('error', 'Only the host can reset the buzzer.');
                }

                room.isBuzzerLocked = false;
                await room.save();

                const gameRoom = toGameRoom(room);
                io.to(code).emit('buzzerReset');
                io.to(code).emit('roomUpdate', gameRoom);

                console.log(`[Socket] Buzzer reset in room ${code}`);
            } catch (err) {
                console.error('[Socket] resetBuzzer error:', err);
            }
        });

        // ─── LEAVE ROOM ────────────────────────────────────────────────────────
        socket.on('leaveRoom', async (code) => {
            await handleLeave(socket, code, io, timerMap);
        });

        // ─── DISCONNECT ────────────────────────────────────────────────────────
        socket.on('disconnect', async () => {
            console.log('[Socket] Client disconnected:', socket.id);
            const code = socket.roomCode;
            if (code) {
                await handleLeave(socket, code, io, timerMap);
            }
        });
    });
};

// ─── SHARED LEAVE LOGIC ────────────────────────────────────────────────────────
async function handleLeave(socket, code, io, timerMap) {
    try {
        const room = await Room.findOne({ code });
        if (!room) return;

        // Remove the player from participants
        room.participants = room.participants.filter(p => p.id !== socket.id);

        // If host left or room is empty, delete the room
        if (room.hostSocketId === socket.id || room.participants.length === 0) {
            // Stop timer
            if (timerMap[code]) {
                clearInterval(timerMap[code].interval);
                clearTimeout(timerMap[code].timeout);
                delete timerMap[code];
            }
            await Room.deleteOne({ code });
            io.to(code).emit('roomClosed');
            console.log(`[Socket] Room ${code} closed`);
        } else {
            await room.save();
            const gameRoom = {
                code: room.code,
                hostId: room.hostSocketId,
                hostName: room.hostName,
                maxParticipants: room.maxParticipants,
                timerEnabled: room.timerEnabled,
                timerDuration: room.timerDuration,
                participants: room.participants || [],
                isGameStarted: room.isGameStarted,
                isBuzzerLocked: room.isBuzzerLocked,
                buzzResults: room.buzzResults || [],
                currentRound: room.currentRound,
            };
            io.to(code).emit('playerLeft', socket.id);
            io.to(code).emit('roomUpdate', gameRoom);
            console.log(`[Socket] Player ${socket.id} left room ${code}`);
        }

        socket.leave(code);
    } catch (err) {
        console.error('[Socket] handleLeave error:', err);
    }
}
