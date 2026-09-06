# SignPost Field — Native iOS App

Native Swift/SwiftUI rewrite of the Realtor, Field Tech, and TC surfaces from the
`Rightsideup` Next.js app. Admin stays web-only. This app is a new client only —
it talks to the existing Next.js API at `app.northshoresignco.com/api/*`.

## Opening the project (on a Mac)

This repo is authored as source files + an [XcodeGen](https://github.com/yonaskolb/XcodeGen)
spec (`project.yml`) rather than a checked-in `.xcodeproj`, since Xcode project files don't
diff/merge well and this was scaffolded from a non-Mac environment.

```bash
brew install xcodegen
cd "IOS RightSignUp"
xcodegen generate
open SignPostField.xcodeproj
```

Then in Xcode: set your Development Team under Signing & Capabilities, and confirm the
"Push Notifications" and "Background Modes → Remote notifications" capabilities are enabled.

## Structure

- `SignPostField/App` — app entry point, `AppDelegate` (APNs registration), root navigation.
- `SignPostField/Core/Networking` — `APIClient`, endpoint definitions, Keychain token storage.
- `SignPostField/Core/Models` — Swift structs mirroring `Rightsideup/prisma/schema.prisma`.
- `SignPostField/Core/Auth` — login screen + `AuthManager` (mobile JWT session).
- `SignPostField/Core/Push` — APNs device registration.
- `SignPostField/Core/Offline` — SwiftData models + sync manager for the Field Tech offline queue.
- `SignPostField/Features/FieldTech` — jobs list, job detail/completion, offline photo queue.
- `SignPostField/Features/Realtor` — dashboard, new order, 811 tracker, invoices/payment, inventory.
- `SignPostField/Features/TC` — agent switcher, TC dashboard, pricing.
- `SignPostField/Shared` — notifications, idle timeout, design system tokens.

## Backend companion changes

The following were added/changed in `Rightsideup` to support this app (see that repo):

- `POST /api/auth/mobile-login` — issues a long-lived JWT for Keychain storage.
- `GET /api/auth/me` — rehydrates the session on cold launch from a stored JWT.
- `POST/DELETE /api/push/register-device` — registers/removes an APNs device token.
- `lib/apns.ts` — sends pushes via APNs HTTP/2; wired into `lib/notifications.ts`.
- `lib/mobile-auth.ts` — `getRequestUser()` accepts either the NextAuth session cookie (web)
  or an `Authorization: Bearer <token>` mobile JWT, so existing routes serve both clients.
- `prisma/schema.prisma` — added the `DeviceToken` model.
- `app/mobile-payment/page.tsx` — minimal page embedding FluidPay's Tokenizer widget for the
  iOS payment screen's `WKWebView` (see `Features/Realtor/PaymentWebView.swift`); posts the
  charge result back to native via a `window.webkit.messageHandlers.paymentBridge` bridge.
- Migrated the routes this app calls from cookie-only `auth()` to `getRequestUser()`:
  `orders` (list/detail/create/cancel), `invoices` (list/detail), `realtor/811` (list/detail/create),
  `tc/agents`, `tc/pricing`, `tc/linked-tcs`, `signs/mine`, `payments/charge`, `payments/card-on-file`.
  Remaining write-heavy routes (order photos/coupons, invoice pay/pdf/schedules, tc invites/links,
  sign reorder/pickup) still use the web-only session and should be migrated the same way as the
  app grows past this initial scaffold — this is the PRD's "API response consistency check" item.

Required env vars on the backend: `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_PRIVATE_KEY`,
`APNS_BUNDLE_ID`, `APNS_ENVIRONMENT` (`sandbox` | `production`).

## What's implemented in this scaffold

- **Field Tech**: login, today's jobs (with offline cache), job detail, Apple Maps handoff,
  photo capture + completion (with offline queue via SwiftData/`OfflineSyncManager`), flag issue.
- **Realtor**: dashboard, orders list/detail (+ cancel), 811 tracker with native stage stepper,
  invoices list/detail, in-app payment via the `WKWebView` tokenizer bridge, sign inventory grid.
- **TC**: agent switcher (client-side, scopes orders/invoices/pricing via `realtorId`/query params),
  TC dashboard, pricing with Swift Charts + native share sheet.
- **Shared**: push notifications end-to-end, notification center, idle timeout, role-based root
  navigation, deep-link routing from push payloads.

Not yet built (left for follow-up): New Order flow (address autocomplete, sign/add-on picker),
account/profile editing, TC agent invite flow, Face ID/Touch ID unlock, TestFlight/App Store assets.

## Build order

1. Field Tech surface (login → jobs → completion + offline queue) — highest native value.
2. Push notifications end-to-end.
3. Realtor surface (dashboard, new order, 811 tracker, invoices/payment, inventory).
4. TC surface (agent switcher, dashboard, pricing).
5. TestFlight beta, then App Store submission.
