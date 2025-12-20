// Socket.io server for real-time communication
// Note: This file is for deploying Socket.io separately (Railway, Render, etc.)
// Vercel serverless functions don't support persistent WebSocket connections
// Deploy this separately and update SOCKET_URL in frontend

const { Server } = require('socket.io');
const http = require('http');
const prisma = require('./prisma/client');

const server = http.createServer();
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "*",
    methods: ["GET", "POST"],
    credentials: true
  }
});

const emailToSocketIdMap = new Map();
const socketIdToEmailMap = new Map();
const roomScreenSharing = new Map();

io.on('connection', (socket) => {
  console.log(`Socket connected`, socket.id);
  
  socket.on('room:join', async (data) => {
    const { email, room, userId } = data;
    emailToSocketIdMap.set(email, socket.id);
    socketIdToEmailMap.set(socket.id, email);
    
    let userName = email;
    let isHost = false;
    
    try {
      let meeting = await prisma.meeting.findUnique({
        where: { roomId: room }
      });
      
      if (!meeting) {
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
        isHost = meeting.hostId === userId;
      }
      
      if (userId && meeting) {
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
            leftAt: null
          },
          create: {
            meetingId: meeting.id,
            userId: userId,
            kickCount: 0
          }
        });
        
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
    
    const roomSockets = await io.in(room).fetchSockets();
    const otherSockets = roomSockets.filter(s => s.id !== socket.id);
    
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
    
    io.to(room).emit('user:joined', { email, id: socket.id, name: userName, isHost });
    io.to(socket.id).emit('room:join', { ...data, isHost });
  });

  socket.on('user:call', ({ to, offer }) => {
    io.to(to).emit('incomming:call', { from: socket.id, offer });
  });
  
  socket.on('call:accepted', ({ to, ans }) => {
    io.to(to).emit('call:accepted', { from: socket.id, ans });
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
      
      if (!meeting) return;
      
      const requesterEmail = socketIdToEmailMap.get(socket.id);
      if (!requesterEmail) return;
      
      const requester = await prisma.user.findUnique({
        where: { email: requesterEmail }
      });
      
      if (!requester || requester.id !== meeting.hostId) {
        io.to(socket.id).emit('kick:denied', { message: 'Only the host can remove users' });
        return;
      }
      
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
      
      io.to(socketId).emit('user:kicked', { message: 'You have been removed from the meeting' });
      io.to(room).emit('user:removed', { userId, socketId });
    } catch (error) {
      console.error('Error kicking user:', error);
    }
  });

  socket.on('screen:share:request', ({ room, userId }) => {
    const roomKey = room;
    const currentSharer = roomScreenSharing.get(roomKey);
    
    if (currentSharer && currentSharer !== socket.id) {
      io.to(socket.id).emit('screen:share:denied', { 
        message: 'Someone is already sharing their screen' 
      });
      return;
    }
    
    roomScreenSharing.set(roomKey, socket.id);
    io.to(room).emit('screen:share:started', { userId, socketId: socket.id });
  });

  socket.on('screen:share:stop', ({ room }) => {
    const roomKey = room;
    roomScreenSharing.delete(roomKey);
    io.to(room).emit('screen:share:stopped', { socketId: socket.id });
  });

  socket.on('disconnect', async () => {
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
      
      try {
        const user = await prisma.user.findUnique({
          where: { email }
        });
        
        if (user) {
          const participants = await prisma.meetingParticipant.findMany({
            where: {
              userId: user.id,
              leftAt: null
            },
            include: {
              meeting: true
            }
          });
          
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

const PORT = process.env.PORT || 8001;
server.listen(PORT, async () => {
  console.log(`Socket server running on port ${PORT}`);
  
  try {
    await prisma.$connect();
    console.log('Database connected successfully');
  } catch (error) {
    console.error('Database connection error:', error);
  }
});

process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});
