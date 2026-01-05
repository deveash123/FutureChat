const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const mongoose = require('mongoose');

// --- DATABASE CONFIGURATION ---
// Your Password 'deveash1234' is included:
const connectionString = "mongodb+srv://gdeveash:deveash1234@cluster0.5ypsc7q.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

mongoose.connect(connectionString)
  .then(() => console.log('✅ Connected to MongoDB!'))
  .catch((err) => console.error('❌ Database Error:', err));

// SCHEMA: Messages
const msgSchema = new mongoose.Schema({
    user: String,
    room: String,
    type: String,     
    content: String,  
    avatar: String,   // NEW: Save user avatar URL
    timestamp: { type: Date, default: Date.now }
});
const Msg = mongoose.model('Msg', msgSchema);

const io = new Server(server, { maxHttpBufferSize: 1e8 });
app.use(express.static(__dirname));

app.get('/', (req, res) => { res.sendFile(__dirname + '/index.html'); });

// TRACK ONLINE USERS
let onlineUsers = {};

io.on('connection', (socket) => {
    
    // 1. JOIN ROOM & NOTIFY OTHERS
    socket.on('join room', ({ user, room }) => {
        socket.join(room);
        
        // Track User
        onlineUsers[socket.id] = { user, room };
        
        // Broadcast "User Online" to room
        io.to(room).emit('user status', { user, status: 'online' });

        // Load History
        Msg.find({ room: room }).sort({ timestamp: 1 }).limit(50).then(messages => {
            socket.emit('load history', messages);
        });
    });

    // 2. HANDLING TYPING
    socket.on('typing', ({ room, user }) => {
        socket.to(room).emit('display typing', { user });
    });

    socket.on('stop typing', ({ room }) => {
        socket.to(room).emit('hide typing');
    });

    // 3. SEND MESSAGE
    socket.on('chat message', (data) => {
        // Create Avatar URL based on name
        const avatarUrl = `https://api.dicebear.com/7.x/initials/svg?seed=${data.user}&backgroundColor=007AFF`;
        
        const newMsg = new Msg({
            user: data.user,
            room: data.room,
            type: data.type,
            content: data.content,
            avatar: avatarUrl
        });
        
        newMsg.save().then((savedMsg) => {
            io.to(data.room).emit('chat message', savedMsg);
        });
    });

    // 4. DISCONNECT
    socket.on('disconnect', () => {
        const userData = onlineUsers[socket.id];
        if (userData) {
            io.to(userData.room).emit('user status', { user: userData.user, status: 'offline' });
            delete onlineUsers[socket.id];
        }
    });
});

server.listen(3000, () => { console.log('listening on *:3000'); });