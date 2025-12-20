# VideoMeet Backend Server

Backend API server for VideoMeet video chat application.

## Structure

- `api/` - Vercel serverless functions for REST API endpoints
- `socket-server.js` - Standalone Socket.io server (deploy separately)
- `index.js` - Original Express server (for local development)
- `prisma/` - Database schema and migrations

## API Endpoints

### Authentication
- `POST /api/auth/signup` - User registration
- `POST /api/auth/signin` - User login

### Meetings
- `POST /api/meetings` - Create a new meeting
- `GET /api/meetings/:roomId` - Get meeting details

## Environment Variables

Required environment variables:

```env
DATABASE_URL=postgresql://user:password@host:5432/database
JWT_SECRET=your-secret-key-here
FRONTEND_URL=https://your-frontend-domain.vercel.app
```

## Local Development

```bash
npm install
npx prisma generate
npx prisma migrate dev
npm start
```

## Deployment

### Deploy REST API to Vercel

```bash
vercel
```

Or use Vercel dashboard - see DEPLOYMENT.md for details.

### Deploy Socket.io Server

Deploy `socket-server.js` to Railway, Render, or similar service that supports persistent WebSocket connections.

See DEPLOYMENT.md for complete deployment instructions.