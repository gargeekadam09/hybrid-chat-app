# Single Platform Deployment (Railway)

## ✅ Benefits of Single Platform:
- **Simpler**: One platform to manage
- **Cheaper**: One service instead of two
- **Easier**: No CORS issues between domains
- **Faster**: No separate deployments

## 🚀 Step-by-Step Deployment:

### 1. Create Railway Account
1. Go to https://railway.app
2. Sign up with GitHub
3. Verify email

### 2. Prepare Your Code
```bash
# Create a single repository
git init
git add .
git commit -m "Initial commit"
git branch -M main
# Create GitHub repo and push
git remote add origin YOUR_GITHUB_REPO_URL
git push -u origin main
```

### 3. Deploy on Railway
1. **New Project** → **Deploy from GitHub repo**
2. Select your repository
3. Railway will detect Node.js and deploy from `/server` folder

### 4. Add Database
1. Click **"New"** → **"Database"** → **"MySQL"**
2. Wait for database to deploy

### 5. Set Environment Variables
In your service → **"Variables"** tab:
```
NODE_ENV=production
JWT_SECRET=your-super-secret-jwt-key-12345
DB_HOST=[copy from MySQL service]
DB_USER=[copy from MySQL service]
DB_PASSWORD=[copy from MySQL service]
DB_NAME=[copy from MySQL service]
```

### 6. Configure Build
In **"Settings"** → **"Build"**:
- **Root Directory**: `server`
- **Build Command**: `npm run build`
- **Start Command**: `npm start`

### 7. Access Your App
- Railway will give you a URL like: `https://your-app.railway.app`
- Both frontend and backend will be served from this single URL

## 🎯 Admin Access:
- URL: `https://your-app.railway.app`
- Email: `admin@chatapp.com`
- Password: `admin123`

## 💰 Cost: 
- **FREE** (Railway free tier: 500 hours/month)
- Perfect for personal projects

## 🔧 How it Works:
- Railway serves your React app (frontend) 
- Same server handles API calls (backend)
- Single domain = no CORS issues
- WebSockets work perfectly

**This is the EASIEST way for beginners!**