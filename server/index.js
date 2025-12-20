const {Server} = require('socket.io');
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const http = require('http');
const prisma = require('./prisma/client');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// JWT secret (in production, use environment variable)
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Authentication endpoints
app.post('/api/auth/signup', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        
        // Check if user already exists
        const existingUser = await prisma.user.findUnique({
            where: { email }
        });
        
        if (existingUser) {
            return res.status(400).json({ message: 'User already exists' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Create user in database
        const user = await prisma.user.create({
            data: {
                name,
                email,
                password: hashedPassword
            }
        });
        
        // Generate token
        const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET);
        
        res.json({
            token,
            user: { id: user.id, name: user.name, email: user.email }
        });
    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

app.post('/api/auth/signin', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        // Find user in database
        const user = await prisma.user.findUnique({
            where: { email }
        });
        
        if (!user) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        // Verify password
        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        // Generate token
        const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET);
        
        res.json({
            token,
            user: { id: user.id, name: user.name, email: user.email }
        });
    } catch (error) {
        console.error('Signin error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

const emailToSocketIdMap = new Map();
const socketIdToEmailMap = new Map();
const roomScreenSharing = new Map(); // Track who is sharing screen in each room

io.on('connection',(socket)=>{
    console.log(`Socket connected`,socket.id);
    
    socket.on('room:join', async (data) => {
        const {email, room, userId} = data;
        emailToSocketIdMap.set(email, socket.id);
        socketIdToEmailMap.set(socket.id, email);
        
        let userName = email;
        let isHost = false;
        
        try {
            // Find or create meeting
            let meeting = await prisma.meeting.findUnique({
                where: { roomId: room }
            });
            
            if (!meeting) {
                // Create meeting if it doesn't exist
                if (userId) {
                    meeting = await prisma.meeting.create({
                        data: {
                            roomId: room,
                            hostId: userId
                        }
                    });
                    isHost = true;
                }
            } else {
                // Check if user is host
                isHost = meeting.hostId === userId;
            }
            
            // Add participant if user is logged in
            if (userId && meeting) {
                // Check kick count - if kicked 3 times, deny access
                const participant = await prisma.meetingParticipant.findUnique({
                    where: {
                        meetingId_userId: {
                            meetingId: meeting.id,
                            userId: userId
                        }
                    }
                });
                
                if (participant && participant.kickCount >= 3) {
                    io.to(socket.id).emit('room:join:denied', { 
                        message: 'You have been removed from this meeting too many times. Access denied.' 
                    });
                    return;
                }
                
                await prisma.meetingParticipant.upsert({
                    where: {
                        meetingId_userId: {
                            meetingId: meeting.id,
                            userId: userId
                        }
                    },
                    update: {
                        leftAt: null // Reset if rejoining
                    },
                    create: {
                        meetingId: meeting.id,
                        userId: userId,
                        kickCount: 0
                    }
                });
                
                // Get user name from database
                const user = await prisma.user.findUnique({
                    where: { id: userId },
                    select: { name: true }
                });
                if (user) {
                    userName = user.name;
                }
            }
        } catch (error) {
            console.error('Error handling room join:', error);
        }
        
        socket.join(room);
        
        // Get all sockets in the room (except the one joining)
        const roomSockets = await io.in(room).fetchSockets();
        const otherSockets = roomSockets.filter(s => s.id !== socket.id);
        
        // Notify the joining user about existing users in the room
        for (const otherSocket of otherSockets) {
            const otherEmail = socketIdToEmailMap.get(otherSocket.id);
            if (otherEmail) {
                try {
                    const otherUserId = await prisma.user.findUnique({
                        where: { email: otherEmail },
                        select: { id: true, name: true }
                    });
                    
                    if (otherUserId && meeting) {
                        const isOtherHost = meeting.hostId === otherUserId.id;
                        io.to(socket.id).emit('user:already:in:room', {
                            email: otherEmail,
                            id: otherSocket.id,
                            name: otherUserId.name || otherEmail,
                            isHost: isOtherHost
                        });
                    }
                } catch (error) {
                    console.error('Error getting user info:', error);
                }
            }
        }
        
        // Notify everyone in the room about the new user
        io.to(room).emit('user:joined', {email, id: socket.id, name: userName, isHost});
        
        // Notify the joining user
        io.to(socket.id).emit('room:join', { ...data, isHost });
    });

    socket.on('user:call',({to,offer})=>{
        io.to(to).emit('incomming:call',{from: socket.id, offer});
    });
    
    socket.on('call:accepted',({to,ans})=>{
        io.to(to).emit('call:accepted',{from: socket.id, ans});
    });

    socket.on('ice:candidate', ({ to, candidate }) => {
        io.to(to).emit('ice:candidate', { candidate, from: socket.id });
    });

    socket.on('audio:status', ({ to, muted }) => {
        io.to(to).emit('audio:status', { muted });
    });

    socket.on('video:status', ({ to, videoOff }) => {
        io.to(to).emit('video:status', { videoOff });
    });

    socket.on('user:kick', async ({ room, userId, socketId }) => {
        try {
            const meeting = await prisma.meeting.findUnique({
                where: { roomId: room }
            });
            
            if (!meeting) {
                return;
            }
            
            // Check if requester is host
            const requesterEmail = socketIdToEmailMap.get(socket.id);
            if (!requesterEmail) return;
            
            const requester = await prisma.user.findUnique({
                where: { email: requesterEmail }
            });
            
            if (!requester || requester.id !== meeting.hostId) {
                io.to(socket.id).emit('kick:denied', { message: 'Only the host can remove users' });
                return;
            }
            
            // Increment kick count
            const participant = await prisma.meetingParticipant.findUnique({
                where: {
                    meetingId_userId: {
                        meetingId: meeting.id,
                        userId: userId
                    }
                }
            });
            
            if (participant) {
                await prisma.meetingParticipant.update({
                    where: { id: participant.id },
                    data: { 
                        kickCount: participant.kickCount + 1,
                        leftAt: new Date()
                    }
                });
            }
            
            // Notify the kicked user
            io.to(socketId).emit('user:kicked', { message: 'You have been removed from the meeting' });
            
            // Notify others in the room
            io.to(room).emit('user:removed', { userId, socketId });
        } catch (error) {
            console.error('Error kicking user:', error);
        }
    });

    socket.on('screen:share:request', ({ room, userId }) => {
        const roomKey = room;
        const currentSharer = roomScreenSharing.get(roomKey);
        
        // If someone is already sharing, deny the request
        if (currentSharer && currentSharer !== socket.id) {
            io.to(socket.id).emit('screen:share:denied', { 
                message: 'Someone is already sharing their screen' 
            });
            return;
        }
        
        // Allow screen share
        roomScreenSharing.set(roomKey, socket.id);
        io.to(room).emit('screen:share:started', { userId, socketId: socket.id });
    });

    socket.on('screen:share:stop', ({ room }) => {
        const roomKey = room;
        roomScreenSharing.delete(roomKey);
        io.to(room).emit('screen:share:stopped', { socketId: socket.id });
    });

    socket.on('disconnect', async () => {
        // Clean up screen sharing if this user was sharing
        for (const [room, sharerId] of roomScreenSharing.entries()) {
            if (sharerId === socket.id) {
                roomScreenSharing.delete(room);
                io.to(room).emit('screen:share:stopped', { socketId: socket.id });
            }
        }
        
        const email = socketIdToEmailMap.get(socket.id);
        if (email) {
            emailToSocketIdMap.delete(email);
            socketIdToEmailMap.delete(socket.id);
            
            // Update participant leftAt timestamp
            try {
                const user = await prisma.user.findUnique({
                    where: { email }
                });
                
                if (user) {
                    // Find active meeting participants for this user
                    const participants = await prisma.meetingParticipant.findMany({
                        where: {
                            userId: user.id,
                            leftAt: null
                        },
                        include: {
                            meeting: true
                        }
                    });
                    
                    // Mark as left
                    for (const participant of participants) {
                        await prisma.meetingParticipant.update({
                            where: { id: participant.id },
                            data: { leftAt: new Date() }
                        });
                    }
                }
            } catch (error) {
                console.error('Error updating participant on disconnect:', error);
            }
        }
    });
});

// Meeting endpoints
app.post('/api/meetings', async (req, res) => {
    try {
        const { userId, roomId } = req.body;
        
        if (!userId || !roomId) {
            return res.status(400).json({ message: 'userId and roomId are required' });
        }
        
        const meeting = await prisma.meeting.upsert({
            where: { roomId },
            update: {},
            create: {
                roomId,
                hostId: userId
            },
            include: {
                host: {
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                }
            }
        });
        
        res.json({ meeting });
    } catch (error) {
        console.error('Error creating meeting:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

app.get('/api/meetings/:roomId', async (req, res) => {
    try {
        const { roomId } = req.params;
        
        const meeting = await prisma.meeting.findUnique({
            where: { roomId },
            include: {
                host: {
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                },
                participants: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                name: true,
                                email: true
                            }
                        }
                    }
                }
            }
        });
        
        if (!meeting) {
            return res.status(404).json({ message: 'Meeting not found' });
        }
        
        res.json({ meeting });
    } catch (error) {
        console.error('Error fetching meeting:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Start server
const PORT = 8000;
server.listen(PORT, async () => {
    console.log(`Server running on port ${PORT}`);
    
    // Test database connection
    try {
        await prisma.$connect();
        console.log('Database connected successfully');
    } catch (error) {
        console.error('Database connection error:', error);
    }
});

// Graceful shutdown
process.on('SIGINT', async () => {
    await prisma.$disconnect();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    await prisma.$disconnect();
    process.exit(0);
});