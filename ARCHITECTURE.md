# Architecture Overview

## Next.js Unified Structure

You're correct! In Next.js, the **frontend and backend are in one application**.

### Frontend (app/ directory)
- `app/page.tsx` - Landing page
- `app/signin/page.tsx` - Sign in page  
- `app/signup/page.tsx` - Sign up page
- `app/dashboard/page.tsx` - Dashboard
- `app/meeting/[roomId]/page.tsx` - Meeting room

### Backend (app/api/ directory) - Same Next.js App!
- `app/api/auth/signin/route.ts` - Sign in API endpoint
- `app/api/auth/signup/route.ts` - Sign up API endpoint
- `app/api/meetings/route.ts` - Create meeting API
- `app/api/meetings/[roomId]/route.ts` - Get meeting API

**These API routes run on the same Next.js server!**

## Socket.io Server (Separate)

However, **Socket.io still needs to run separately** because:
- Next.js API routes are **serverless functions** (stateless, short-lived)
- Socket.io requires **persistent WebSocket connections** (stateful, long-lived)
- Serverless functions can't maintain persistent connections

So `socket-server.js` runs as a **separate Node.js process**.

## How They Work Together

```
┌─────────────────────────────────────┐
│   Next.js App (Vercel/Server)      │
│                                     │
│   Frontend (app/*/page.tsx)        │
│   ↓ HTTP requests                   │
│   Backend (app/api/*/route.ts)     │
│   ↓ Database queries                │
│   Prisma → PostgreSQL               │
└─────────────────────────────────────┘
           ↕ WebSocket
┌─────────────────────────────────────┐
│   Socket.io Server (Railway/Render) │
│   - WebRTC signaling                │
│   - Real-time events                │
│   ↓ Database queries                │
│   Prisma → PostgreSQL (same DB)     │
└─────────────────────────────────────┘
```

## Environment Variables Explained

### For Next.js App (.env.local):
```env
DATABASE_URL="..."           # Same database for API routes
JWT_SECRET="..."             # For API route authentication
NEXT_PUBLIC_SOCKET_URL="..." # Socket.io server URL (exposed to browser)
```

### For Socket.io Server (separate .env):
```env
DATABASE_URL="..."      # Same database
FRONTEND_URL="..."      # Next.js app URL (for CORS)
```

## Benefits of This Structure

✅ **Unified codebase** - Frontend and API routes together
✅ **Same TypeScript** - Shared types and utilities
✅ **Same database** - Direct Prisma access in API routes
✅ **Easy development** - One `npm run dev` for Next.js
✅ **Real-time support** - Socket.io handles WebRTC signaling separately

## Development

```bash
# Terminal 1: Next.js (frontend + API routes)
npm run dev              # Runs on http://localhost:3000

# Terminal 2: Socket.io server
npm run socket:dev       # Runs on http://localhost:3001
```

The Next.js app handles all REST API calls, and Socket.io handles WebSocket connections for real-time video chat signaling.

