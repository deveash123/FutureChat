const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const mongoose = require('mongoose');

// --- DATABASE CONNECTION ---
const connectionString = "mongodb+srv://gdeveash:deveash1234@cluster0.5ypsc7q.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

mongoose.connect(connectionString)
  .then(() => console.log('✅ MongoDB Connected!'))
  .catch((err) => console.error('❌ DB Error:', err));

// --- UPDATED SCHEMA (Supports Files) ---
const msgSchema = new mongoose.Schema({
    user: String,
    room: String,
    type: String,      // 'text', 'image', 'file'
    content: String,   // Text or Base64 Data
    fileName: String,  // Name of the file (e.g., "app-release.apk")
    avatar: String,
    timestamp: { type: Date, default: Date.now }
});
const Msg = mongoose.model('Msg', msgSchema);

const io = new Server(server, { maxHttpBufferSize: 1e8 }); // 100MB Limit
app.use(express.static(__dirname));

app.get('/', (req, res) => { res.sendFile(__dirname + '/index.html'); });

// TRACK USERS
let onlineUsers = {};

io.on('connection', (socket) => {
    
    // JOIN ROOM
    socket.on('join room', ({ user, room }) => {
        socket.join(room);
        onlineUsers[socket.id] = { user, room };
        
        // 1. Send Update to Room (Who is here?)
        io.to(room).emit('room users', getRoomUsers(room));
        
        // 2. Load History
        Msg.find({ room: room }).sort({ timestamp: 1 }).limit(50).then(messages => {
            socket.emit('load history', messages);
        });
    });

    // HANDLE MESSAGES & FILES
    socket.on('chat message', (data) => {
        const avatarUrl = `https://api.dicebear.com/7.x/initials/svg?seed=${data.user}&backgroundColor=000000`;
        
        const newMsg = new Msg({
            user: data.user,
            room: data.room,
            type: data.type,
            content: data.content,
            fileName: data.fileName || "",
            avatar: avatarUrl
        });
        
        newMsg.save().then((savedMsg) => {
            io.to(data.room).emit('chat message', savedMsg);
        });
    });

    // TYPING
    socket.on('typing', ({ room, user }) => socket.to(room).emit('display typing', { user }));
    socket.on('stop typing', ({ room }) => socket.to(room).emit('hide typing'));

    // DISCONNECT
    socket.on('disconnect', () => {
        const userData = onlineUsers[socket.id];
        if (userData) {
            delete onlineUsers[socket.id];
            io.to(userData.room).emit('room users', getRoomUsers(userData.room));
        }
    });
});

// Helper: Get users in a specific room
function getRoomUsers(room) {
    return Object.values(onlineUsers).filter(u => u.room === room).map(u => u.user);
}

server.listen(3000, () => { console.log('Server running on *:3000'); });