const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const mongoose = require('mongoose');

// --- DATABASE CONFIGURATION ---
// I have inserted your password 'deveash1234' correctly below:
const connectionString = "mongodb+srv://gdeveash:deveash1234@cluster0.5ypsc7q.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

// 2. Connect to the Cloud Database
mongoose.connect(connectionString)
  .then(() => console.log('✅ Connected to MongoDB Database!'))
  .catch((err) => console.error('❌ Database Connection Error:', err));

// 3. Define the "Shape" of a Message
const msgSchema = new mongoose.Schema({
    user: String,
    type: String,     // 'text', 'image', or 'audio'
    content: String,  // The actual text or photo data
    timestamp: { type: Date, default: Date.now }
});
const Msg = mongoose.model('Msg', msgSchema);

// --- SERVER SETUP ---
const io = new Server(server, { maxHttpBufferSize: 1e8 }); // 100MB limit
app.use(express.static(__dirname));

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

// --- CHAT LOGIC ---
io.on('connection', (socket) => {
    
    // A. When someone joins, send them the PAST HISTORY
    Msg.find().sort({ timestamp: 1 }).then(messages => {
        messages.forEach(message => {
            // We convert it to the format the frontend expects
            const historyData = {
                user: message.user,
                type: message.type,
                content: message.content
            };
            // Send only to this new person
            socket.emit('chat message', JSON.stringify(historyData));
        });
    });

    // B. When someone sends a new message
    socket.on('chat message', (msgStr) => {
        // 1. Parse the data
        const data = JSON.parse(msgStr);
        
        // 2. Save to Database (Permanent Memory)
        const newMsg = new Msg({
            user: data.user,
            type: data.type,
            content: data.content
        });
        
        newMsg.save().then(() => {
            // 3. If save successful, send to everyone
            io.emit('chat message', msgStr);
        });
    });
});

server.listen(3000, () => {
  console.log('listening on *:3000');
});