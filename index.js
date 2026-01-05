const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const mongoose = require('mongoose');

// --- DATABASE CONNECTION ---
// Your Password 'deveash1234' is included
const connectionString = "mongodb+srv://gdeveash:deveash1234@cluster0.5ypsc7q.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

mongoose.connect(connectionString)
  .then(() => console.log('✅ AURA OS Connected'))
  .catch((err) => console.error('❌ Database Error:', err));

// --- SCHEMAS ---
const msgSchema = new mongoose.Schema({
    user: String, room: String, type: String, content: String,
    fileName: String, replyTo: Object, avatar: String,
    timestamp: { type: Date, default: Date.now }
});
const Msg = mongoose.model('Msg', msgSchema);

const postSchema = new mongoose.Schema({
    user: String, type: String, content: String, caption: String,
    avatar: String, likes: [String], comments: Array,
    timestamp: { type: Date, default: Date.now }
});
const Post = mongoose.model('Post', postSchema);

// NEW: Stories (Auto-delete in future logic, simplified here)
const storySchema = new mongoose.Schema({
    user: String, content: String, avatar: String, type: String,
    timestamp: { type: Date, default: Date.now, expires: 86400 } // TTL Index: Deletes after 24 hours
});
const Story = mongoose.model('Story', storySchema);

const io = new Server(server, { maxHttpBufferSize: 1e8 });
app.use(express.static(__dirname));

app.get('/', (req, res) => { res.sendFile(__dirname + '/index.html'); });

io.on('connection', (socket) => {
    
    socket.on('join system', ({ user, room }) => {
        socket.join(room);
        
        // Load All Data concurrently for speed
        Promise.all([
            Msg.find({ room: room }).sort({ timestamp: 1 }).limit(50),
            Post.find().sort({ timestamp: -1 }).limit(20),
            Story.find().sort({ timestamp: -1 }).limit(10)
        ]).then(([msgs, posts, stories]) => {
            socket.emit('init data', { msgs, posts, stories });
        });
    });

    // CHAT
    socket.on('chat message', (data) => {
        const avatar = `https://api.dicebear.com/7.x/shapes/svg?seed=${data.user}&backgroundColor=0a0a0a`;
        const newMsg = new Msg({ ...data, avatar });
        newMsg.save().then(saved => io.to(data.room).emit('chat message', saved));
    });

    // POSTS
    socket.on('create post', (data) => {
        const avatar = `https://api.dicebear.com/7.x/shapes/svg?seed=${data.user}&backgroundColor=0a0a0a`;
        const newPost = new Post({ ...data, avatar, likes: [], comments: [] });
        newPost.save().then(saved => io.emit('new post', saved));
    });

    // STORIES
    socket.on('create story', (data) => {
        const avatar = `https://api.dicebear.com/7.x/shapes/svg?seed=${data.user}&backgroundColor=0a0a0a`;
        const newStory = new Story({ ...data, avatar });
        newStory.save().then(saved => io.emit('new story', saved));
    });

    // INTERACTIONS
    socket.on('like post', async ({ id, user }) => {
        const post = await Post.findById(id);
        if(post) {
            post.likes.includes(user) ? post.likes.pull(user) : post.likes.push(user);
            await post.save();
            io.emit('update post', post);
        }
    });
});

server.listen(3000, () => { console.log('AURA OS Online'); });