# Testing Guide

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
