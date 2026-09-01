---
name: rightsideup-api-operations
description: "Use when operating, administering, or changing data in the Rightsideup / North Shore Sign Co portal through its Next.js API: orders, clients, brokerages, TCs, field jobs, signs, inventory, invoices, payments, 811 tickets, Smart Sign, pricing, settings, notifications, reports, or scheduled billing. Provides exact route discovery, authorization checks, mutation safety, and verification steps for actions performed on the user's behalf."
argument-hint: "Describe the operational outcome, e.g. 'provision a Smart Sign post' or 'update an invoice'"
user-invocable: true
disable-model-invocation: false
---

# Rightsideup API Operations

Use this skill before acting on behalf of an operator in this workspace. It maps the internal API surface and establishes a safe workflow for reads, updates, production data changes, and verification.

## Operating Rules

1. Start by identifying the domain and intended outcome, not an endpoint name.
2. Run [API inventory](./scripts/inventory-api.sh) for the current route/method map, then read the exact handler before calling or reproducing its behavior.
3. Treat all `POST`, `PUT`, `PATCH`, and `DELETE` endpoints as state-changing. Confirm the caller role, payload schema, ownership checks, and side effects first.
4. Do not call protected cron routes manually except when the requested operational outcome explicitly requires it. Cron routes can charge cards, create statements, or send email.
5. For production data work, query the exact target records first; use an atomic transaction where multiple related records must change; read back the exact affected records afterward.
6. Never expose passwords, API keys, tokens, webhook URLs, card details, or decrypted settings in output.
7. Never invent identifiers. Resolve them from the database or route response.
8. Preserve current public behavior when working around an API: prefer the owning internal function or route logic over writing direct database updates that bypass authorization or side effects.

## Authentication and Roles

Authentication is NextAuth JWT via `auth()` in `lib/auth.ts`. Roles are:

- `ADMIN`: full back-office operations.
- `REALTOR`: own orders, invoices, signs, account, Smart Sign.
- `TC`: linked-realtor operations via `TCAgentLink`.
- `BROKERAGE`: office billing, members, consolidated statements; shared accountants use the `SHARED_ACCOUNTANT` tag.
- `FIELD_TECH`: assigned jobs only.
- `SALESMEN`: sales/client and scoped order operations.

Primary route families are role-scoped, but always inspect the individual handler because ownership constraints vary.

## API Families

Read [API catalog](./references/api-catalog.md) for the current high-level capability map. The most important families are:

| Goal | Route family | Typical actor |
|---|---|---|
| Manage orders and create realtor/TC orders | `/api/orders`, `/api/admin/orders`, `/api/salesmen/orders` | REALTOR, TC, ADMIN, SALESMEN |
| Manage office clients, TCs, brokerages | `/api/admin/users`, `/api/admin/tcs`, `/api/admin/brokerages` | ADMIN |
| Work assigned installs and field issues | `/api/field/jobs` | FIELD_TECH, ADMIN |
| Inventory, deployed posts, reports, reorders | `/api/admin/signs`, `/api/signs` | ADMIN, REALTOR, TC |
| Create/send/pay invoices and payments | `/api/admin/invoices`, `/api/invoices`, `/api/payments` | ADMIN, payer/authorized TC |
| Brokerage statements and auto-pay | `/api/brokerage/statements`, `/api/brokerage/auto-pay` | BROKERAGE |
| Smart Sign tag, dashboard, public tap flow | `/api/admin/smart-sign`, `/api/smart-sign`, `/s/[tagCode]` | ADMIN, REALTOR, public |
| Pricing and city area pricing | `/api/admin/pricing`, `/api/admin/pricing/areas`, `/api/pricing/area` | ADMIN, authenticated preview |
| Configuration and system integrations | `/api/admin/settings`, cron routes | ADMIN, CRON_SECRET |

## Standard Procedure

### Read or investigate

1. Identify the API family from the catalog.
2. Inspect the handler:
   ```bash
   sed -n '1,260p' app/api/<route>/route.ts
   ```
3. If the question is about source-of-truth production data, query only the fields needed through Prisma using the repository `.env`.
4. Report the records found, authorization constraints, and proposed action before mutations that have financial, notification, access, or deletion effects.

### Perform a mutation

1. Read request validation (`zod` schema or manual checks), role guard, and related side effects.
2. Determine whether the existing API route should be used, or whether a guarded Prisma transaction is more appropriate for an operator-authorized production bulk change.
3. Resolve exact IDs and assert expected record counts/names before changing anything.
4. For multi-record changes, enforce the expected count inside one `prisma.$transaction`.
5. Re-read the target records after mutation. Verify no other records changed.
6. If the code changed, run a focused typecheck/build before deploy; deploy the exact commit, then verify the production deployment and data state.

### Payment and billing operations

- Never manually trigger `/api/cron/brokerage-auto-pay`, `/api/cron/brokerage-statements`, or `/api/cron/smart-sign` for exploratory purposes.
- Saved payment method IDs are safe identifiers; raw card data and FluidPay credentials are not.
- A statement/invoice payment must preserve the existing optimistic-lock and balance validation flow. Prefer the existing payment service/route.
- Draft invoices are not outstanding. Check status before reading or changing balances.

### Smart Sign operations

- Provision only through `/api/admin/smart-sign` or its backing `lib/smart-sign.ts` workflow so the post/tag relationship remains one-to-one and an assigned agent receives their trial.
- Public `/s/[tagCode]` is intentionally unauthenticated. Do not add lead capture, PII, IP logging, cookies, or passive geolocation without an explicit new compliance-approved request.
- Tap events are anonymous. Location is optional and only stored after user action/permission.

## Exact Route Discovery

Run the inventory script whenever the route surface might have changed:

```bash
.github/skills/rightsideup-api-operations/scripts/inventory-api.sh
```

It prints every `app/api/**/route.ts`, supported exported HTTP methods, public-vs-auth heuristic, and mutation flag. Then inspect the named route directly. Do not use the heuristic as authorization proof.

## Safe Prisma Read Pattern

From the repository root:

```bash
node -r dotenv/config -e '
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
(async () => {
  const records = await prisma.<model>.findMany({ select: { id: true } });
  console.log(JSON.stringify(records, null, 2));
})().finally(() => prisma.$disconnect());
'
```

For a production mutation, add assertions for expected names/IDs/counts before calling `updateMany`, and run a read-back query afterward.

## Deployment Protocol

For code changes:

1. `npx tsc --noEmit --pretty false`
2. `npm run build`
3. Stage only relevant files; do not stage generated `tsconfig.tsbuildinfo`, image archives, or user artifacts.
4. Commit and push `release-candidate`.
5. In the authenticated Vercel `north-shore-sign-co-s-projects/rightsideup-vw99` project, match the exact commit SHA, wait for Preview `Ready`, promote, and confirm Production `Current` with `app.northshoresignco.com` assigned.
6. Perform production data mutations only after deployment when the schema or runtime behavior requires the new code.

## Verification Checklist

Before reporting an operation complete, state:

- Exact route, model, or function used.
- Target record count and identifiers/names, without secrets.
- Resulting state from a post-action read.
- Typecheck/build status for code changes.
- Migration status if schema changed.
- Exact production commit/deployment/domain state if deployed.
