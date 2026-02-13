const User = require('../models/User');
const Room = require('../models/Room');

module.exports = (io) => {
    io.on('connection', (socket) => {
        console.log('New client connected:', socket.id);

        // Join Room
        socket.on('join_room', async ({ username, roomCode, isHost }) => {
            try {
                // Find or create room
                let room = await Room.findOne({ roomCode });
                if (!room) {
                    if (isHost) {
                        room = new Room({ roomCode, hostSocketId: socket.id });
                        await room.save();
                    } else {
                        return socket.emit('error', 'Room does not exist');
                    }
                } else if (isHost) {
                    // If host reconnects or a new host tries to join (simple logic: update host socket)
                    room.hostSocketId = socket.id;
                    await room.save();
                }

                // Create user
                const newUser = new User({
                    username,
                    room: roomCode,
                    isHost,
                    socketId: socket.id
                });
                await newUser.save();

                socket.join(roomCode);

                // Notify room
                const users = await User.find({ room: roomCode });
                io.to(roomCode).emit('room_users', users);
                io.to(roomCode).emit('buzz_state', {
                    isBuzzActive: room.isBuzzActive,
                    buzzedUser: room.buzzedUser
                });

                console.log(`${username} joined room ${roomCode}`);
            } catch (err) {
                console.error('Join room error:', err);
                socket.emit('error', 'Could not join room');
            }
        });

        // Buzz
        socket.on('buzz', async ({ roomCode }) => {
            try {
                const room = await Room.findOne({ roomCode });
                if (room && room.isBuzzActive && !room.buzzedUser) {
                    const user = await User.findOne({ socketId: socket.id });
                    if (user) {
                        room.buzzedUser = user.username;
                        room.buzzedTimestamp = new Date();
                        await room.save();

                        io.to(roomCode).emit('buzz_state', {
                            isBuzzActive: room.isBuzzActive,
                            buzzedUser: room.buzzedUser
                        });
                        console.log(`${user.username} buzzed in room ${roomCode}`);
                    }
                }
            } catch (err) {
                console.error('Buzz error:', err);
            }
        });

        // Toggle Buzz Active (Host Only)
        socket.on('toggle_buzz', async ({ roomCode, isActive }) => {
            try {
                const room = await Room.findOne({ roomCode });
                if (room) {
                    // Verify host
                    if (room.hostSocketId !== socket.id) {
                        // Double check with user DB if socket ID matches host
                        const user = await User.findOne({ socketId: socket.id });
                        if (!user || !user.isHost) return;
                    }

                    room.isBuzzActive = isActive;
                    if (isActive) {
                        room.buzzedUser = null; // Reset buzz when activating
                    }
                    await room.save();

                    io.to(roomCode).emit('buzz_state', {
                        isBuzzActive: room.isBuzzActive,
                        buzzedUser: room.buzzedUser
                    });
                }
            } catch (err) {
                console.error('Toggle buzz error:', err);
            }
        });

        // Reset Buzz (Host Only)
        socket.on('reset_buzz', async ({ roomCode }) => {
            try {
                const room = await Room.findOne({ roomCode });
                if (room) {
                    // Verify host
                    if (room.hostSocketId !== socket.id) {
                        // Double check with user DB if socket ID matches host
                        const user = await User.findOne({ socketId: socket.id });
                        if (!user || !user.isHost) return;
                    }

                    room.buzzedUser = null;
                    room.isBuzzActive = true; // Usually reset means "ready for next question"
                    await room.save();

                    io.to(roomCode).emit('buzz_state', {
                        isBuzzActive: room.isBuzzActive,
                        buzzedUser: room.buzzedUser
                    });
                }
            } catch (err) {
                console.error('Reset buzz error:', err);
            }
        });

        // Disconnect
        socket.on('disconnect', async () => {
            console.log('Client disconnected:', socket.id);
            try {
                const user = await User.findOneAndDelete({ socketId: socket.id });
                if (user) {
                    const users = await User.find({ room: user.room });
                    io.to(user.room).emit('room_users', users);
                }
            } catch (err) {
                console.error('Disconnect error:', err);
            }
        });
    });
};
