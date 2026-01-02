# Deployment Guide for Chat App

## Step 1: Deploy Backend (Railway)

### 1.1 Create Railway Account
1. Go to https://railway.app
2. Sign up with GitHub account
3. Verify your email

### 1.2 Deploy Backend
1. Click "New Project" → "Deploy from GitHub repo"
2. Connect your GitHub account
3. Push your code to GitHub first:
   ```bash
   cd server
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin YOUR_GITHUB_REPO_URL
   git push -u origin main
   ```
4. Select your repository
5. Railway will auto-detect Node.js and deploy

### 1.3 Add Database
1. In Railway dashboard, click "New" → "Database" → "MySQL"
2. Wait for database to deploy
3. Click on MySQL service → "Variables" tab
4. Copy the connection details

### 1.4 Set Environment Variables
In Railway backend service → "Variables" tab, add:
```
NODE_ENV=production
JWT_SECRET=your-super-secret-jwt-key-12345
DB_HOST=[from MySQL service]
DB_USER=[from MySQL service] 
DB_PASSWORD=[from MySQL service]
DB_NAME=[from MySQL service]
```

### 1.5 Get Backend URL
- Copy your Railway backend URL (e.g., https://your-app.railway.app)

## Step 2: Deploy Frontend (Vercel)

### 2.1 Create Vercel Account
1. Go to https://vercel.com
2. Sign up with GitHub account

### 2.2 Update Frontend Environment
1. Update `client/hybrid-client/.env`:
   ```
   REACT_APP_API_URL=https://your-railway-backend-url.railway.app
   REACT_APP_WS_URL=wss://your-railway-backend-url.railway.app
   ```

### 2.3 Deploy Frontend
1. Push frontend to GitHub (separate repo or same repo)
2. In Vercel dashboard: "New Project"
3. Import your GitHub repository
4. Set root directory to `client/hybrid-client`
5. Add environment variables in Vercel:
   - `REACT_APP_API_URL`: Your Railway backend URL
   - `REACT_APP_WS_URL`: Your Railway WebSocket URL (wss://)
6. Deploy

## Step 3: Update CORS
Update your backend CORS settings to include your Vercel domain:
```javascript
app.use(cors({
  origin: [
    'http://localhost:3000', 
    'http://localhost:3001',
    'https://your-vercel-app.vercel.app'
  ],
  credentials: true
}));
```

## Step 4: Test Deployment
1. Visit your Vercel URL
2. Register a new user
3. Test chat functionality
4. Login as admin: admin@chatapp.com / admin123

## Admin Access
- Email: admin@chatapp.com
- Password: admin123

## Costs
- Railway: Free tier (500 hours/month)
- Vercel: Free tier (unlimited for personal projects)
- Total: FREE for small usage

## Alternative: Single Platform (Railway)
You can deploy both frontend and backend on Railway:
1. Create separate services for frontend and backend
2. Frontend service: Set build command to `npm run build`
3. Both will be on Railway domains