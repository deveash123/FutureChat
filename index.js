const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);

// 1. Show the Website when someone visits
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

io.on('connection', (socket) => {
  console.log('⚡ A user connected!');

  // 2. Listen for chat messages
socket.on('chat message', (msg) => {
  io.emit('chat message', msg); // <--- This sends it to EVERYONE
});
});

server.listen(3000, () => {
  console.log('Server is running on http://localhost:3000');
});