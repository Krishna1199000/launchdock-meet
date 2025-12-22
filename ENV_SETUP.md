# Environment Variables Setup

## Step 1: Create .env.local File

Create a file named `.env.local` in the root of your project (same level as `package.json`).

## Step 2: Add These Variables

Since Next.js combines frontend and backend, you need these for the **Next.js app**:

```env
# Database Connection (used by API routes: app/api/*/route.ts)
DATABASE_URL="postgresql://user:password@localhost:5432/videochat?schema=public"

# JWT Secret (used by API routes for auth: app/api/auth/*/route.ts)
JWT_SECRET="your-secret-key-change-in-production"

# Socket.io Server URL (used by frontend pages: app/*/page.tsx)
NEXT_PUBLIC_SOCKET_URL="http://localhost:3001"
```

**Note:** `FRONTEND_URL` is NOT needed in `.env.local` - it's only for the separate Socket.io server.

## Step 3: Fill in Your Values

### DATABASE_URL

**Local Development:**
- If using local PostgreSQL:
  ```
  DATABASE_URL="postgresql://postgres:yourpassword@localhost:5432/videochat?schema=public"
  ```

**Production (Cloud Database):**
- **Neon**: Get from Neon dashboard → Connection String
- **Supabase**: Get from Supabase dashboard → Settings → Database → Connection String
- **Railway**: Get from Railway database service → Variables → DATABASE_URL

Example:
```
DATABASE_URL="postgresql://user:password@ep-xxx.us-east-1.aws.neon.tech/videochat?sslmode=require"
```

### JWT_SECRET

Generate a strong random secret key:

**Option 1: Using Node.js**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Option 2: Use an online generator**
- Visit: https://generate-secret.vercel.app/32

**Option 3: Create a simple one (not recommended for production)**
```
JWT_SECRET="my-super-secret-key-change-this-in-production"
```

### NEXT_PUBLIC_SOCKET_URL

**Local Development:**
```
NEXT_PUBLIC_SOCKET_URL="http://localhost:3001"
```

**Production:**
```
NEXT_PUBLIC_SOCKET_URL="https://your-socket-server.railway.app"
```
(Use your deployed Socket.io server URL)

### FRONTEND_URL

**Important:** `FRONTEND_URL` is **NOT** needed in `.env.local`!

It's only used by the **separate Socket.io server** (`socket-server.js`) for CORS configuration. Create a separate `.env` file for the Socket.io server if needed.

## Complete Example

### For Local Development (.env.local) - Next.js App:
```env
DATABASE_URL="postgresql://postgres:mypassword@localhost:5432/videochat?schema=public"
JWT_SECRET="a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6"
NEXT_PUBLIC_SOCKET_URL="http://localhost:3001"
```

### For Production (Vercel Environment Variables) - Next.js App:
```
DATABASE_URL=postgresql://user:pass@host:5432/db?sslmode=require
JWT_SECRET=your-production-secret-key
NEXT_PUBLIC_SOCKET_URL=https://your-socket-server.railway.app
```

### For Socket.io Server (separate deployment on Railway/Render):
```
DATABASE_URL=postgresql://user:pass@host:5432/db?sslmode=require
FRONTEND_URL=https://your-app.vercel.app
```

## Important Notes

1. **Never commit `.env.local`** - It's already in `.gitignore`
2. **Use `.env.local` for local development** - Next.js automatically loads it
3. **For production (Vercel)**, add these as Environment Variables in the Vercel dashboard
4. **NEXT_PUBLIC_ prefix** - Variables starting with `NEXT_PUBLIC_` are exposed to the browser
5. **Next.js unified structure** - Frontend pages (`app/*/page.tsx`) and API routes (`app/api/*/route.ts`) both use the same `.env.local` file
6. **Socket.io server** runs separately and needs its own environment variables (on Railway/Render dashboard)

## Verification

After setting up, test that everything works:

1. **Check database connection:**
   ```bash
   npx prisma studio
   ```

2. **Start development servers:**
   ```bash
   npm run dev        # Next.js (Terminal 1)
   npm run socket:dev # Socket.io (Terminal 2)
   ```

3. **Test the app:**
   - Visit http://localhost:3000
   - Try signing up
   - Check browser console for any errors
