const mongoose = require('mongoose');

// Player sub-document schema (matches frontend Player interface)
const PlayerSchema = new mongoose.Schema({
    id: { type: String, required: true },           // socketId
    name: { type: String, required: true },
    teamName: { type: String, default: undefined },
    role: { type: String, enum: ['host', 'participant'], default: 'participant' },
    score: { type: Number, default: 0 },
}, { _id: false });

// BuzzResult sub-document schema (matches frontend BuzzResult interface)
const BuzzResultSchema = new mongoose.Schema({
    playerId: { type: String, required: true },
    playerName: { type: String, required: true },
    teamName: { type: String, default: undefined },
    timestamp: { type: Number, required: true },    // Unix ms
}, { _id: false });

// Main Room document (maps to frontend GameRoom interface)
const RoomSchema = new mongoose.Schema({
    code: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        uppercase: true,
    },
    hostSocketId: { type: String, required: true },
    hostName: { type: String, required: true },
    maxParticipants: { type: Number, default: 10 },
    timerEnabled: { type: Boolean, default: false },
    timerDuration: { type: Number, default: 10 },
    participants: { type: [PlayerSchema], default: [] },
    isGameStarted: { type: Boolean, default: false },
    isBuzzerLocked: { type: Boolean, default: false },
    buzzResults: { type: [BuzzResultSchema], default: [] },
    currentRound: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('Room', RoomSchema);
