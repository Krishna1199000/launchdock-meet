# Deployment Guide for VideoMeet

This guide will help you deploy the VideoMeet application to Vercel.

## Architecture Overview

The application consists of:
1. **Backend REST API** - Deployed on Vercel as serverless functions
2. **Socket.io Server** - Needs to be deployed separately (Railway, Render, or similar) due to persistent WebSocket connections
3. **Frontend** - Deployed on Vercel

## Prerequisites

1. Vercel account (free tier works)
2. PostgreSQL database (recommended: Neon, Supabase, or Railway)
3. Account on Railway/Render for Socket.io server (optional, can use other services)

## Step 1: Set Up Database

1. Create a PostgreSQL database (recommended: [Neon](https://neon.tech) or [Supabase](https://supabase.com))
2. Get your database connection string (DATABASE_URL)
3. Run Prisma migrations to set up the schema

## Step 2: Deploy Backend (REST API) to Vercel

### Option A: Deploy via Vercel CLI

```bash
cd server
npm install -g vercel
vercel login
vercel
```

### Option B: Deploy via Vercel Dashboard

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "Add New Project"
3. Import your Git repository
4. Set the root directory to `server`
5. Configure the following:

**Build Settings:**
- Framework Preset: Other
- Build Command: `npm run vercel-build`
- Output Directory: (leave empty)
- Install Command: `npm install`

**Environment Variables:**
Add the following environment variables in Vercel dashboard:

```
DATABASE_URL=your_postgresql_connection_string
JWT_SECRET=your_strong_random_secret_key_here
NODE_ENV=production
FRONTEND_URL=https://your-frontend-domain.vercel.app
```

**Important:** After deployment, note your backend URL (e.g., `https://your-backend.vercel.app`)

## Step 3: Deploy Socket.io Server

Socket.io requires persistent WebSocket connections, which don't work well with Vercel serverless functions. Deploy the Socket.io server separately.

### Option A: Deploy to Railway

1. Go to [Railway](https://railway.app)
2. Create a new project
3. Connect your Git repository
4. Select the `server` directory
5. Set the start command to: `node socket-server.js`
6. Add environment variables:
   ```
   DATABASE_URL=your_postgresql_connection_string
   PORT=8001
   FRONTEND_URL=https://your-frontend-domain.vercel.app
   NODE_ENV=production
   ```
7. Deploy and note the URL (e.g., `https://your-socket-server.railway.app`)

### Option B: Deploy to Render

1. Go to [Render](https://render.com)
2. Create a new Web Service
3. Connect your repository
4. Set:
   - Build Command: `cd server && npm install && npx prisma generate`
   - Start Command: `cd server && node socket-server.js`
   - Environment: Node
5. Add environment variables (same as Railway)
6. Deploy and note the URL

### Option C: Keep using localhost (development only)

For development, you can run Socket.io server locally:
```bash
cd server
node socket-server.js
```

## Step 4: Deploy Frontend to Vercel

### Option A: Deploy via Vercel CLI

```bash
cd client
vercel
```

### Option B: Deploy via Vercel Dashboard

1. Go to Vercel Dashboard
2. Click "Add New Project"
3. Import your Git repository (again, as a separate project)
4. Set the root directory to `client`
5. Configure:

**Build Settings:**
- Framework Preset: Create React App
- Build Command: `npm run build`
- Output Directory: `build`
- Install Command: `npm install`

**Environment Variables:**
```
REACT_APP_API_URL=https://your-backend.vercel.app
REACT_APP_SOCKET_URL=https://your-socket-server.railway.app
```

6. Deploy

## Step 5: Update CORS Settings

After deploying, update your Socket.io server's CORS settings to include your frontend URL:

In `server/socket-server.js`, ensure:
```javascript
cors: {
  origin: process.env.FRONTEND_URL || "*",
  methods: ["GET", "POST"],
  credentials: true
}
```

## Step 6: Run Database Migrations

Before using the application, run Prisma migrations on your production database:

```bash
cd server
npx prisma migrate deploy
```

Or if using Railway/Render, add this to your build/deploy process.

## Verification

1. **Backend API**: Test `https://your-backend.vercel.app/api/auth/signup` (should return 400 for missing data, not 404)
2. **Frontend**: Visit your frontend URL and try to sign up
3. **Socket.io**: Check that Socket.io server is running and accepting connections

## Troubleshooting

### Database Connection Issues
- Ensure DATABASE_URL is correctly set
- Check that your database allows connections from Vercel/Railway IPs
- Run `npx prisma migrate deploy` to set up the database schema

### Socket.io Connection Issues
- Verify REACT_APP_SOCKET_URL is set correctly in frontend
- Check Socket.io server logs
- Ensure CORS settings allow your frontend domain

### Build Failures
- Ensure all dependencies are in package.json
- Check that Prisma client is generated (`prisma generate`)
- Verify Node.js version compatibility

## Local Development

For local development, create `.env` files:

**server/.env:**
```
DATABASE_URL=postgresql://user:password@localhost:5432/videochat
JWT_SECRET=your-secret-key
PORT=8000
FRONTEND_URL=http://localhost:3000
```

**client/.env:**
```
REACT_APP_API_URL=http://localhost:8000
REACT_APP_SOCKET_URL=http://localhost:8000
```

Then run:
```bash
# Terminal 1 - Backend
cd server
npm install
npx prisma generate
npx prisma migrate dev
npm start

# Terminal 2 - Socket Server (or same terminal if using original index.js)
cd server
node socket-server.js

# Terminal 3 - Frontend
cd client
npm install
npm start
```

## Production Checklist

- [ ] Database is set up and migrations are run
- [ ] Backend API is deployed and accessible
- [ ] Socket.io server is deployed and accessible
- [ ] Frontend is deployed with correct environment variables
- [ ] CORS is configured correctly
- [ ] JWT_SECRET is a strong random string
- [ ] Database connection string is secure
- [ ] Environment variables are set in all services

## Notes

- Socket.io server needs to be deployed separately because Vercel serverless functions don't support persistent WebSocket connections
- All three services (Backend API, Socket.io, Frontend) need to connect to the same database
- Make sure to use HTTPS URLs in production for all services
