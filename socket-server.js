// Socket.io server for real-time communication
// Note: This file is for deploying Socket.io separately (Railway, Render, etc.)
// Vercel serverless functions don't support persistent WebSocket connections
// Deploy this separately and update SOCKET_URL in frontend

const { Server } = require('socket.io');
const http = require('http');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

const server = http.createServer((req, res) => {
  // Health check endpoint for Render
  if (req.url === '/health' || req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', service: 'socket-server' }));
    return;
  }
  // For all other routes, return 404
  res.writeHead(404);
  res.end();
});

const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      // Allow all Vercel preview and production URLs
      if (!origin) {
        // Allow requests with no origin (like mobile apps or curl)
        return callback(null, true);
      }
      
      // Allow any vercel.app domain
      if (origin.includes('.vercel.app')) {
        return callback(null, true);
      }
      
      // Allow the configured FRONTEND_URL (exact match)
      if (process.env.FRONTEND_URL && origin === process.env.FRONTEND_URL) {
        return callback(null, true);
      }
      
      // Allow FRONTEND_URL domain variations (with/without www, with/without https)
      if (process.env.FRONTEND_URL) {
        try {
          const frontendUrl = new URL(process.env.FRONTEND_URL);
          const originUrl = new URL(origin);
          
          // Normalize domains by removing 'www.' prefix for comparison
          const normalizeDomain = (hostname) => hostname.replace(/^www\./, '');
          const frontendDomain = normalizeDomain(frontendUrl.hostname);
          const originDomain = normalizeDomain(originUrl.hostname);
          
          // Allow if domains match (ignoring www prefix)
          if (frontendDomain === originDomain) {
            return callback(null, true);
          }
        } catch (e) {
          // If URL parsing fails, continue to other checks
        }
      }
      
      // Allow localhost for development
      if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
        return callback(null, true);
      }
      
      callback(new Error('Not allowed by CORS'));
    },
    methods: ["GET", "POST"],
    credentials: true
  }
});

const emailToSocketIdMap = new Map();
const socketIdToEmailMap = new Map();
const roomScreenSharing = new Map();

io.on('connection', (socket) => {
  console.log(`Socket connected`, socket.id);

  // Helper to admit a user socket into a room and notify others
  const admitToRoom = async (targetSocket, { email, room, userId, userName, isHost, meeting }) => {
    if (!targetSocket) return;

    targetSocket.join(room);

    const roomSockets = await io.in(room).fetchSockets();
    const otherSockets = roomSockets.filter((s) => s.id !== targetSocket.id);

    for (const otherSocket of otherSockets) {
      const otherEmail = socketIdToEmailMap.get(otherSocket.id);
      if (otherEmail) {
        try {
          const otherUser = await prisma.user.findUnique({
            where: { email: otherEmail },
            select: { id: true, name: true },
          });

          if (otherUser && meeting) {
            const isOtherHost = meeting.hostId === otherUser.id;
            io.to(targetSocket.id).emit('user:already:in:room', {
              email: otherEmail,
              id: otherSocket.id,
              name: otherUser.name || otherEmail.split('@')[0],
              isHost: isOtherHost,
            });
          }
        } catch (error) {
          console.error('Error getting user info:', error);
        }
      }
    }

    io.to(room).emit('user:joined', { email, id: targetSocket.id, name: userName, isHost });
    io.to(targetSocket.id).emit('room:join', { email, room, userId, name: userName, isHost });
  };
  
  socket.on('room:join', async (data) => {
    const { email, room, userId, name } = data;
    emailToSocketIdMap.set(email, socket.id);
    socketIdToEmailMap.set(socket.id, email);
    
    let userName = name || email?.split('@')[0] || 'Guest';
    let isHost = false;
    let meeting;
    
    try {
      meeting = await prisma.meeting.findUnique({
        where: { roomId: room }
      });
      
      if (!meeting) {
        if (userId) {
          // Ensure the host user actually exists before creating a meeting,
          // otherwise Prisma will throw a foreign-key error (P2003).
          const hostUser = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true },
          });

          if (!hostUser) {
            console.error('Host user not found for meeting creation', { userId, room });
            io.to(socket.id).emit('room:join:denied', {
              message: 'Unable to start meeting. User not found in database.',
            });
            return;
          }

          meeting = await prisma.meeting.create({
            data: {
              roomId: room,
              hostId: userId,
            },
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
        if (user?.name) {
          userName = user.name;
        }
      }
    } catch (error) {
      console.error('Error handling room join:', error);
    }

    // For existing meetings and non-hosts, ask host to approve entry
    if (meeting && !isHost && userId) {
      try {
        const hostUser = await prisma.user.findUnique({
          where: { id: meeting.hostId },
          select: { email: true },
        });
        const hostSocketId = hostUser ? emailToSocketIdMap.get(hostUser.email) : null;

        if (hostSocketId && hostSocketId !== socket.id) {
          io.to(hostSocketId).emit('room:join:request', {
            socketId: socket.id,
            userId,
            name: userName,
          });
          io.to(socket.id).emit('room:join:waiting', {
            message: 'Waiting for host to admit you to the meeting...',
          });
          return;
        }
      } catch (error) {
        console.error('Error sending join request to host:', error);
      }
    }

    await admitToRoom(socket, { email, room, userId, userName, isHost, meeting });
  });

  // Host decides whether to admit a participant
  socket.on('room:join:decision', async ({ room, requesterSocketId, userId, allow, name }) => {
    try {
      const meeting = await prisma.meeting.findUnique({
        where: { roomId: room },
      });

      if (!meeting) return;

      // Ensure only host can decide
      const requesterEmail = socketIdToEmailMap.get(socket.id);
      if (!requesterEmail) return;

      const requesterUser = await prisma.user.findUnique({
        where: { email: requesterEmail },
      });

      if (!requesterUser || requesterUser.id !== meeting.hostId) {
        return;
      }

      const participant = await prisma.meetingParticipant.findUnique({
        where: {
          meetingId_userId: {
            meetingId: meeting.id,
            userId,
          },
        },
      });

      if (!allow) {
        if (participant) {
          await prisma.meetingParticipant.update({
            where: { id: participant.id },
            data: {
              kickCount: participant.kickCount + 1,
            },
          });
        }

        io.to(requesterSocketId).emit('room:join:denied', {
          message: 'Host declined your request to join this meeting.',
        });
        return;
      }

      if (participant && participant.kickCount >= 3) {
        io.to(requesterSocketId).emit('room:join:denied', {
          message: 'You have been removed from this meeting too many times. Access denied.',
        });
        return;
      }

      const email = socketIdToEmailMap.get(requesterSocketId);
      if (!email) return;

      const userRecord = await prisma.user.findUnique({
        where: { id: userId },
        select: { name: true },
      });

      const userName = userRecord?.name || name || email.split('@')[0] || 'Guest';

      const targetSocket = io.sockets.sockets.get(requesterSocketId);
      if (!targetSocket) return;

      await admitToRoom(targetSocket, {
        email,
        room,
        userId,
        userName,
        isHost: false,
        meeting,
      });
    } catch (error) {
      console.error('Error handling room join decision:', error);
    }
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

  // Simple in-meeting chat messages
  socket.on('chat:message', ({ room, name, text }) => {
    if (!room || !text) return;
    io.to(room).emit('chat:message', {
      name,
      text,
      createdAt: new Date().toISOString(),
    });
  });

  // Emoji reactions (lightweight, ephemeral)
  socket.on('reaction:emoji', ({ room, name, emoji }) => {
    if (!room || !emoji) return;
    io.to(room).emit('reaction:emoji', {
      name,
      emoji,
      createdAt: new Date().toISOString(),
    });
  });

  // Hand raise status per participant
  socket.on('hand:raise', ({ room, socketId, isRaised, name }) => {
    if (!room || !socketId) return;
    io.to(room).emit('hand:raise', {
      socketId,
      isRaised: !!isRaised,
      name,
    });
  });
});

const PORT = process.env.PORT || 3001;
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

