# SignPost Field — Phase 1 MVP

Realtor order placement, admin management, role-based auth, and PWA setup.

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Setup

Copy `.env.local.example` to `.env.local` and fill in your values:

```bash
cp .env.local.example .env.local
```

Required environment variables:
- `DATABASE_URL` — PostgreSQL connection string from Railway
- `NEXTAUTH_SECRET` — Generate with: `openssl rand -base64 32`
- `NEXTAUTH_URL` — `http://localhost:3000` for dev
- `NEXT_PUBLIC_GOOGLE_MAPS_KEY` — Google Maps API key
- `RESEND_API_KEY` — From resend.com
- `RESEND_FROM_EMAIL` — Verified sender email

### 3. Database Setup

```bash
# Generate Prisma client
npm run db:generate

# Push schema to database
npm run db:push

# Seed admin account (optional)
npm run db:seed
```

### 4. Create Admin Account (Manual)

If you don't run the seed script, create an admin account manually:

```bash
npx prisma studio
# Navigate to users table and create a new user with:
# - email: admin@example.com
# - passwordHash: (hash using bcryptjs: bcrypt.hash('admin-password', 12))
# - role: ADMIN
```

### 5. Run Development Server

```bash
npm run dev
```

Visit `http://localhost:3000`

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Auth:** NextAuth.js v5
- **Database:** PostgreSQL with Prisma ORM
- **Styling:** Tailwind CSS
- **PWA:** next-pwa
- **Email:** Resend
- **Maps:** Google Maps Places API
- **Deployment:** Vercel (frontend) + Railway (database)

## Features

### Realtor Portal
- Register and log in
- Place orders (Install, Removal, Change)
- View order history
- Cancel pending orders
- Receive confirmation emails

### Admin Dashboard
- View all orders across all realtors
- Create, edit, and delete orders
- Update order status
- Manage realtor accounts
- Add internal notes

### Security
- Role-based access control (REALTOR, ADMIN)
- Bcrypt password hashing
- NextAuth session management
- Protected API routes

### PWA
- Installable on iOS and Android
- Full offline support (shell caching)
- Home screen app icon

## API Routes

### Auth
- `POST /api/auth/register` — Create realtor account
- `POST /api/auth/[...nextauth]` — NextAuth handler

### Realtor Routes
- `GET /api/orders` — List realtor's orders
- `GET /api/orders/[id]` — Order details
- `POST /api/orders` — Create order
- `PUT /api/orders/[id]/cancel` — Cancel pending order

### Admin Routes
- `GET /api/admin/orders` — All orders
- `POST /api/admin/orders` — Create order on behalf of realtor
- `PUT /api/admin/orders/[id]` — Edit order
- `DELETE /api/admin/orders/[id]` — Delete order
- `GET /api/admin/users` — List realtors
- `GET /api/admin/users/[id]` — Realtor details with order history

## Database Schema

### User
- id, email (unique), passwordHash, firstName, lastName, phone, brokerageName, role (REALTOR|ADMIN|TC), createdAt, updatedAt

### Order
- id, orderNumber (unique, auto-generated), realtorId (FK), type (INSTALL|REMOVAL|CHANGE), status (PENDING|SCHEDULED|IN_PROGRESS|IN_GROUND|COMPLETED|CANCELLED), address, addressLat, addressLng, scheduledDate, notes, adminNotes, cancelledAt, cancelReason, createdAt, updatedAt
  - Status meanings: PENDING (awaiting scheduling), SCHEDULED (scheduled), IN_PROGRESS (work in progress), IN_GROUND (sign installed, not removed yet), COMPLETED (sign removed/job done), CANCELLED (cancelled)

### Invoice (stubbed for future use)
### SignInventory (stubbed for future use)

## Deployment

### Frontend (Vercel)
```bash
vercel deploy
```

### Database (Railway)
- Create PostgreSQL plugin
- Copy DATABASE_URL to Vercel environment

## Future Phases

- Phase 2: Transaction Coordinator (TC) accounts, QuickBooks integration
- Phase 3: SMS notifications, sign inventory module
- Phase 4: 811 email monitoring, coupon system
- Phase 5: Stripe payments, analytics dashboard

---

For detailed PRD, see `PRD's/phase1_prd.html`
