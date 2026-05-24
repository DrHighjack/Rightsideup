# Track 4 Step 13 - Stale Order Check Implementation
## Completed Successfully

### ✅ Database Schema & Migration

**Updated** `prisma/schema.prisma` - Added to Order model:
- `isStale Boolean @default(false)` - Marks orders as stale
- `staleAt DateTime?` - Timestamp when order was marked stale
- Added index on `isStale` for query performance

**Migration Applied:**
```sql
Migration: 20260524204625_add_stale_order_flags

ALTER TABLE "orders" ADD COLUMN "isStale" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "orders" ADD COLUMN "staleAt" TIMESTAMP(3);
CREATE INDEX "orders_isStale_idx" ON "orders"("isStale");

Status: ✅ Applied cleanly to production database
```

### ✅ Scheduler Implementation

**File:** `lib/scheduler.ts`

Added `checkStaleOrders()` function that:

1. **Query**: Finds all PENDING orders where `updatedAt < 48 hours ago` and `isStale = false`
2. **Update**: Sets `isStale = true` and `staleAt = now()` on matched orders
3. **Batch processing**: Uses `updateMany` for efficiency
4. **Logging**: Comprehensive console logging for monitoring
5. **Error handling**: Try-catch with error logs

**Cron Schedule:**
- Runs daily at 9:00 AM (0 9 * * *)
- Async operation with proper error handling

**Function Logic:**
```typescript
async function checkStaleOrders() {
  try {
    const { prisma } = await import('./prisma');
    
    console.log('[SCHEDULER] Checking stale orders...');
    
    const now = new Date();
    const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);
    
    // Find PENDING orders older than 48 hours, not already marked stale
    const staleOrders = await prisma.order.findMany({
      where: {
        status: 'PENDING',
        updatedAt: { lt: fortyEightHoursAgo },
        isStale: false,
      },
    });
    
    // Batch update all stale orders
    if (staleOrders.length > 0) {
      const result = await prisma.order.updateMany({
        where: { id: { in: staleOrders.map((o) => o.id) } },
        data: { isStale: true, staleAt: now },
      });
      
      console.log(`[SCHEDULER] Marked ${result.count} orders as stale`);
    }
  } catch (err) {
    console.error('[SCHEDULER] Stale order check error:', err);
  }
}
```

### ✅ API Route Update

**File:** `app/api/admin/orders/[id]/route.ts` - PUT handler

When order status changes to anything other than PENDING:
- Automatically resets `isStale = false`
- Clears `staleAt = null`
- Preserves stale flag if status remains PENDING or is changed to PENDING

**Update Logic:**
```typescript
// If status is changing to something other than PENDING, reset stale flags
if (body.status && body.status !== 'PENDING') {
  updateData.isStale = false;
  updateData.staleAt = null;
}
```

### ✅ Admin Orders Page UI

**File:** `app/admin/orders/page.tsx`

**Yellow Warning Badge on Stale Orders:**

1. **Table Row Background**: Rows where `isStale = true` get:
   - Background: `bg-yellow-50` normally
   - Hover: `bg-yellow-100` for interactivity

2. **Badge Display**: Yellow ⚠️ badge appears next to order number:
   - Shows only when `isStale = true`
   - Styled as: `bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs font-semibold`
   - Text: "⚠️ Stale"

3. **Visual Hierarchy**:
   - Order number remains in primary color (blue)
   - Badge positioned right next to order number in same cell
   - Full row background also yellowed for emphasis

**Example Table Row:**
```
| SPF-00024 ⚠️ Stale | John Smith | 123 Main St... | INSTALL | PENDING | 5/22/2026 |
^ Order Number          ^ Realtor     ^ Address       ^ Type     ^ Status   ^ Date
  with warning badge
  Row background: yellow-50
```

### ✅ Admin Dashboard Update

**File:** `app/admin/page.tsx`

**Stale Orders Summary Card:**

1. **Location**: Added as 5th card in summary section
2. **Layout**: Grid changes from `md:grid-cols-4` → `lg:grid-cols-5`
   - Responsive: 1 column on mobile, 2 on tablet, 5 on desktop
3. **Styling**:
   - Background: `bg-yellow-50` (light yellow)
   - Border: `border-yellow-200` (yellow border for emphasis)
   - Label: `text-yellow-700` ("Stale Orders")
   - Count: `text-yellow-600` (bold, large)

**Card HTML:**
```jsx
<div className="bg-yellow-50 rounded-lg border border-yellow-200 p-6">
  <p className="text-sm font-medium text-yellow-700">Stale Orders</p>
  <p className="text-3xl font-bold text-yellow-600 mt-2">{stats.staleOrderCount}</p>
</div>
```

**Data Flow:**
1. Fetches all orders from `/api/admin/orders`
2. Filters where `(o as any).isStale === true`
3. Counts total stale orders
4. Displays count in summary card
5. Provides at-a-glance visibility of system health

### 📊 Stale Order Workflow Example

```
Day 0:  Order created, status = PENDING
        isStale = false, staleAt = null

Day 1:  Order unchanged
        No action by scheduler

Day 2 (9:00 AM): checkStaleOrders() runs
        ✅ updatedAt is 48+ hours old
        ✅ status = PENDING
        ✅ isStale = false
        → Sets isStale = true, staleAt = today
        → Yellow badge appears on /admin/orders table row
        → Stale Orders count increments on dashboard

Day 3:  Admin updates order status to SCHEDULED
        PUT /api/admin/orders/[id] called with status: 'SCHEDULED'
        ✅ isStale reset to false, staleAt = null
        → Yellow badge disappears
        → Stale Orders count decrements on dashboard
```

### ✅ Features Summary

✅ Query PENDING orders older than 48 hours
✅ Mark matched orders with isStale=true and staleAt timestamp
✅ Auto-reset isStale flag when status changes
✅ Yellow warning badge in /admin/orders table
✅ Row background highlighting for stale orders
✅ Stale Orders summary card on /admin dashboard
✅ Responsive grid layout for dashboard cards
✅ Comprehensive logging for monitoring
✅ Efficient batch database updates
✅ Error handling throughout

### ✅ Validation

- ✅ No TypeScript errors
- ✅ Migration applied cleanly
- ✅ Scheduler function properly structured
- ✅ API route logic correct
- ✅ UI components rendering without errors
- ✅ Responsive design maintained

**Status: ✅ STEP 13 COMPLETE**

## UI Summary - Where Stale Badge Appears

### 1. `/admin/orders` page
- **Table row**: Yellow background (`bg-yellow-50`)
- **Order number cell**: Shows "⚠️ Stale" badge in yellow
- **Example**: `SPF-00024 ⚠️ Stale` with yellow row highlight

### 2. `/admin` dashboard
- **Summary cards**: 5th card shows "Stale Orders" count
- **Styling**: Yellow background (`bg-yellow-50`) with yellow border
- **Placement**: Bottom-right of summary card grid (responsive)
- **Count**: Shows total number of stale orders at a glance
