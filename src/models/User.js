const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        trim: true
    },
    room: {
        type: String,
        required: true
    },
    isHost: {
        type: Boolean,
        default: false
    },
    socketId: {
        type: String,
        required: true
    },
    score: {
        type: Number,
        default: 0
    }
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);
