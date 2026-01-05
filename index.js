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

// --- SCHEMA ---
const msgSchema = new mongoose.Schema({
    user: String,
    room: String,
    type: String,      // 'text', 'image', 'file', 'audio'
    content: String,   
    fileName: String,
    replyTo: Object,   // NEW: Stores the message you are replying to
    avatar: String,
    timestamp: { type: Date, default: Date.now }
});
const Msg = mongoose.model('Msg', msgSchema);

const io = new Server(server, { maxHttpBufferSize: 1e8 });
app.use(express.static(__dirname));

app.get('/', (req, res) => { res.sendFile(__dirname + '/index.html'); });

let onlineUsers = {};

io.on('connection', (socket) => {
    
    // JOIN ROOM
    socket.on('join room', ({ user, room }) => {
        socket.join(room);
        onlineUsers[socket.id] = { user, room };
        io.to(room).emit('room users', getRoomUsers(room));
        
        // Load History
        Msg.find({ room: room }).sort({ timestamp: 1 }).limit(50).then(messages => {
            socket.emit('load history', messages);
        });
    });

    // HANDLE MESSAGES
    socket.on('chat message', (data) => {
        const avatarUrl = `https://api.dicebear.com/7.x/initials/svg?seed=${data.user}&backgroundColor=000000`;
        
        const newMsg = new Msg({
            user: data.user,
            room: data.room,
            type: data.type,
            content: data.content,
            fileName: data.fileName || "",
            replyTo: data.replyTo || null, // Handle Reply
            avatar: avatarUrl
        });
        
        newMsg.save().then((savedMsg) => {
            io.to(data.room).emit('chat message', savedMsg);
        });
    });

    // DELETE MESSAGE
    socket.on('delete message', (msgId) => {
        Msg.findByIdAndDelete(msgId).then(() => {
            io.to(onlineUsers[socket.id]?.room).emit('message deleted', msgId);
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

function getRoomUsers(room) {
    return Object.values(onlineUsers).filter(u => u.room === room).map(u => u.user);
}

server.listen(3000, () => { console.log('Server running on *:3000'); });