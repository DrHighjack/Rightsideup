# Track 4 Step 14 - Admin Settings Page Implementation
## Final Step of Phase 4

### ✅ Completed Implementation

#### 1. Database Infrastructure
- **Model**: `AppSettings` (key-value store with encryption support)
  - `id`: Primary key (cuid)
  - `key`: Unique setting key (e.g., "imap.imapHost")
  - `value`: Encrypted or plain text value
  - `isEncrypted`: Boolean flag for sensitive fields
  - `updatedAt`: Auto-updated timestamp
  - Index on `key` for performance
- **Status**: Already in schema, migrated to production ✅

#### 2. Settings Page - `/admin/settings`

**File**: `app/admin/settings/page.tsx` (React client component, 500+ lines)

**Section 1 - 811 Inbox Configuration**
- Input fields:
  - IMAP Host (text, e.g., "imap.gmail.com")
  - IMAP Port (number, default "993")
  - IMAP Email (email input)
  - IMAP Password (password input, masked with dots)
  - Poll Interval (number, minutes)
- Buttons:
  - "Test Connection" → Calls POST /api/admin/settings/test-imap
  - "Save" → Saves section via POST /api/admin/settings
- Status messages:
  - Success (green): "✅ Saved successfully"
  - Test Success (green): "✅ IMAP connection successful"
  - Error (red): "❌ Connection failed: [error message]"

**Section 2 - Notifications**
- Input fields:
  - Admin Alert Email (email)
  - Invoice Reminder Days (text, comma-separated: "7,14,30")
  - SMS Opt-in Default (checkbox)
- "Save" button for this section

**Section 3 - Inventory**
- Input fields:
  - Low Inventory Threshold (number, default "5")
  - Helper text: "Applies to all sign types"
- "Save" button for this section

**Section 4 - QuickBooks**
- Display only: "QuickBooks integration coming soon"
- Greyed out (opacity-50) and disabled

**Features**:
- Independent save buttons per section (no page-wide save)
- Pre-fill fields on load from database
- Masked password input field (type="password")
- Real-time success/error messages with auto-dismiss (3-5 seconds)
- Loading state on mount
- Disabled submit buttons during save

#### 3. API Routes

**File**: `app/api/admin/settings/route.ts` (GET & POST)

**GET Handler**:
- Fetches all AppSettings from database
- Decrypts encrypted fields (isEncrypted = true)
- Parses JSON values where applicable
- Returns key-value object
- Auth: ADMIN role required (403 if not)

**POST Handler**:
- Receives: `{ section, settings }`
- Encrypts sensitive fields based on section:
  - `imap` section: encrypt `imapPassword`
  - Other sections: no encryption
- Upserts each setting to database with `isEncrypted` flag
- Auth: ADMIN role required (403 if not)

**File**: `app/api/admin/settings/test-imap/route.ts` (POST)

**Test IMAP Connection**:
- Receives: `{ imapHost, imapPort, imapEmail, imapPassword }`
- Imports ImapFlow dynamically (webpack fix)
- Attempts connection with provided credentials
- Returns:
  - Success (200): `{ success: true, message: "IMAP connection successful" }`
  - Failure (400): `{ success: false, message: "IMAP connection failed: [error]" }`
- Auth: ADMIN role required (403 if not)

#### 4. Encryption Implementation

**File**: `lib/encryption.ts` (already exists, reused)

**Functions**:
- `encryptToken(plainText)`: Encrypts using AES-256-CBC
  - Generates random IV
  - Returns: "ivHex:encryptedHex"
- `decryptToken(encryptedData)`: Decrypts
  - Parses IV and encrypted data
  - Returns: decrypted plaintext

**Key Derivation**:
- Uses `process.env.QB_ENCRYPTION_KEY || 'change-me-in-production'`
- Hashed with SHA256 to create 32-byte key for AES-256

#### 5. Updated Email Poller

**File**: `lib/emailPoller.ts` - `connectAndFetch()` function

**Changes**:
- Dynamically imports prisma and decryptToken
- Attempts to fetch IMAP credentials from database first:
  - Queries: `imap.imapHost`, `imap.imapPort`, `imap.imapEmail`, `imap.imapPassword`
  - Decrypts encrypted fields
- Falls back to environment variables if not in database:
  - `IMAP_HOST`, `IMAP_PORT`, `IMAP_USER`, `IMAP_PASSWORD`
- Error message updated to suggest /admin/settings page

**Priority**:
1. Database settings (if configured)
2. Environment variables (fallback)

#### 6. Admin Sidebar Navigation

**File**: `app/admin/layout.tsx`

Added Settings link:
```jsx
<div className="pt-4 mt-4 border-t border-gray-200">
  <Link
    href="/admin/settings"
    className="block px-4 py-2 text-sm font-medium text-gray-700 hover:text-primary"
  >
    ⚙️ Settings
  </Link>
</div>
```

**Location**: Bottom of sidebar navigation, above Sign Out button

### 🧪 Testing Verification

**Test Results** (from test-step14-settings.ts):

✅ IMAP credentials encrypted and stored
✅ Sensitive fields properly encrypted with isEncrypted flag
✅ Settings can be retrieved and decrypted
✅ Notification settings stored (non-encrypted)
✅ Inventory settings stored (non-encrypted)
✅ emailPoller can query settings from database

**Example Encrypted Password**:
```
Plain: test-app-password-123
Encrypted: ee96c8ea0a029fb74cf7e3a6bf9cad...
Stored as: imap.imapPassword = "ee96c8ea0a029fb74cf7e3a6bf9cad[IV:ENCRYPTED]"
Decrypted: ✅ test-app-password-123
```

### 📋 Implementation Checklist

✅ AppSettings model in schema.prisma
✅ AppSettings table migrated to database
✅ `/admin/settings` page created (4 sections)
✅ Section 1: 811 IMAP Configuration
  - Host, Port, Email, Password inputs
  - Test Connection button
  - Save button
✅ Section 2: Notifications
  - Admin Alert Email
  - Invoice Reminder Days
  - SMS Opt-in Default
✅ Section 3: Inventory
  - Low Inventory Threshold
✅ Section 4: QuickBooks (greyed out)
✅ GET /api/admin/settings (fetch and decrypt)
✅ POST /api/admin/settings (encrypt and save)
✅ POST /api/admin/settings/test-imap (test connection)
✅ Encryption utilities (AES-256-CBC)
✅ emailPoller.ts updated to check database first
✅ Settings link in admin sidebar
✅ Error handling and validation
✅ Success/error message display
✅ Password masking in UI
✅ Auth checks (ADMIN role required)

### 🔐 Security Features

- IMAP password encrypted before storage
- IV included with each encrypted value for randomness
- isEncrypted flag identifies sensitive fields
- Decryption on retrieval only
- Password input masked in UI (type="password")
- Settings API requires ADMIN role
- Test IMAP endpoint validates credentials before using

### 📊 Database Schema

```sql
CREATE TABLE "app_settings" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "key" TEXT NOT NULL UNIQUE,
  "value" TEXT NOT NULL,
  "isEncrypted" BOOLEAN NOT NULL DEFAULT false,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "app_settings_key_key" UNIQUE("key")
);

CREATE INDEX "app_settings_key_idx" ON "app_settings"("key");
```

### 📝 Settings Storage Examples

**IMAP Settings** (encrypted):
```
Key: imap.imapHost
Value: imap.gmail.com
isEncrypted: false

Key: imap.imapPassword
Value: ee96c8ea0a029fb74cf7e3a6bf9cad[encrypted]
isEncrypted: true
```

**Notification Settings** (plain text):
```
Key: notifications.adminAlertEmail
Value: admin@example.com
isEncrypted: false

Key: notifications.invoiceReminderDays
Value: 7,14,30
isEncrypted: false
```

**Inventory Settings** (plain text):
```
Key: inventory.lowInventoryThreshold
Value: 5
isEncrypted: false
```

### 🚀 Deployment Ready

- ✅ No TypeScript errors
- ✅ Proper error handling throughout
- ✅ Fallback to environment variables for backward compatibility
- ✅ Dynamic imports to avoid webpack bundling issues
- ✅ Comprehensive logging for monitoring
- ✅ Ready for production use

### 📖 User Workflow

1. Admin navigates to "Settings" link in sidebar (bottom)
2. Settings page loads and fetches current values from database
3. Admin fills in IMAP credentials in Section 1
4. Admin clicks "Test Connection" button
5. System attempts IMAP connection with provided credentials
6. Success message displayed if connection works
7. Admin clicks "Save" button to encrypt and store credentials
8. Credentials stored in AppSettings table with encryption
9. Next 811 email poll (5-minute interval) uses database credentials
10. If settings not configured, system falls back to env vars

### ✅ Phase 4 Complete

**Step 12**: ✅ Invoice Aging Reminders (Daily scheduler)
**Step 13**: ✅ Stale Order Check (Pending > 48 hours detection)
**Step 14**: ✅ Admin Settings Page (IMAP config + notifications)

**All Phase 4 Steps Complete and Production Ready**

---

**Status: STEP 14 COMPLETE ✅**
