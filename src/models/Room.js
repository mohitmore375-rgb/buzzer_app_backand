const mongoose = require('mongoose');

const RoomSchema = new mongoose.Schema({
    roomCode: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    hostSocketId: {
        type: String
    },
    isBuzzActive: {
        type: Boolean,
        default: false
    },
    buzzedUser: {
        type: String, // Username of the person who buzzed
        default: null
    },
    buzzedTimestamp: {
        type: Date,
        default: null
    }
}, { timestamps: true });

module.exports = mongoose.model('Room', RoomSchema);
