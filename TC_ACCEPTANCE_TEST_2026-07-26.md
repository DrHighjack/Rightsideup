# Transaction Coordinator Acceptance Test Report

**Test date:** July 26, 2026  
**Application:** SignPost Field / RightSignUp  
**Environment:** Local Next.js app at `http://localhost:3000`, connected to the configured database  
**Persona:** Transaction coordinator managing multiple linked realtors  
**Browser coverage:** Desktop; responsive surfaces inspected, with final true-device mobile verification still recommended

## Executive Summary

The transaction coordinator workflow passed its primary linked-agent operations and cross-agent isolation checks after remediation. The QA TC could list linked realtors, switch agent context, create and manage a linked-agent order, upload a photo, submit an 811 ticket, view linked invoices without payment access, and use linked-agent sign workflows. Direct access to unlinked orders, invoices, signs, pickups, and agent context was denied.

Security fixes completed during this pass include linked-agent invoice visibility, read-only TC billing, selected-agent order filtering, TC cancellation authorization, sign-report ownership enforcement, server-side 811 eligibility, protected legacy `/tc/*` routes, admin-only 811 detail and global inventory APIs, and prevention of unilateral links to existing realtor accounts.

Payment implementation, Google Maps configuration, and tutorial content remain intentionally deferred. Password-reset completion remains a separate product gap.

## QA Test Data

| Record | Value |
|---|---|
| QA TC | `QA Coordinator 20260725` / `qa.tc.20260725.2359@rightsignup.test` |
| TC user ID | `cms1cbej5000esf17mt6yk3w8` |
| Baseline linked realtor | `QA Realtor 20260725` |
| Disposable linked realtor | `Linked Agent QA` / `qa.tc-linked-agent.20260726@rightsignup.test` |
| Disposable unlinked realtor | `Unlinked Agent QA` / `qa.tc-unlinked-agent.20260726@rightsignup.test` |
| Linked isolation order | `TCQA-LINKED-20260726` |
| Unlinked isolation order | `TCQA-UNLINKED-20260726` |
| TC-created lifecycle order | `SPF-00004` |
| Linked invoice | `TCQA-INV-LINKED-20260726` |
| Unlinked invoice | `TCQA-INV-UNLINKED-20260726` |
| Created 811 ticket | `99999902` |
| Linked sign fixture | `TCQA-SIGN-LINKED-20260726` |
| Unlinked sign fixture | `TCQA-SIGN-UNLINKED-20260726` |

Disposable linked/unlinked fixtures were removed after testing. The baseline QA TC, realtor, and link were preserved.

## Result Totals

| Result | Count |
|---|---:|
| Passed | 34 |
| Failed and fixed | 9 |
| Deferred by request | 3 |
| Manual follow-up recommended | 2 |

## Detailed Test Log

### Authentication and Access Boundaries

| Test | Result | What happened |
|---|---|---|
| TC credentials login | PASS | Authenticated as the QA TC and loaded TC-capable dashboard routes. |
| Signed-out `/tc/*` access | PASS | `/tc/select-agent` and `/tc/dashboard` returned 307 redirects to `/login`. |
| TC access to `/admin` | PASS | Redirected to `/dashboard`; direct protected admin API calls returned 403. |
| Unlinked agent context | PASS | `/api/tc/set-agent` rejected an unlinked realtor with 403. |
| Legacy `/tc` middleware | FIXED | Added `/tc/:path*` authentication and TC-role enforcement. |

### My Agents and Agent Context

| Test | Result | What happened |
|---|---|---|
| Linked-agent list | PASS | Returned only the two linked QA realtors during the fixture test. |
| Linked profile | PASS | Profile route returned linked realtor details. |
| Unlinked profile/context | PASS | Direct unlinked access was denied. |
| Existing linked Add Realtor | PASS | Returns 409 without creating a duplicate link. |
| Existing unlinked Add Realtor | FIXED | Now returns 409 requiring realtor approval instead of granting immediate access from email knowledge alone. |
| Malformed invite email | FIXED | Server now returns 400 for invalid email syntax. |
| Legacy selected-agent dashboard | FIXED | Selected Linked Agent QA originally showed orders from both linked agents; it now filters by validated `realtorId`. |
| Switch Agent | PASS | Clears `tc_active_agent` and returns to the selector. |

### Orders

| Test | Result | What happened |
|---|---|---|
| Aggregate linked orders | PASS | Shared dashboard returned orders for linked agents only. |
| Explicit linked-agent filter | PASS | Returned 200 with only the selected realtor's orders. |
| Explicit unlinked-agent filter | PASS | Returned 403. |
| Linked detail | PASS | Returned 200. |
| Unlinked detail/update/photo/cancel | PASS | Each operation returned 403. |
| TC order creation | PASS | Created `SPF-00004` for the selected realtor with the TC recorded in `placedByTCId`. |
| Requested-date display/update | PASS | Displayed the intended date and persisted a date change without a one-day shift. |
| Photo upload | PASS | PNG upload returned 200 and rendered on the order detail page. |
| Linked pending cancellation | PASS | Returned 200 and rendered the cancelled state. |
| TC cancel authorization | FIXED | Cancellation now requires a current TC-agent link and pending status. |
| Generic order role guard | FIXED | Generic order creation now permits only REALTOR and TC; cancellation permits only ADMIN, REALTOR, and TC. |

### 811 Tracker

| Test | Result | What happened |
|---|---|---|
| Linked ticket list | PASS | Tickets for linked agents were visible. |
| Eligible-property grouping | PASS | Eligible orders were grouped under the owning linked realtor. |
| Already-ticketed property exclusion | PASS | Existing ticket properties did not remain selectable. |
| Unlinked property exclusion | PASS | Unlinked realtor property was absent. |
| Ticket number validation | PASS | Invalid text produced a specific six-digit/numeric validation message. |
| Ticket creation | PASS | Ticket `99999902` returned 201 and appeared immediately. |
| Direct ineligible-order POST | FIXED | API now enforces INSTALL/CHANGE, active status, opt-out, and existing-ticket rules with 409. |
| Admin 811 detail authorization | FIXED | GET and PUT now require ADMIN before database access or body parsing. |

### Signs and Inventory

| Test | Result | What happened |
|---|---|---|
| Linked signs | PASS | Linked deployed sign was visible when a linked context was selected. |
| Unlinked sign isolation | PASS | Unlinked fixture was absent; direct list and pickup calls returned 403. |
| Linked pickup validation | PASS | Required a selected sign and date; server validates link and sign ownership. |
| Sign report ownership | FIXED | Reports now derive the owner from the assigned order/realtor and require ownership or a current TC link. |
| Global physical inventory | FIXED | Legacy `/api/inventory` is now ADMIN-only. |
| My Signs startup requests | FIXED | Sign loading now waits for session resolution instead of issuing unscoped TC requests during hydration. |
| Final linked-sign retest | NEEDS REVIEW | Disposable Linked Agent link had already been cleaned up, so the final post-cleanup browser could not repeat this fixture-specific request capture. TypeScript and production build passed. |

### Invoices

| Test | Result | What happened |
|---|---|---|
| Linked invoice list | FIXED | TC invoice list now resolves all linked realtor IDs and includes owner attribution. |
| Unlinked invoice isolation | PASS | Unlinked invoice was absent from the list and detail returned 403. |
| Linked invoice detail | PASS | Returned 200. |
| TC payment UI | FIXED | Sent invoice now shows `Agent Payment Required`; no Pay Invoice button or tokenizer is rendered. |
| Payment network boundary | PASS | Final capture showed zero `/api/payments` and tokenizer requests for the TC. |
| Direct invoice mutation/payment | FIXED | TC PUT and pay calls return 403; payment route is owner/admin-only and validates payable status. |

### Account and Responsive Checks

| Test | Result | What happened |
|---|---|---|
| Account identity | PASS | TC name, email, and role rendered correctly. |
| Password-reset request | PASS | Request endpoint is available; full reset completion is deferred. |
| Desktop route overflow | PASS | Core TC dashboard routes showed no document-level overflow in browser checks. |
| True mobile device pass | NEEDS REVIEW | Browser adapter did not consistently expose the requested CSS viewport; manual 390 x 844 verification is recommended. |

## Prioritized Defects

### Resolved During This Pass

1. TC invoices were invisible because APIs filtered by the TC user ID.
2. Linked invoice detail denied access, then exposed payment controls after access was added.
3. TC cancellation lacked an explicit link check.
4. Legacy selected-agent dashboard leaked orders from other linked agents.
5. Sign issue reports lacked owner/link authorization.
6. Existing-realtor Add Realtor could create an immediate authorization link without consent.
7. Admin 811 detail APIs lacked role authorization.
8. Server-side 811 creation trusted UI-only eligibility filters.
9. Legacy global inventory exposed physical sign IDs and locations to authenticated non-admin users.

### Remaining Product Gaps

1. Password-reset links use process-local storage and no complete reset-password workflow exists.
2. Existing realtors need a dedicated authenticated accept/deny flow for TC access requests; current behavior securely blocks unilateral linking.
3. Mobile sign-out and final true-device responsive verification should be completed in a later UI pass.

## Validation

| Check | Result |
|---|---|
| Focused TypeScript checks after edits | PASS |
| `npx.cmd tsc --noEmit` final check | PASS |
| `npm.cmd run build` | PASS after stopping the local dev process that held Prisma's Windows DLL lock |
| Browser linked/unlinked authorization checks | PASS |
| Production data cleanup | PASS for disposable TC acceptance fixtures |

The repeated 500 responses containing `Expected property name or '}' in JSON` came from an early QA harness that sent JavaScript object notation rather than valid JSON. Correctly encoded follow-up requests reached route validation and returned the expected 400/403 statuses; these were test-harness failures, not normal UI request failures.

The recurring Sentry/OpenTelemetry `require-in-the-middle` messages are build warnings. The missing IMAP configuration affects the optional scheduled 811 email poller and is not a TC authorization failure.

## Deferred Scope

- Payment implementation and live charging
- Google Maps and Street View configuration
- Tutorial content production
