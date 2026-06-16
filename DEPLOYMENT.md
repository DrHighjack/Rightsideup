# Deployment Guide

## Prerequisites

- Node.js 18+ and npm
- PostgreSQL database (or Railway account)
- Vercel account (for hosting)
- Google Cloud account (for Maps API)
- Resend account (for emails)

## Step 1: Local Development Setup

### 1.1 Clone and Install

```bash
cd /path/to/RightSignUP
npm install
```

### 1.2 Database Setup

**Option A: Local PostgreSQL**
```bash
# Ensure PostgreSQL is running locally
createdb signpost_field

# Update .env.local
DATABASE_URL="postgresql://user:password@localhost:5432/signpost_field"
```

**Option B: Railway (Recommended)**
1. Go to railway.app
2. Create new project
3. Add PostgreSQL plugin
4. Copy DATABASE_URL to .env.local

### 1.3 Configure Environment

```bash
cp .env.local.example .env.local
```

Fill in:
```env
DATABASE_URL=postgresql://...
NEXTAUTH_SECRET=$(openssl rand -base64 32)
NEXTAUTH_URL=http://localhost:3000
NEXT_PUBLIC_GOOGLE_MAPS_KEY=your_maps_api_key
RESEND_API_KEY=your_resend_api_key
RESEND_FROM_EMAIL=orders@yourdomain.com
```

### 1.4 Initialize Database

```bash
# Generate Prisma client
npm run db:generate

# Create tables
npm run db:push

# Seed admin and test accounts
npm run db:seed
```

### 1.5 Run Locally

```bash
npm run dev
```

Visit http://localhost:3000

**Test Accounts:**
- Admin: admin@signpost.local / admin123456
- Realtor: test@realtor.local / realtor123456

## Step 2: Setup External Services

### 2.1 Google Maps API

1. Go to Google Cloud Console
2. Create new project
3. Enable "Maps JavaScript API" and "Places API"
4. Create API key (restrict to your domain)
5. Add to .env.local

### 2.2 Resend Email

1. Go to resend.com
2. Create account
3. Add a verified domain
4. Get API key
5. Update .env.local with RESEND_API_KEY and RESEND_FROM_EMAIL

## Step 3: Deploy to Production

### 3.1 Prepare Repository

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin your_repo_url
git push -u origin main
```

### 3.2 Deploy to Vercel

**Option A: CLI**
```bash
npm i -g vercel
vercel
# Follow prompts, connect to GitHub repo
```

**Option B: Web Interface**
1. Go to vercel.com
2. Import GitHub repository
3. Configure environment variables
4. Deploy

### 3.3 Configure Production Environment

In Vercel dashboard, add Environment Variables:
```
DATABASE_URL=your_production_db_url
NEXTAUTH_SECRET=your_production_secret
NEXTAUTH_URL=https://your-domain.com
NEXT_PUBLIC_GOOGLE_MAPS_KEY=your_maps_key
RESEND_API_KEY=your_resend_key
RESEND_FROM_EMAIL=orders@your-domain.com
```

### 3.4 Post-Deployment

```bash
# Run migrations on production
vercel env pull .env.production.local
npm run db:push -- --skip-generate
```

## Step 4: Configure PWA

### 4.1 Add Icons

1. Create 192x192 and 512x512 PNG icons
2. Add to `/public/` as:
   - `icon-192.png`
   - `icon-512.png`
   - `apple-touch-icon.png` (180x180)

### 4.2 Test PWA

1. Visit your Vercel deployment in Safari (iOS)
2. Tap Share > Add to Home Screen
3. Verify it installs as standalone app

In Android Chrome:
1. Menu > Install app
2. Verify it installs

## Troubleshooting

### Database Connection Issues
```bash
# Test connection
npx prisma db execute --stdin < test.sql

# View logs
npm run db:push -- --verbose
```

### Auth Issues
- Ensure NEXTAUTH_SECRET is set to same value everywhere
- Check NEXTAUTH_URL matches your domain
- Verify cookies aren't blocked by browser settings

### Email Not Sending
- Check RESEND_API_KEY is correct
- Verify RESEND_FROM_EMAIL is verified in Resend dashboard
- Check spam folder
- View logs: `vercel logs`

### PWA Not Installing
- Check manifest.json is valid
- Ensure HTTPS is enabled (Vercel does this by default)
- Check icons exist and are correct format
- Clear browser cache and try again

## Monitoring & Maintenance

### Weekly
- Check Vercel analytics
- Review error logs
- Monitor database performance

### Monthly
- Update npm dependencies: `npm update`
- Review security advisories: `npm audit`
- Backup database (if not auto-backed up)

### Quarterly
- Update Node.js version
- Review and update Prisma schema as needed
- Test disaster recovery procedures

## Scaling Considerations

### When to Scale
- Database hits 80%+ capacity
- Response times exceed 1000ms
- More than 100 concurrent users

### Scaling Steps
1. Upgrade Railway database plan
2. Add Vercel Pro for faster deployments
3. Implement caching layer (Redis)
4. Add CDN for static assets

---

For questions, refer to the main README.md or Phase 1 PRD.
