# Vercel Environment Variables Setup

To fix the 500 error on Vercel login, ensure these environment variables are set in Vercel Project Settings:

## CRITICAL (Required for login to work)

1. **NEXTAUTH_URL** 
   - Value: `https://app.northshoresignco.com` (NOT localhost!)
   - This tells NextAuth where the app is running

2. **NEXTAUTH_SECRET**
   - Value: [Your secret key from .env.local]
   - Keep the same as local for consistency

3. **DATABASE_URL**
   - Value: [Your Railway PostgreSQL connection string from .env.local]
   - Must be the production database URL

## Email & Notifications

4. **SENDGRID_API_KEY**
   - Value: [Your SendGrid API key from .env.local]

5. **SENDGRID_FROM_EMAIL**
   - Value: `noreply@northshoresignco.com`

## Other Services

6. **NEXT_PUBLIC_GOOGLE_MAPS_KEY**
   - Value: [Your Google Maps API key from .env.local]
   - This is public, so NEXT_PUBLIC_ prefix is correct

7. **SENTRY_DSN** & **NEXT_PUBLIC_SENTRY_DSN**
   - Value: [Your Sentry DSN from .env.local]

8. **TWILIO_ACCOUNT_SID**, **TWILIO_AUTH_TOKEN**, **TWILIO_PHONE_NUMBER**
   - For SMS notifications - [Values from .env.local]

## Steps to Fix Vercel Login:

1. Go to **Vercel Dashboard** → Your Project → **Settings** → **Environment Variables**
2. Add/Update these critical variables (copy values from your .env.local file):
   - `NEXTAUTH_URL` = `https://app.northshoresignco.com`
   - `NEXTAUTH_SECRET` = [from .env.local]
   - `DATABASE_URL` = [from .env.local]
   - Other env vars from .env.local as needed
3. **Redeploy** the project (it should auto-redeploy, or manually trigger)
4. Test login at `https://app.northshoresignco.com/login`

## Common Causes of 500 Error:

- ❌ **NEXTAUTH_URL is set to localhost** (most common!)
- ❌ **DATABASE_URL is missing or incorrect**
- ❌ **NEXTAUTH_SECRET is missing**
- ❌ Environment variables not redeployed yet

## If Still Getting 500:

1. Check Vercel deployment logs for detailed error
2. Verify all three critical vars are set and correct
3. Redeploy after updating environment variables
4. Clear browser cache and try again

