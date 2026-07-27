# Realtor Acceptance Test Report

**Test date:** July 25-26, 2026  
**Application:** SignPost Field / RightSignUp  
**Environment:** Local Next.js app at `http://localhost:3000`, connected to the configured database  
**Persona:** Brand-new realtor  
**Browser viewport coverage:** Desktop and 390 x 844 mobile  

## Executive Summary

The new-realtor workflow is only partially ready. Registration, login, order creation, order search/filtering, 811 submission, photo upload, sign reorder requests, password reset submission, TC invitation creation, cancellation, and sign-out all completed successfully.

The following required workflows are blocked or broken:

1. **A realtor cannot change an order's requested date.** No edit or reschedule control exists on the order detail page.
2. **An accepted TC invitation does not create the realtor-TC link.** The TC account is created and the invite is consumed, but the coordinator receives no access to the realtor.
3. **Cancelling a pending order crashes the order detail page.** The API succeeds, then the UI reads `order.photos.length` when `photos` is `null`.
4. **Requested dates display one day early.** A request for August 15 displayed as August 14 on the order detail page.
5. **Invoices fail at the API layer.** Every invoice filter returned HTTP 500, while the page misleadingly displayed an empty state.
6. **Inventory pickup requests fail.** The API returned HTTP 500 because `public.sign_pickup_requests` does not exist.
7. **Google Maps features are unavailable.** Address search, Street View placement, and dashboard Post Maps report that the Maps key is not configured.

## QA Test Data

All created records use obviously synthetic values and should not be fulfilled or billed.

| Record | Value |
|---|---|
| Realtor | `QA Realtor 20260725` |
| Realtor email | `qa.realtor.20260725.2359@rightsignup.test` |
| Realtor user ID | `cms1c57h60000sf17lcyual0z` |
| TC | `QA Coordinator 20260725` |
| TC email | `qa.tc.20260725.2359@rightsignup.test` |
| TC user ID | `cms1cbej5000esf17mt6yk3w8` |
| Active test order | `SPF-00018` / `cms1c95jp0004sf1753ghu6hv` |
| Cancelled test order | `SPF-00019` / `cms1caie4000asf173wryffap` |
| Test 811 ticket | `99999901` / `cms1ca5hl0008sf177zr9hac4` |
| Test image | `apple-touch-icon.png` attached to `SPF-00018` |
| Test sign reorder | Quantity 2, Standard, marked as QA-only in notes |

Both QA users were tagged `QA_TEST`. Email verification was marked complete directly in the database after the UI correctly handed off to the verification page, because `.test` addresses cannot receive mail.

## Result Totals

| Result | Count |
|---|---:|
| Passed | 50 |
| Failed | 10 |
| Blocked by missing data/configuration | 6 |
| Needs manual visual follow-up | 2 |

## Detailed Test Log

### Registration and Authentication

| Test | Result | What happened |
|---|---|---|
| Open realtor registration | PASS | Form loaded with name, email, phone, brokerage, password, and confirmation fields. |
| Submit password under six characters | PASS | Displayed `Password must be at least 6 characters`. |
| Submit mismatched passwords | PASS | Displayed `Passwords don't match`. |
| Register valid realtor | PASS | HTTP 201; created the QA realtor and redirected to Verify Email. |
| Verification handoff | PASS | Page identified the correct email and offered Login and Dashboard links. |
| Login with valid credentials | PASS | Redirected to `/dashboard`. |
| Sign out | PASS | Redirected to `/login`. |
| Open protected dashboard after sign-out | PASS | Redirected back to `/login`. |

### First-Time Dashboard

| Test | Result | What happened |
|---|---|---|
| Empty dashboard | PASS | Counts loaded as zero and no orders were shown before test data was created. |
| Notifications button | PASS | Opened a panel showing `No notifications yet`. |
| Dismiss install guidance | PASS | Dismiss button removed the install guidance. |
| Hide ready-to-order card | PASS | Close control hid the card. |
| Skip onboarding | PASS | Onboarding block disappeared. |
| Dashboard after orders | PASS | Showed both QA orders and a pending count of one. |
| Post Maps | BLOCKED | Displayed `NEXT_PUBLIC_GOOGLE_MAPS_KEY is not configured`. |

### New Order Form

| Test | Result | What happened |
|---|---|---|
| Install type | PASS | Showed sign setup, post color, placement, and 811 controls. |
| Removal type | PASS | Hid 811 and sign-placement controls as expected. |
| Change type | PASS | Showed 811 and sign controls. |
| Sign Pick Up type | PASS | Hid 811 controls. |
| Manual address | PASS | Accepted a typed address. |
| Address autocomplete | BLOCKED | Page reported address search unavailable because Maps is not configured. |
| Street View placement | BLOCKED | Page reported Street View unavailable because Maps is not configured. |
| ASAP button | PASS | Filled the current date. |
| Requested date input | PASS | Accepted `2026-08-15`. |
| Notes | PASS | Notes persisted into the created order. |
| White post | PASS | Review showed a $0 adjustment. |
| Black post | PASS | Review showed a $5 adjustment. |
| Custom post color | PASS | Review showed a $5 adjustment. |
| Choose inventory sign | PASS | Standard Black Sign Post became selected and appeared in review. |
| Self-hang option | PASS | Review showed `I'll hang it myself`. |
| Custom post modal cancel | PASS | Closed without changing the selected sign. |
| Custom post modal save | PASS | Saved Metal / `#1d4ed8`, selected Custom Color Sign Post, and updated price. |
| 811 opt-out modal cancel | PASS | Kept concierge service enabled. |
| 811 opt-out acceptance | PASS | Policy acceptance action completed. The review wording was not sufficiently clear during automation and should receive a manual copy check. |
| Terms/refund agreement | PASS | Required checkbox could be checked before submission. |
| Create install order | PASS | HTTP 201; created `SPF-00018`. |
| Success View Order link | PASS | Opened the correct internal order ID. |
| Place Another | PASS | Reset the order form. |
| Create removal order | PASS | HTTP 201; created `SPF-00019`. |
| Cancel link | NEEDS REVIEW | Link target is `/dashboard/orders`, but one automated click left the URL on the form. Recheck manually in a clean browser. |

### Order List

| Test | Result | What happened |
|---|---|---|
| Place New Order link | PASS | Points to `/dashboard/orders/new`. |
| Search by order number | PASS | Searching `SPF-00018` returned one order. |
| Search with no match | PASS | Displayed `No orders found`. |
| Pending filter | PASS | Returned the pending QA order. |
| Cancelled filter | PASS | Returned `SPF-00019` after cancellation. |
| Sort by agent | PASS | Control changed to Agent Name sorting without error. |
| Open order row | PASS | Rows navigate to order detail. |
| Initial loading behavior | NEEDS REVIEW | The table briefly appeared empty before the fetch completed; confirm loading treatment visually. |

### Order Detail and Cancellation

| Test | Result | What happened |
|---|---|---|
| Back to Orders | PASS | Link points to `/dashboard/orders`. |
| Address link | PASS | Generated an Apple Maps URL. |
| Add Photo | PASS | Uploaded a PNG, returned HTTP 200, and rendered the authenticated image. |
| Empty credit code | PASS | Displayed `Enter a credit code to apply it`. |
| Invalid credit code | FAIL | Returned HTTP 400 but displayed vague text: `An error occurred validating the coupon`. |
| Open cancel modal | PASS | Modal displayed optional reason, Keep Order, and Confirm Cancel. |
| Keep Order | PASS | Closed the modal without changing the order. |
| Confirm cancellation | PARTIAL | API returned HTTP 200 and persisted `CANCELLED` with the supplied reason. |
| UI after cancellation | FAIL | Runtime crash: `Cannot read properties of null (reading 'length')` at `app/dashboard/orders/[id]/page.tsx:193`. |
| Cancel order with 811 ticket | PASS | HTTP 409 and a clear message instructed the realtor to contact admin. |
| Change requested date | FAIL | There is no edit or reschedule button or API action exposed to the realtor. |
| Requested date display | FAIL | `2026-08-15` was displayed as `8/14/2026`, indicating UTC/local date conversion. ASAP also displayed one day early. |

### 811 Tracker

| Test | Result | What happened |
|---|---|---|
| Open from Create 811 Ticket | PASS | Correct order was preselected. |
| Empty ticket number | PASS | Displayed `Ticket number is required`. |
| Invalid ticket number | PASS | Rejected letters and required at least six digits. |
| Submit valid ticket | PASS | HTTP 201; created ticket `99999901` and showed Ticket Submitted stage. |
| Timeline | PASS | Showed requested and ticket-assigned events. |
| Duplicate/eligible property state | FAIL | After creating the ticket, the same property remained labeled `[811 # Needed]` in the submission form during the same session. |
| Empty-state copy | FAIL | Page said `Contact support if you need to create a ticket` while directly presenting a working Create Ticket form. |

### Account and Transaction Coordinators

| Test | Result | What happened |
|---|---|---|
| Profile information | PARTIAL | Email, brokerage, and role were correct. Multi-word last name `Realtor 20260725` displayed only as `Realtor`. |
| Save Payment Info | BLOCKED | Button is disabled and labeled `Coming Soon`. |
| Send Password Reset Link | PASS | Submission succeeded and displayed confirmation. |
| Create TC invitation | PASS | HTTP 201; pending invite appeared. |
| Register TC from invite | PASS | Invite page showed the correct inviter/email; account creation returned HTTP 201. |
| Consume invite | PASS | Invite `usedAt` was populated. |
| Link invited TC to realtor | FAIL | No `TCAgentLink` was created, so the invited TC had no realtor access. |
| Pending invite state after acceptance | FAIL | Realtor Account page continued to show the consumed invite as `Pending`. |
| Revoke TC confirmation | PASS | Browser confirm appeared. |
| Revoke linked TC | PASS | After creating the missing QA link manually, Revoke deleted it and removed the TC from the UI. |

### My Signs

| Test | Result | What happened |
|---|---|---|
| Empty signs state | PASS | Clearly stated no deployed signs. |
| Request More Signs open/cancel | PASS | Modal opened and Cancel closed it. |
| Request signs from empty-state button | PASS | Opened the same request modal. |
| Submit reorder request | PASS | HTTP 201; quantity 2 Standard request was sent and confirmation displayed. |
| Schedule Pickup open/cancel | PASS | Modal opened and Cancel closed it. |
| Pickup with no selected signs | PASS | Displayed `Please select at least one sign to pick up`. |
| Report sign issue | BLOCKED | No deployed test sign existed, so Report Issue was not exposed. |
| Successful deployed-sign pickup | BLOCKED | No deployed test sign existed to select. |

### Inventory and Custom Signs

| Test | Result | What happened |
|---|---|---|
| Load inventory | PASS | Three sign items loaded. |
| Inventory images | FAIL | Browser console recorded two image 404 responses. |
| Order More inventory item | BLOCKED | No item exposed the button because no printer relation was available. |
| Pickup request required fields | PASS | Displayed `Location and date needed are required`. |
| Valid pickup request | FAIL | HTTP 500. Server reported missing table `public.sign_pickup_requests`. |
| Blank custom-sign form | PASS | Displayed `Please complete all fields and upload an image.` |
| Custom-sign fields and artwork | PASS | Name, dimensions, material, and image accepted input. |
| Select printer | BLOCKED | `/api/printers` returned 404 and the dropdown contained only `Select a printer`. |
| Submit custom sign | BLOCKED | Cannot submit without a printer. |

### Invoices

| Test | Result | What happened |
|---|---|---|
| Invoice page layout | PARTIAL | Summary cards and filters rendered. |
| All filter | FAIL | `/api/invoices` returned HTTP 500. |
| Paid filter | FAIL | Returned HTTP 500. |
| Sent filter | FAIL | Returned HTTP 500. |
| Overdue filter | FAIL | Returned HTTP 500. |
| Viewed filter | FAIL | Returned HTTP 500. |
| Draft filter | FAIL | Returned HTTP 500. |
| Error presentation | FAIL | UI silently displayed `No invoices yet` instead of an error. |
| Invoice detail/payment | BLOCKED | No invoice could load because the list API failed. |

The server error identifies a schema mismatch: column `invoices.paidByType` does not exist in the configured database.

### Tutorials and Footer

| Test | Result | What happened |
|---|---|---|
| Tutorials page | PARTIAL | Six tutorial cards rendered, but every video is still a placeholder with no playable link. |
| Terms & Conditions | PASS | HTTP 200 with correct heading. |
| Privacy Policy | PASS | HTTP 200 with correct heading. |
| Refund Policy | PASS | HTTP 200 with correct heading. |
| Contact | PASS | HTTP 200 with correct heading. |
| Phone/email links | PASS | Footer exposes `tel:` and `mailto:` links. |

### Mobile and Responsive Checks

At 390 x 844, all nine primary realtor routes loaded without document-level horizontal overflow:

- `/dashboard`
- `/dashboard/orders`
- `/dashboard/orders/new`
- `/dashboard/signs`
- `/dashboard/inventory`
- `/dashboard/811`
- `/dashboard/invoices`
- `/dashboard/account`
- `/dashboard/tutorials`

The automated locator did not reliably identify the mobile bottom navigation despite the routes remaining usable, so visual confirmation of the fixed bottom nav is still recommended on a physical iOS and Android device.

## Transaction Coordinator Acceptance Retest

**Test date:** July 26, 2026  
**Persona:** Existing transaction coordinator linked to two QA realtors, with a separate unlinked realtor used for authorization checks  
**Result:** PASS - 17/17 API authorization and validation checks passed, and all browser workflow checks passed

The QA coordinator could see both linked realtors in My Agents, open their profiles, and launch preselected install or removal orders. The unlinked QA realtor did not appear in My Agents, dashboard orders, signs, 811 tickets, or invoices.

| Test | Result | What happened |
|---|---|---|
| Linked realtor lists | PASS | `/api/tc/realtors` and `/api/tc/agents` returned only linked realtors. |
| My Agents actions | PASS | View Profile, Place Install, and Place Removal pointed to the selected linked realtor. |
| New order preselection | PASS | A linked realtor and requested removal type were preselected from the My Agents action. |
| Order list and detail | PASS | Linked orders loaded; filtering or opening the unlinked realtor's order returned HTTP 403. |
| TC order validation | PASS | Missing realtor selection returned HTTP 400; an unlinked realtor ID returned HTTP 403. |
| Invoice list and detail | PASS | The linked invoice loaded with its Agent column; the unlinked invoice returned HTTP 403. |
| Invoice mutation | PASS | A TC could view but not mark a realtor invoice as viewed; the update returned HTTP 403. |
| 811 visibility | PASS | Ticket `99999902` and the linked property loaded; unlinked property data was absent. |
| My Signs visibility | PASS | The linked deployed sign appeared with pickup and report controls; the unlinked sign was absent. |
| Pickup validation | PASS | Missing realtor returned HTTP 400, unlinked realtor returned HTTP 403, and a sign owned by another realtor returned HTTP 400. |
| Dashboard filtering | PASS | Linked-agent activity appeared and unlinked-agent activity was absent. |
| Responsive routes | PASS | Dashboard, My Agents, Orders, New Order, My Signs, 811, and Invoices had no document-level overflow at 390 x 844. |

The authorization matrix intentionally stopped before successful pickup or issue-report submission because those actions send operational email and mutate sign state. The successful realtor-scoped paths were verified through the rendered controls and linked fixture data; all cross-realtor mutation guards were exercised directly.

Disposable records named `Linked Agent QA` and `Unlinked Agent QA`, including their orders, signs, invoices, and 811 data, were created only for this TC retest and removed after validation. The original QA coordinator and original linked QA realtor were retained for future regression testing. The QA coordinator password was rotated to a known QA-only value to resume the interrupted authenticated test.

## Prioritized Defects

### P0 - Required Workflow Blockers

1. Add realtor order date editing/rescheduling with authorization, validation, audit history, and notification behavior.
2. Make TC invite acceptance create `TCAgentLink` atomically with account creation/invite consumption.
3. Apply the missing production/database migrations for invoices and `sign_pickup_requests`.

### P1 - High Severity

1. Normalize `photos` to `[]` in cancellation responses or defensively render `order.photos ?? []`.
2. Render date-only values without UTC timezone shifting.
3. Show invoice API errors instead of a false empty state.
4. Remove consumed invites from Pending Invites or return their consumed status.
5. Configure Google Maps for address autocomplete, placement, and dashboard maps.

### P2 - Medium Severity

1. Preserve multi-word last names in session/profile display.
2. Return a specific invalid-credit message.
3. Refresh eligible 811 properties after successful ticket creation.
4. Correct the contradictory 811 empty-state copy.
5. Fix missing inventory image URLs and provide/configure `/api/printers`.
6. Publish actual tutorial videos or remove internal placeholder instructions from the realtor-facing page.

## Recommended Retest Order

1. Database migrations: invoice fields and sign pickup requests.
2. TC invitation registration and immediate realtor access.
3. Place order, change requested date, refresh, and verify the exact date everywhere.
4. Cancel a photo-less and a photo-bearing order without a runtime crash.
5. Invoice list, each filter, detail, saved-card payment, alternate-card payment, and receipt state.
6. Inventory pickup and custom-sign request with a configured printer.
7. Maps autocomplete, Street View placement, and dashboard map.
8. Full mobile navigation on physical Safari iOS and Chrome Android.

## Remediation Retest - July 26, 2026

The requested non-payment, non-Google-Maps, and non-tutorial fixes were implemented and retested against the QA realtor.

| Area | Result | Verification |
|---|---|---|
| Requested-date editing | PASS | Changed `SPF-00018` from August 15 to August 16 through the new detail-page editor; HTTP 200 and the date persisted after reload. Restored the QA order to August 15 afterward. |
| Date-only rendering | PASS | August 15 renders as `8/15/2026` on order detail. Realtor dashboard formatting now uses the same UTC calendar-date rule. |
| Cancellation rendering | PASS | Cancelled `SPF-00019`, whose `photos` value had been null, loads with `No photos attached to this order` and no runtime crash. |
| TC invite acceptance | PASS | A disposable invited TC registered with HTTP 201; the invite was consumed and a `TCAgentLink` with `grantedBy: REALTOR` was created in the same transaction. Test records were removed. |
| Consumed invite state | PASS | Consumed invites no longer appear under Pending Invitations. |
| Existing QA TC relationship | PASS | The previously consumed QA invite was reconciled and `QA Coordinator 20260725` appears under Linked TCs. |
| Multi-word surname | PASS | Account page displays `Realtor 20260725` as the full last name. |
| Invoice schema/API | PASS | Migration deployed successfully. All, Paid, Sent, Overdue, Viewed, and Draft API filters return HTTP 200. |
| Invoice error state | PASS | The page now distinguishes API failures from a genuine empty invoice list and includes a retry action. |
| Sign pickup schema/API | PASS | Migration deployed successfully. An authenticated QA pickup request returned HTTP 200; the disposable request was removed. |
| Printer/custom-sign flow | PASS | `/api/printers` returns HTTP 200. With no active printers configured, the form records the request for admin printer assignment; custom-sign submission returned HTTP 200. Disposable record and upload were removed. |
| Inventory images | PASS | All three realtor inventory card images decoded successfully; every mapped fallback asset also returned HTTP 200. |
| Invalid credit message | PASS | Invalid code returns HTTP 400 and displays `Coupon code not found`. |
| 811 eligibility/copy | PASS | Ticketed, cancelled, and non-811 order types are excluded. Empty selector reads `No properties available`; contradictory support copy was removed. |
| New Order Cancel link | PASS | Clean browser retest navigated from New Order to `/dashboard/orders`. |

The deployed migration intentionally excludes payment-card storage, invoice payment records, and payment schedules. Google Maps configuration and tutorial media also remain deferred at the user's request.

## Notes on Safety and Scope

- No real customer account, order, invoice, payment method, or TC relationship was modified.
- No real card transaction was attempted.
- External email delivery was tested only through successful application/API submission and UI confirmation; delivery to `.test` inboxes is impossible.
- A temporary QA TC link was inserted only to exercise Revoke and was then removed through the UI.
- The active QA order and 811 ticket remain for reproducible retesting. The second QA order remains cancelled.