# Quick Start - Vercel Deployment

## Backend Deployment (Vercel)

1. **Navigate to server directory:**
   ```bash
   cd server
   ```

2. **Install Vercel CLI (if not installed):**
   ```bash
   npm install -g vercel
   ```

3. **Login to Vercel:**
   ```bash
   vercel login
   ```

4. **Deploy:**
   ```bash
   vercel
   ```
   - Follow the prompts
   - Set environment variables when prompted or add them later in Vercel dashboard

5. **Set Environment Variables in Vercel Dashboard:**
   - Go to your project settings → Environment Variables
   - Add:
     - `DATABASE_URL` - Your PostgreSQL connection string
     - `JWT_SECRET` - A strong random secret key
     - `FRONTEND_URL` - Your frontend URL (will set after frontend deployment)

6. **After deployment, note your backend URL** (e.g., `https://your-backend.vercel.app`)

## Socket.io Server Deployment (Railway/Render)

Since Vercel doesn't support persistent WebSocket connections, deploy Socket.io separately:

### Railway Option:
1. Go to [Railway](https://railway.app)
2. New Project → Deploy from GitHub repo
3. Select `server` directory
4. Set start command: `node socket-server.js`
5. Add environment variables:
   - `DATABASE_URL`
   - `FRONTEND_URL`
   - `PORT=8001` (optional)
6. Deploy and note the URL

## Frontend Deployment (Vercel)

1. **Navigate to client directory:**
   ```bash
   cd client
   ```

2. **Deploy:**
   ```bash
   vercel
   ```

3. **Set Environment Variables in Vercel Dashboard:**
   - `REACT_APP_API_URL` - Your backend URL from step 1
   - `REACT_APP_SOCKET_URL` - Your Socket.io server URL from step 2

4. **After deployment, note your frontend URL**

## Update Environment Variables

After all deployments, update:
- Backend: Update `FRONTEND_URL` with your frontend URL
- Socket.io Server: Update `FRONTEND_URL` with your frontend URL

## Database Setup

Before using the app, run Prisma migrations:
```bash
cd server
npx prisma migrate deploy
```

Or add this to your deployment process.

## Verify Deployment

1. Test backend: `https://your-backend.vercel.app/api/auth/signup` (should return 400, not 404)
2. Test frontend: Visit your frontend URL
3. Test Socket.io: Check server logs for connections

See `DEPLOYMENT.md` for detailed instructions.
