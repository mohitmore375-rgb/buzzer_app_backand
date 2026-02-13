import mongoose from "mongoose";

const gameRoomSchema = new mongoose.Schema({
    roomCode: { type: String, required: true, unique: true },
    hostName: { type: String, required: true },
    status: {
        type: String,
        enum: ["waiting", "active", "completed", "archived"],
        default: "waiting"
    },
    maxPlayers: { type: Number, default: 100 },
    timerEnabled: { type: Boolean, default: false },
    timerDuration: { type: Number, default: 30 },
    createdAt: { type: Date, default: Date.now },
    archivedAt: { type: Date },
});

export const GameRoom = mongoose.model("GameRoom", gameRoomSchema);

const playerSchema = new mongoose.Schema({
    roomId: { type: mongoose.Schema.Types.ObjectId, ref: "GameRoom", required: true },
    name: { type: String, required: true },
    teamName: { type: String },
    role: {
        type: String,
        enum: ["host", "participant"],
        default: "participant"
    },
    socketId: { type: String, required: true },
    joinedAt: { type: Date, default: Date.now },
});

export const Player = mongoose.model("Player", playerSchema);

const buzzEventSchema = new mongoose.Schema({
    roomId: { type: mongoose.Schema.Types.ObjectId, ref: "GameRoom", required: true },
    playerId: { type: mongoose.Schema.Types.ObjectId, ref: "Player", required: true },
    roundNumber: { type: Number, required: true },
    buzzedAt: { type: Date, default: Date.now },
    latencyMs: { type: Number },
});

export const BuzzEvent = mongoose.model("BuzzEvent", buzzEventSchema);
