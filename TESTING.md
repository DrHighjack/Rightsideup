# Testing Guide

## Automated Tests

Run `npm test` (Vitest) before committing. Coverage currently includes invoice money
math (integer cents), zod API input boundaries, rate-limit identifiers, and the
magic-login redirect guard. Add a test under `tests/` whenever you change money,
auth, or validation logic.

### Critical API Integration Tests

Run from the project directory with dependencies installed, a generated Prisma
client (`npm run db:generate`), and a running Docker daemon:

```sh
npm run test:integration
```

The suite exercises real NextAuth credentials HTTP handlers, mobile login and
bearer-token verification, order creation, invoice listing/detail ownership
(including realtor A attempting to read realtor B's invoice), and invoice
charges. Route handlers and Prisma queries are real; FluidPay, email, Discord,
SMS/push notifications, and Sentry are mocked. Unexpected outbound `fetch`
calls fail. These are handler/database integration tests, not browser or
running-Next.js-server tests.

Each local run creates its own `postgres:16-alpine` Docker container with a random
loopback-only port and temporary in-memory storage. It overrides `DATABASE_URL`
with the container URL and rejects non-disposable URLs before schema creation
or fixture cleanup. It never uses the Railway URL or an externally supplied
local test database. `prisma db push --skip-generate` applies the current schema only
to this empty database; migration-history auditing is a separate task.
Fixtures reset between tests, and the container is removed on completion or
setup failure. If the process is forcibly killed, remove any leftover
`rightsignup-integration-*` container with `docker rm -fv <container-name>`.

`npm test` runs the existing unit suite without Docker. Run both commands for
the complete automated suite. No live payment credentials are required.

### Pull Request and Main CI

The Stability workflow runs lint, `npm run type-check`, unit tests, integration
tests, and `npx --no-install next build` on every pull request and push to main.
It installs dependencies with `npm ci` and generates the Prisma client first.

GitHub Actions supplies a disposable Postgres service container. With `CI=true`,
the integration harness accepts `INTEGRATION_DATABASE_URL` only for the guarded
loopback host, integration credentials, and integration database name. It also
refuses any database that already contains application tables. GitHub Actions
removes the service after the job. Local runs retain their Docker-managed mode.

CI uses only dummy auth/payment values and its local Postgres URL, never Railway
or production secrets. It invokes Next.js directly because `npm run build`
also runs `prisma migrate deploy`; migration deployment is intentionally not a
CI check. Migration/schema drift auditing remains separate.

### Protected Route Matrix

`tests/integration/route-roles.test.ts` lists every admin, realtor, and field
route and every HTTP method, including PATCH. It compares that table against
the actual exported handlers and discovers exclusive realtor/field guards
outside those directories. Adding an unlisted route or method fails coverage.

Each handler is exercised anonymously and with real encrypted NextAuth session
cookies for ADMIN, REALTOR, TC, and FIELD_TECH, backed by disposable Postgres
users. Missing sessions must return 401; disallowed roles must return 403;
allowed roles must get past authentication/role denial. Positive cases may
return input-validation or missing-resource errors, so this is authorization
coverage, not full business-operation coverage. The realtor 811 and policy
routes intentionally allow both REALTOR and TC. Existing sales/brokerage
access to specific admin brokerage functions is preserved.

Stability CI also runs on `feature/stability-*` pushes so feature changes can
be verified without pushing to main. It never consumes GitHub production
secrets or deployment migrations.

## Smart Sign / NFC Notes

- Web NFC scanning (installer "Scan NFC Box") requires Android Chrome over HTTPS.
  On other browsers, installers must paste the box URL or enter the printed code.
- QR codes are the volume driver; every tag also supports manual entry.

### Tapbox Discord Visits

Live, assigned Tapbox listing pages send a Discord message for each page open
(including reloads), using the existing configured Discord webhook. Enable
`Tapbox Visits` in Admin Settings > Discord notifications. Existing email
refresh/return deduplication is unchanged; location-sharing requests do not
generate another Discord visit.

The message includes the listing address, opening time, and Tapbox code.
Visible-page active time updates that same message every 30 seconds and when
the browser backgrounds or leaves the page. Hidden time is excluded. This
measures the hosted Tapbox page, not time on another website or a confirmed
physical NFC tap. Mobile termination, blocked requests, or closing before the
first response can prevent a final update; the last observation is best effort.

Duration requests use a 24-hour signed token scoped to the Tapbox URL and a
specific Discord message. `AUTH_SECRET` (or `NEXTAUTH_SECRET`) must be configured.
Reported active time is bounded by server elapsed time. No database migration
is required, webhook credentials are never sent to the browser, and webhook
failures do not block visit recording or listing access.

Focused checks (HTTP mocked; no real Discord notifications):

```sh
npx vitest run tests/tapbox-discord.test.ts tests/tapbox-tracking.test.ts tests/smart-sign-visits.test.ts
```

## Test Accounts

### Admin
- Email: `admin@signpost.local`
- Password: `admin123456`
- Role: ADMIN
- Access: Full system access, /admin routes

### Realtor
- Email: `test@realtor.local`
- Password: `realtor123456`
- Role: REALTOR
- Access: Dashboard, order management

## Acceptance Criteria Testing

### Authentication
- [ ] New realtor can register with valid email
- [ ] Registration validates password (min 8 chars)
- [ ] Registration checks for duplicate emails
- [ ] Login with correct credentials succeeds
- [ ] Login with wrong password shows error
- [ ] Login redirects admin to /admin
- [ ] Login redirects realtor to /dashboard
- [ ] Unauthenticated requests to protected routes redirect to /login
- [ ] Session expires after 30 days
- [ ] PasswordHash never appears in API responses

### Order Placement
- [ ] Realtor can create INSTALL order
- [ ] Realtor can create REMOVAL order
- [ ] Realtor can create CHANGE order
- [ ] Address field accepts input
- [ ] Date picker prevents past dates
- [ ] Notes field is optional
- [ ] Order appears in dashboard immediately
- [ ] Order status is PENDING on creation
- [ ] Unique order number is generated (SPF-00001)

### Order Email Confirmation
- [ ] Email sent within 30 seconds of order placement
- [ ] Email contains correct order number
- [ ] Email contains address and type
- [ ] Email sent to realtor's email address
- [ ] Email includes dashboard link

### Order Cancellation
- [ ] Realtor can cancel PENDING orders only
- [ ] Cancel button not shown for non-PENDING orders
- [ ] Cancel shows confirmation modal
- [ ] Optional cancel reason is captured
- [ ] Cancelled order shows CANCELLED status
- [ ] Cancelled orders remain in history

### Admin Order Management
- [ ] Admin sees all orders from all realtors
- [ ] Admin can filter by status (PENDING, SCHEDULED, etc.)
- [ ] Admin can filter by type (INSTALL, REMOVAL, CHANGE)
- [ ] Admin can search by order number
- [ ] Admin can search by address
- [ ] Admin can create order on behalf of realtor
- [ ] Admin can set initial status when creating
- [ ] Admin can edit any order field
- [ ] Admin notes not visible to realtors
- [ ] Admin can change order status
- [ ] Admin can delete order with confirmation

### Admin User Management
- [ ] Admin can view list of all realtor accounts
- [ ] Admin can search realtors by name
- [ ] Admin can search realtors by email
- [ ] Admin can search realtors by brokerage
- [ ] Admin can view individual realtor profile
- [ ] Admin can see realtor order count
- [ ] Admin can view realtor order history

### PWA & Mobile
- [ ] App is responsive on 390px viewport
- [ ] Bottom nav visible on mobile dashboards
- [ ] Bottom nav has 4 tabs: Home, Orders, New, Account
- [ ] No horizontal scrolling on any page
- [ ] manifest.json is valid and served
- [ ] Icons (192x192, 512x512) exist and render
- [ ] Service worker registered (check DevTools > Application)
- [ ] Can "Add to Home Screen" on iOS Safari
- [ ] Can "Install app" on Android Chrome
- [ ] App launches full-screen without browser chrome

### Security
- [ ] Realtor cannot access /admin routes
- [ ] Realtor can only view their own orders
- [ ] Realtor cannot edit other realtor's orders
- [ ] Admin cannot register new admin accounts via UI
- [ ] Admin role not settable from API client
- [ ] SQL injection attempts blocked by Prisma
- [ ] XSS attacks mitigated by React
- [ ] CSRF protection via NextAuth

### API Routes
- [ ] GET /api/orders returns realtor's orders only
- [ ] GET /api/admin/orders returns all orders
- [ ] POST /api/orders creates order with realtor ID from session
- [ ] PUT /api/admin/orders/[id] updates any order
- [ ] DELETE /api/admin/orders/[id] requires confirmation flag
- [ ] All API routes reject unauthenticated requests (401)
- [ ] All API routes check authorization (403 for REALTOR accessing /admin)
- [ ] Pagination works correctly (limit, page params)
- [ ] Search parameters filter correctly

## Performance Testing

- [ ] Dashboard loads in < 2 seconds
- [ ] Order list loads in < 1 second
- [ ] Order creation completes in < 2 seconds
- [ ] Email sends within 30 seconds
- [ ] Database queries use indexes
- [ ] No N+1 query problems

## Browser Compatibility

- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Safari iOS (latest)
- [ ] Chrome Android (latest)

## Test Scenarios

### Scenario 1: New Realtor Flow
1. Visit /register
2. Fill form with new account
3. Submit
4. Redirect to /login
5. Log in with new credentials
6. Redirected to /dashboard
7. See empty dashboard
8. Click "Place New Order"
9. Fill order form
10. Submit
11. See success confirmation
12. View order in dashboard

### Scenario 2: Admin Creates Order
1. Log in as admin
2. Go to /admin/orders/new
3. Select realtor from dropdown
4. Fill order details
5. Select initial status
6. Submit
7. See order in admin dashboard
8. Realtor sees order in their dashboard (if not CANCELLED)

### Scenario 3: Order Status Update
1. Admin views order
2. Clicks Edit
3. Changes status to IN_PROGRESS
4. Saves
5. Realtor views same order
6. Status updated (but not admin notes)
7. Timeline shows update

## Data Validation

### Valid Inputs
- [ ] Email: valid@example.com
- [ ] Password: Abc12345
- [ ] Name: John
- [ ] Phone: 555-1234
- [ ] Address: 123 Main St, Springfield, IL

### Invalid Inputs (Should Reject)
- [ ] Email: notanemail
- [ ] Password: short (< 8 chars)
- [ ] Empty required fields
- [ ] Past dates in date picker
- [ ] Duplicate email on registration

## Regression Testing Checklist

After each deployment, verify:
- [ ] Can log in as admin
- [ ] Can log in as realtor
- [ ] Can create order
- [ ] Can cancel PENDING order
- [ ] Admin can view all orders
- [ ] Admin can edit order
- [ ] Email notifications send
- [ ] PWA still installable
- [ ] Mobile responsive
- [ ] No console errors

---

For issues found, create a bug report with:
1. Steps to reproduce
2. Expected behavior
3. Actual behavior
4. Browser/device info
5. Screenshots if applicable
