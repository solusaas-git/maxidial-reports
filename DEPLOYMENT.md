# Vercel Deployment Guide - Maxi Dial Reports

## 🚀 Quick Deploy

### 1. Prerequisites
- Vercel account (sign up at https://vercel.com)
- Git repository (GitHub, GitLab, or Bitbucket)
- Adversus API credentials

### 2. Push to Git Repository
```bash
cd /Users/macbook/Documents/projects/maxi/nextjs-app
git init
git add .
git commit -m "Initial commit - Maxi Dial Reports"
git remote add origin <your-repo-url>
git push -u origin main
```

### 3. Deploy to Vercel

#### Option A: Via Vercel Dashboard
1. Go to https://vercel.com/new
2. Import your Git repository
3. Framework Preset: **Next.js** (auto-detected)
4. Root Directory: `nextjs-app`
5. Click **Deploy**

#### Option B: Via Vercel CLI
```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy
vercel
```

### 4. Configure Environment Variables

After deployment, add these environment variables in Vercel Dashboard:

**Go to: Project Settings → Environment Variables**

Add the following:

| Variable Name              | Value                          | Environment          |
|---------------------------|--------------------------------|----------------------|
| `ADVERSUS_API_URL`        | `https://api.adversus.io/v1`  | Production, Preview  |
| `ADVERSUS_API_USERNAME`   | `your-username`                | Production, Preview  |
| `ADVERSUS_API_PASSWORD`   | `your-password`                | Production, Preview  |

**Important:** Mark these as **Secret** values!

### 5. Redeploy

After adding environment variables, trigger a new deployment:
- Go to **Deployments** tab
- Click **Redeploy** on the latest deployment

---

## 🔐 Security Checklist

- ✅ Environment variables are encrypted by Vercel
- ✅ API credentials never exposed to client
- ✅ All API routes are server-side only
- ✅ `.env.local` is gitignored
- ✅ Login page with CAPTCHA protection
- ✅ Session-based authentication

---

## ⚙️ Configuration Files

### `vercel.json`
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "framework": "nextjs",
  "regions": ["iad1"]
}
```

### Build Settings (Auto-detected)
- **Framework**: Next.js
- **Build Command**: `npm run build`
- **Output Directory**: `.next`
- **Install Command**: `npm install`
- **Node Version**: 18.x or higher

---

## 📊 Performance Optimization

Vercel automatically provides:
- ✅ Global CDN distribution
- ✅ Automatic HTTPS
- ✅ Edge caching
- ✅ Image optimization
- ✅ Serverless functions for API routes

---

## 🔄 Automatic Deployments

Once connected to Git:
- **Production**: Automatically deploys from `main` branch
- **Preview**: Automatically creates preview for pull requests
- **Instant Rollback**: One-click rollback to previous versions

---

## 🌍 Custom Domain (Optional)

1. Go to **Project Settings → Domains**
2. Add your custom domain
3. Follow DNS configuration instructions
4. Vercel automatically provisions SSL certificate

---

## 📝 Post-Deployment Checklist

- [ ] Environment variables configured
- [ ] Test login page functionality
- [ ] Test report generation
- [ ] Test PDF export
- [ ] Verify API connections
- [ ] Check CAPTCHA working
- [ ] Test on mobile devices
- [ ] Monitor build logs for errors

---

## 🐛 Troubleshooting

### Build Fails
- Check Node version (18.x required)
- Verify all dependencies in `package.json`
- Review build logs in Vercel dashboard

### API Errors
- Verify environment variables are set correctly
- Check Adversus API credentials
- Review function logs in Vercel dashboard

### Performance Issues
- Enable caching for static assets
- Use Vercel Analytics for monitoring
- Check serverless function timeout settings

---

## 📞 Support

- Vercel Documentation: https://vercel.com/docs
- Vercel Support: https://vercel.com/support
- Project Repository: [Your GitHub URL]

---

**Deployed by:** SOLUSAAS  
**Framework:** Next.js 14.2.15  
**Last Updated:** October 2025

