const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");

// UPDATE: We increase the limit to 10MB so photos can pass through
const io = new Server(server, {
    maxHttpBufferSize: 1e8 // 100 MB limit
});

app.use(express.static(__dirname));

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

io.on('connection', (socket) => {
  // We don't need to log every connection, keeps the terminal clean
  
  socket.on('chat message', (msg) => {
    // Broadcast the message (text or image) to everyone
    io.emit('chat message', msg);
  });
});

server.listen(3000, () => {
  console.log('listening on *:3000');
});