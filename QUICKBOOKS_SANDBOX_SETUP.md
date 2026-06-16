# QuickBooks Sandbox Setup Guide

This guide walks you through setting up QuickBooks OAuth testing in the sandbox environment while waiting for production verification.

## Quick Summary

The OAuth flow is now fully implemented and working. You just need:
1. **QB Sandbox Credentials** (Client ID & Secret)
2. **ngrok URL** (for local tunneling)
3. **Update .env.local** with sandbox credentials
4. **Test the connection**

---

## Step 1: Get QB Sandbox Credentials

### Option A: Use Your Existing Dev App (If Email Not Verified Yet)

The credentials in `.env.local` should work for sandbox testing:
```
QB_CLIENT_ID="ABhBoORSIWEkmkmC6dFGG4Agl6TwF3xYRYKiDLwKIFJsn3wKgx"
QB_CLIENT_SECRET="S20UcG0EWnZPyMMo6whcq974IAUoowFmwrtEEiIY"
```

**However**, you may need to configure the redirect URI in your app settings first.

### Option B: Create a New Sandbox App at developer.intuit.com

1. Go to [developer.intuit.com](https://developer.intuit.com)
2. Sign in with your Intuit account
3. Click **Create an app**
4. Select:
   - Business type: Accounting
   - App name: "RightSign Sandbox"
5. Go to **Development** tab
6. Copy your:
   - **Client ID**
   - **Client Secret**
7. Save these values - you'll need them next

---

## Step 2: Set Up Local Tunneling with ngrok

### Check Your Current ngrok URL

Your ngrok URL is already in `.env.local`:
```
QB_REDIRECT_URI="https://dexterous-matchbox-balsamic.ngrok-free.dev/api/quickbooks/callback"
```

**Test if this URL is still active:**
```bash
curl https://dexterous-matchbox-balsamic.ngrok-free.dev/
```

If you get a response, it's still active. If not, start a new ngrok tunnel:

### Start Fresh ngrok Tunnel (if needed)

```bash
# Install ngrok if you haven't: choco install ngrok
ngrok http 3000
```

You'll see output like:
```
Forwarding  https://your-new-ngrok-url.ngrok-free.dev -> http://localhost:3000
```

Copy that HTTPS URL - that's your new redirect URI.

---

## Step 3: Update QB App Settings

In your developer.intuit.com app:

1. Go to **Development** tab
2. Under **Redirect URIs**, add:
   ```
   https://your-ngrok-url.ngrok-free.dev/api/quickbooks/callback
   ```
   (Replace with your actual ngrok URL)

3. Make sure **Scopes** include:
   - `com.intuit.quickbooks.accounting`

4. Save

---

## Step 4: Update Your .env.local

Update these three values:

```bash
# QuickBooks OAuth (Sandbox)
QB_CLIENT_ID="your-sandbox-client-id"
QB_CLIENT_SECRET="your-sandbox-client-secret"
QB_REDIRECT_URI="https://your-ngrok-url.ngrok-free.dev/api/quickbooks/callback"
QB_REALM_ID=""  # Will be filled after OAuth completes
QB_ENCRYPTION_KEY="phase2-qbo-encryption-key-change-in-prod"
```

---

## Step 5: Start the Dev Server

Make sure you have three terminals running:

### Terminal 1: Start ngrok
```bash
ngrok http 3000
```
Keep this running - it tunnels your localhost to the ngrok URL.

### Terminal 2: Start Next.js dev server
```bash
cd c:\Users\ratpa\Desktop\RightSignUP
npm run dev
```

### Terminal 3: Keep ready for manual testing if needed

---

## Step 6: Test the OAuth Flow

1. **Start your app locally:**
   ```bash
   npm run dev
   ```

2. **Navigate to QB settings:**
   - Go to `http://localhost:3000/login`
   - Login as: `test@admin.com` / `admin1234`
   - Go to `/admin/settings` → **QuickBooks**

3. **Click "Connect to QuickBooks"**
   - You'll be redirected to Intuit's OAuth screen
   - Select your **Sandbox Company** (usually "Sample Company")
   - Click **Authorize**

4. **Watch for the callback:**
   - You should see redirects happening in the browser
   - Check the terminal for detailed logs
   - If successful, you'll see "✅ Connected to QuickBooks!"

---

## Troubleshooting

### "Invalid redirect URI"
- **Check:** The redirect URI in QB app settings matches your ngrok URL exactly
- **Fix:** Update it in developer.intuit.com and wait a few seconds for it to sync

### "Unauthorized" error
- **Check:** You're logged in as ADMIN (test@admin.com)
- **Check:** Your QB_CLIENT_ID and QB_CLIENT_SECRET are correct
- **Fix:** Copy them again from developer.intuit.com

### ngrok tunnel not working
- **Check:** Is ngrok still running in Terminal 1?
- **Fix:** Kill it and restart with `ngrok http 3000`
- **Check:** Did the URL change? If so, update .env.local and QB app settings

### "Missing code, realmId, or state in callback"
- **Check:** Is the callback URL correct in the browser's address bar?
- **Check:** The query parameters `?code=...&realmId=...&state=...` are present
- **Fix:** Check ngrok and QB app settings redirect URI

### Token exchange fails
- **Check:** QB_CLIENT_SECRET is correct (copy it exactly from developer.intuit.com)
- **Check:** The ngrok URL in QB_REDIRECT_URI matches your tunnel
- **Check:** Logs in Terminal 2 for detailed error message

---

## What Happens After OAuth Success?

Once you successfully connect:

1. **Tokens are encrypted and stored** in the database (`qbo_connections` table)
2. **QB_REALM_ID is saved** - this identifies your QB company
3. **The settings page shows "Connected"** with your company name
4. **Ready for next steps:**
   - Create test invoices
   - Set up QB to local Invoice sync
   - Test auto-invoice creation on order completion

---

## Production Setup (After Email Verified)

Once your production QB app is verified:

1. Create a new app for production in developer.intuit.com (if needed)
2. Get production Client ID & Secret
3. Set up redirect URI: `https://app.northshoresignco.com/api/quickbooks/callback`
4. In Vercel, update environment variables:
   ```
   QB_CLIENT_ID=production-id
   QB_CLIENT_SECRET=production-secret
   QB_REDIRECT_URI=https://app.northshoresignco.com/api/quickbooks/callback
   ```
5. Deploy and test

---

## Testing Sandbox QB Data

Once connected, test creating a QB invoice via API. See `POST /api/quickbooks/webhook` in the codebase for webhook handling.

For full QB API testing, see [Intuit Developer Docs](https://developer.intuit.com/app/developer/qbo/docs/api).
