const express = require('express');
const mongoose = require('mongoose');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const dotenv = require('dotenv');
const socketHandler = require('./socket/socketHandler');

dotenv.config();

const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors());
app.use(express.json());

// Routes (Optional for now, primarily socket based)
app.get('/', (req, res) => {
    res.send('Buzzer App Backend is Running');
});

// MongoDB Connection
const MONGO_URI = process.env.MONGO_URI || process.env.DATABASE_URL || 'mongodb://localhost:27017/buzzer_app';
mongoose.connect(MONGO_URI)
    .then(() => console.log('MongoDB Connected'))
    .catch(err => console.error('MongoDB Connection Error:', err));

// Socket.io Setup
const io = new Server(server, {
    cors: {
        origin: "*", // Allow all origins for simplicity (or configure strictly)
        methods: ["GET", "POST"]
    }
});

// Initialize Socket Logic
socketHandler(io);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
