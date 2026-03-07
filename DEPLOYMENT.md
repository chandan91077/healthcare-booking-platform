# Deployment Guide: Frontend & Backend

## Overview

This guide shows how to deploy your frontend and backend to separate hosting platforms.

## GitHub Actions CI/CD (Already Added)

A workflow has been added at `.github/workflows/ci-cd.yml`.

### What it does

- Runs frontend CI on every PR/push to `main`:
  - `npm ci`
  - `npm run lint`
  - `npm run build`
- Runs backend CI on every PR/push to `main`:
  - `cd server && npm ci`
  - `npm test -- --ci`
- On push to `main`, triggers deployment webhooks for backend and frontend.

### Required GitHub repository secrets

Add these in **GitHub → Settings → Secrets and variables → Actions**:

```bash
RENDER_DEPLOY_HOOK_URL=your_render_deploy_hook_url
VERCEL_DEPLOY_HOOK_URL=your_vercel_deploy_hook_url
```

Without these secrets, CI still runs, but deployment trigger steps are skipped.

---

## Backend Deployment (Node.js + MongoDB)

### Recommended Platforms:

- **Render** (Free tier available)
- **Railway** (Free trial)
- **Heroku** (Paid)
- **DigitalOcean App Platform**

### Steps for Render.com (Example):

1. **Push your code to GitHub/GitLab**

2. **Create a new Web Service on Render**
   - Connect your repository
   - Root Directory: `server`
   - Build Command: `npm install`
   - Start Command: `npm start` or `node index.js`

3. **Add Environment Variables in Render Dashboard:**

   ```
   PORT=5000
   MONGO_URI=your_mongodb_connection_string
   JWT_SECRET=your_jwt_secret_key_change_this_in_production
   AWS_ACCESS_KEY_ID=your_aws_access_key_id
   AWS_SECRET_ACCESS_KEY=your_aws_secret_access_key
   AWS_REGION=ap-south-1
   AWS_BUCKET_NAME=mediconnects
   CASHFREE_KEY_ID=your_cashfree_key_id
   CASHFREE_KEY_SECRET=your_cashfree_key_secret
   ZOOM_ACCOUNT_ID=your_zoom_account_id
   ZOOM_CLIENT_ID=your_zoom_client_id
   ZOOM_CLIENT_SECRET=your_zoom_client_secret
   EMAIL_PROVIDER=smtp
   EMAIL_FROM=your_sender_email@example.com
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=your_smtp_user
   SMTP_PASS=your_smtp_app_password
   FRONTEND_URL=https://your-frontend-domain.vercel.app
   ```

4. **Deploy!**
   - Render will give you a URL like: `https://your-app-name.onrender.com`

---

## Frontend Deployment (React + Vite)

### Recommended Platforms:

- **Vercel** (Best for React/Vite)
- **Netlify**
- **Cloudflare Pages**

### Steps for Vercel (Example):

1. **Push your code to GitHub**

2. **Import Project in Vercel**
   - Select your repository
   - Framework Preset: **Vite**
   - Root Directory: `.` (project root)
   - Build Command: `npm run build`
   - Output Directory: `dist`

3. **Add Environment Variables in Vercel Dashboard:**

   ```
   VITE_API_URL=https://your-backend-domain.onrender.com/api
   ```

4. **Deploy!**
   - Vercel will give you a URL like: `https://your-app.vercel.app`

---

## Update CORS After Deployment

Once you have your frontend URL, update backend `.env`:

```env
FRONTEND_URL=https://your-app.vercel.app
```

Then redeploy backend or restart the service.

---

## Testing After Deployment

1. Open frontend URL: `https://your-app.vercel.app`
2. Try signing in
3. Check browser console for any CORS errors
4. Check backend logs for API requests

---

## Common Issues & Solutions

### Issue: CORS Error

**Solution:** Make sure `FRONTEND_URL` in backend `.env` matches your deployed frontend URL exactly (no trailing slash)

### Issue: 404 on API calls

**Solution:** Check that `VITE_API_URL` includes `/api` at the end

### Issue: Environment variables not working

**Solution:**

- Frontend: Must start with `VITE_`
- Redeploy after adding env variables

### Issue: MongoDB connection timeout

**Solution:** Add your hosting provider's IP to MongoDB Atlas whitelist (or use 0.0.0.0/0 for all IPs)

---

## Local Development After Setup

Frontend:

```bash
cd healthlink-connect
npm run dev
```

Backend:

```bash
cd healthlink-connect/server
npm run dev
```

Both will use localhost URLs from `.env` files.
