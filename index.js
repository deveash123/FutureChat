const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const mongoose = require('mongoose');

const connectionString = "mongodb+srv://gdeveash:deveash1234@cluster0.5ypsc7q.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

mongoose.connect(connectionString)
  .then(() => console.log('✅ NEXUS OS Online'))
  .catch((err) => console.error('❌ DB Error:', err));

const userSchema = new mongoose.Schema({
    username: String, avatar: String, bio: String,
    followers: { type: Number, default: 0 },
    views: { type: Number, default: 0 }
});
const User = mongoose.model('User', userSchema);

const msgSchema = new mongoose.Schema({
    user: String, room: String, type: String, content: String,
    avatar: String, timestamp: { type: Date, default: Date.now }
});
const Msg = mongoose.model('Msg', msgSchema);

const postSchema = new mongoose.Schema({
    user: String, type: String, content: String, caption: String,
    avatar: String, likes: [String],
    comments: [{ user: String, text: String, timestamp: Date }],
    timestamp: { type: Date, default: Date.now }
});
const Post = mongoose.model('Post', postSchema);

const io = new Server(server, { maxHttpBufferSize: 1e8 });
app.use(express.static(__dirname));

app.get('/', (req, res) => { res.sendFile(__dirname + '/index.html'); });

io.on('connection', (socket) => {
    
    // LOGIN
    socket.on('login', async (username) => {
        let user = await User.findOne({ username });
        if (!user) {
            user = new User({ 
                username, 
                avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${username}`,
                bio: "Digital Nomad"
            });
            await user.save();
        }
        socket.emit('user data', user);
        
        // Load Feed & Users
        const posts = await Post.find().sort({ timestamp: -1 }).limit(20);
        socket.emit('load feed', posts);
        const users = await User.find().limit(10);
        socket.emit('load users', users);
    });

    // UPDATE PROFILE
    socket.on('update profile', async (data) => {
        await User.findOneAndUpdate({ username: data.username }, { bio: data.bio });
        socket.emit('profile updated', data.bio);
    });

    // CHAT
    socket.on('join chat', async (room) => {
        socket.join(room);
        const msgs = await Msg.find({ room }).sort({ timestamp: 1 }).limit(50);
        socket.emit('load chat', msgs);
    });

    socket.on('chat message', (data) => {
        const newMsg = new Msg(data);
        newMsg.save().then(saved => io.to(data.room).emit('chat message', saved));
    });

    // POSTS
    socket.on('create post', (data) => {
        const newPost = new Post({ ...data, likes: [], comments: [] });
        newPost.save().then(saved => io.emit('new post', saved));
    });
});

server.listen(3000, () => { console.log('Server running on *:3000'); });