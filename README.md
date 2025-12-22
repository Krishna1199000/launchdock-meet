# VideoMeet - Next.js Video Chat Application

A full-stack video chat application built with **Next.js 14 App Router**, TypeScript, Socket.io, and WebRTC.

## 🚀 Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Real-time**: Socket.io
- **Video/Audio**: WebRTC (Peer-to-Peer)
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: JWT
- **Styling**: CSS Modules + Tailwind CSS

## 📁 Project Structure

```
├── app/                    # Next.js App Router
│   ├── api/               # API Routes (Route Handlers)
│   │   ├── auth/
│   │   │   ├── signin/
│   │   │   │   └── route.ts
│   │   │   └── signup/
│   │   │       └── route.ts
│   │   └── meetings/
│   │       ├── [roomId]/
│   │       │   └── route.ts
│   │       └── route.ts
│   ├── dashboard/
│   │   └── page.tsx
│   ├── meeting/
│   │   └── [roomId]/
│   │       └── page.tsx
│   ├── signin/
│   │   └── page.tsx
│   ├── signup/
│   │   └── page.tsx
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── lib/
│   ├── prisma.ts          # Prisma client
│   ├── services/
│   │   └── peer.ts        # WebRTC peer service
│   └── context/
│       └── SocketContext.tsx  # Socket.io context
├── prisma/
│   ├── schema.prisma      # Database schema
│   └── migrations/        # Database migrations
├── public/                # Static assets
├── socket-server.js       # Socket.io server (separate process)
├── next.config.js
├── tsconfig.json
└── package.json
```

## 🏃 Getting Started

### Prerequisites

- Node.js 18+ 
- PostgreSQL database
- npm or yarn

### Installation

1. **Clone the repository and install dependencies:**
```bash
npm install
```

2. **Set up environment variables:**
```bash
cp .env.example .env.local
```

Edit `.env.local` with your values:
```env
DATABASE_URL="postgresql://user:password@localhost:5432/videochat"
JWT_SECRET="your-strong-random-secret-key-here"
NEXT_PUBLIC_SOCKET_URL="http://localhost:3001"
FRONTEND_URL="http://localhost:3000"
```

3. **Set up the database:**
```bash
# Generate Prisma Client
npx prisma generate

# Run migrations
npx prisma migrate dev
```

4. **Run the development servers:**
```bash
# Terminal 1 - Next.js app (runs on port 3000)
npm run dev

# Terminal 2 - Socket.io server (runs on port 3001)
npm run socket:dev
```

5. **Open your browser:**
Navigate to [http://localhost:3000](http://localhost:3000)

## 📚 API Routes

All API routes are in `app/api/` using Next.js Route Handlers:

- `POST /api/auth/signup` - User registration
- `POST /api/auth/signin` - User login
- `POST /api/meetings` - Create a meeting
- `GET /api/meetings/[roomId]` - Get meeting details

## 🎯 Pages

- `/` - Landing page
- `/signin` - Sign in page
- `/signup` - Sign up page
- `/dashboard` - User dashboard
- `/meeting/[roomId]` - Meeting room (video chat)

## 🛠️ Available Scripts

- `npm run dev` - Start Next.js development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run prisma:generate` - Generate Prisma Client
- `npm run prisma:migrate` - Run database migrations
- `npm run prisma:studio` - Open Prisma Studio
- `npm run socket:dev` - Run Socket.io server (development)
- `npm run socket:prod` - Run Socket.io server (production)

## 📦 Deployment

### Next.js App (Vercel)

1. Deploy to Vercel
2. Set environment variables:
   - `DATABASE_URL`
   - `JWT_SECRET`
   - `NEXT_PUBLIC_SOCKET_URL` (your Socket.io server URL)

### Socket.io Server (Render/Railway)

Deploy `socket-server.js` separately to Render or Railway (Vercel doesn't support persistent WebSocket connections).

**Note**: Both services need to connect to the same database.

## 🔧 Development Notes

- All components use TypeScript
- Client components are marked with `'use client'`
- API routes use Next.js Route Handlers (app/api)
- CSS Modules for styling (`.module.css` files)
- Socket.io runs as a separate process (not integrated into Next.js)

## 📝 TODO

- [ ] Complete Meeting Room page logic (copy from original Room.jsx)
- [ ] Copy and convert CSS files to CSS Modules
- [ ] Add TypeScript types for Socket.io events
- [ ] Add error boundaries
- [ ] Add loading states
- [ ] Add proper error handling

## 📄 License

ISC