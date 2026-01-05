const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const mongoose = require('mongoose');

// --- DATABASE CONFIGURATION ---
// Your Password is set here:
const connectionString = "mongodb+srv://gdeveash:deveash1234@cluster0.5ypsc7q.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

mongoose.connect(connectionString)
  .then(() => console.log('✅ Connected to MongoDB!'))
  .catch((err) => console.error('❌ Database Error:', err));

// UPDATED SCHEMA: Now includes "room"
const msgSchema = new mongoose.Schema({
    user: String,
    room: String,     // <--- NEW: Remembers which group this belongs to
    type: String,     
    content: String,  
    timestamp: { type: Date, default: Date.now }
});
const Msg = mongoose.model('Msg', msgSchema);

const io = new Server(server, { maxHttpBufferSize: 1e8 });
app.use(express.static(__dirname));

app.get('/', (req, res) => { res.sendFile(__dirname + '/index.html'); });

io.on('connection', (socket) => {
    
    // 1. When user joins a specific ROOM
    socket.on('join room', (roomName) => {
        socket.join(roomName); // Socket.io magic to group users
        
        // Load history ONLY for this room
        Msg.find({ room: roomName }).sort({ timestamp: 1 }).then(messages => {
            messages.forEach(message => {
                const historyData = {
                    user: message.user,
                    type: message.type,
                    content: message.content
                };
                socket.emit('chat message', JSON.stringify(historyData));
            });
        });
    });

    // 2. When sending a message
    socket.on('chat message', (msgStr) => {
        const data = JSON.parse(msgStr);
        
        // Save with Room Name
        const newMsg = new Msg({
            user: data.user,
            room: data.room, // <--- Save the room
            type: data.type,
            content: data.content
        });
        
        newMsg.save().then(() => {
            // Send ONLY to people in that room
            io.to(data.room).emit('chat message', msgStr);
        });
    });
});

server.listen(3000, () => { console.log('listening on *:3000'); });