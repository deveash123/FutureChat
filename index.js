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

// --- SCHEMAS ---
// 1. Chat Messages
const msgSchema = new mongoose.Schema({
    user: String, room: String, type: String, content: String,
    fileName: String, replyTo: Object, avatar: String,
    timestamp: { type: Date, default: Date.now }
});
const Msg = mongoose.model('Msg', msgSchema);

// 2. Instagram Posts (NEW)
const postSchema = new mongoose.Schema({
    user: String,
    type: String,       // 'image' or 'video'
    content: String,    // The media data
    caption: String,
    avatar: String,
    likes: [String],    // List of users who liked it
    comments: [{ user: String, text: String, timestamp: Date }],
    timestamp: { type: Date, default: Date.now }
});
const Post = mongoose.model('Post', postSchema);

const io = new Server(server, { maxHttpBufferSize: 1e8 }); // 100MB Limit
app.use(express.static(__dirname));

app.get('/', (req, res) => { res.sendFile(__dirname + '/index.html'); });

let onlineUsers = {};

io.on('connection', (socket) => {
    
    // --- 1. CHAT SYSTEM ---
    socket.on('join room', ({ user, room }) => {
        socket.join(room);
        onlineUsers[socket.id] = { user, room };
        
        // Load Chat History
        Msg.find({ room: room }).sort({ timestamp: 1 }).limit(50).then(msgs => socket.emit('load chat', msgs));
        
        // Load Social Feed (Global)
        Post.find().sort({ timestamp: -1 }).limit(20).then(posts => socket.emit('load feed', posts));
    });

    socket.on('chat message', (data) => {
        const avatarUrl = `https://api.dicebear.com/7.x/initials/svg?seed=${data.user}&backgroundColor=000000`;
        const newMsg = new Msg({ ...data, avatar: avatarUrl });
        newMsg.save().then(saved => io.to(data.room).emit('chat message', saved));
    });

    // --- 2. INSTAGRAM FEATURES ---
    
    // Create Post
    socket.on('create post', (data) => {
        const avatarUrl = `https://api.dicebear.com/7.x/initials/svg?seed=${data.user}&backgroundColor=000000`;
        const newPost = new Post({
            user: data.user,
            type: data.type,
            content: data.content,
            caption: data.caption,
            avatar: avatarUrl,
            likes: [],
            comments: []
        });
        newPost.save().then(saved => io.emit('new post', saved));
    });

    // Like Post
    socket.on('like post', async ({ postId, user }) => {
        const post = await Post.findById(postId);
        if(post) {
            // Toggle Like
            if(post.likes.includes(user)) {
                post.likes = post.likes.filter(u => u !== user); // Unlike
            } else {
                post.likes.push(user); // Like
            }
            await post.save();
            io.emit('update post', post); // Update everyone
        }
    });

    // Comment Post
    socket.on('comment post', async ({ postId, user, text }) => {
        const post = await Post.findById(postId);
        if(post) {
            post.comments.push({ user, text, timestamp: new Date() });
            await post.save();
            io.emit('update post', post);
        }
    });

    socket.on('disconnect', () => { delete onlineUsers[socket.id]; });
});

server.listen(3000, () => { console.log('Server running on *:3000'); });