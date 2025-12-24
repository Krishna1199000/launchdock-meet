# Quick .env.local Setup Guide

## ✅ Since Next.js = Frontend + Backend Together

Your **`.env.local`** file only needs **3 variables**:

```env
DATABASE_URL="postgresql://postgres:yourpassword@localhost:5432/videochat?schema=public"
JWT_SECRET="your-secret-key-here"
NEXT_PUBLIC_SOCKET_URL="http://localhost:3001"
```

## What Each Variable Does

| Variable | Used By | Purpose |
|----------|---------|---------|
| `DATABASE_URL` | `app/api/*/route.ts` (API routes) | Database connection for authentication, meetings |
| `JWT_SECRET` | `app/api/auth/*/route.ts` | Signing JWT tokens for user authentication |
| `NEXT_PUBLIC_SOCKET_URL` | `app/*/page.tsx` (Frontend pages) | Socket.io server URL for WebRTC signaling |

## Complete Example for Local Development

```env
DATABASE_URL="postgresql://postgres:mypassword@localhost:5432/videochat?schema=public"
JWT_SECRET="a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6"
NEXT_PUBLIC_SOCKET_URL="http://localhost:3001"
```

## Generate JWT_SECRET

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## That's It! 🎉

- **Frontend pages** (`app/signin/page.tsx`, etc.) use `NEXT_PUBLIC_SOCKET_URL`
- **API routes** (`app/api/auth/signin/route.ts`, etc.) use `DATABASE_URL` and `JWT_SECRET`
- Everything is in one Next.js app!

