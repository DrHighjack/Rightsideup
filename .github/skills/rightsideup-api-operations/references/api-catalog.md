# Rightsideup API Capability Catalog

This catalog is a routing aid, not a contract. Before acting, inspect the route handler and its request schema. Run `../scripts/inventory-api.sh` from the repository root to see the current route/method surface.

## Core Workflows

| Capability | Primary routes | Notes |
|---|---|---|
| Current user authentication | `/api/auth/[...nextauth]`, `/api/auth/register`, `/api/auth/register-tc`, `/api/auth/verify-email`, `/api/auth/password-reset`, `/api/auth/magic-login` | Do not expose auth tokens or reset links. |
| Orders | `/api/orders`, `/api/orders/[id]`, `/api/orders/[id]/cancel`, `/api/orders/[id]/coupon`, `/api/orders/[id]/photos` | TC must be linked to target realtor via `TCAgentLink`. Route handles status lifecycle, ownership, 811 constraints. |
| Admin order operations | `/api/admin/orders`, `/api/admin/orders/[id]`, `/api/admin/orders/map`, `/api/admin/orders/[id]/schedule-removal`, `/api/admin/orders/[id]/send-completion` | ADMIN. High impact: order state, jobs, emails. |
| Sales orders | `/api/salesmen/orders`, `/api/salesmen/clients`, `/api/salesmen/stats` | SALESMEN-scoped. |
| Field jobs | `/api/field/jobs`, `/api/field/jobs/[id]`, `/api/field/jobs/[id]/start`, `/complete`, `/flag` | FIELD_TECH owns assigned work. Completion changes order state and sends notifications. |
| 811 workflow | `/api/admin/811/**`, `/api/realtor/811/**` | ADMIN can create, match, stage, clear, dismiss, assign orders, and update utility lines. Never bypass the utility-line safety checks. |

## Accounts and Organization

| Capability | Primary routes | Notes |
|---|---|---|
| Admin users/realtors | `/api/admin/users`, `/api/admin/users/[id]`, `/api/admin/users/search`, `/api/admin/users/[id]/orders`, `/send-credit`, `/send-sms`, `/impersonate` | ADMIN. User deletion and impersonation are high impact. |
| Brokerages | `/api/admin/brokerages`, `/api/admin/brokerages/[id]`, `/access`, `/agents/attach`, `/agents/import`, `/invoice-schedule`, `/send-invitation` | ADMIN. Multi-office grants must be server-authorized. |
| TC accounts and links | `/api/admin/tcs`, `/api/admin/tcs/create`, `/api/admin/tcs/[id]`, `/profile`, `/link`, `/link/[id]`, `/send-invitation` | ADMIN. Links determine which agents a TC can act for. |
| TC self-service | `/api/tc/agents`, `/api/tc/set-agent`, `/api/tc/realtors`, `/api/tc/linked-tcs`, `/api/tc/pricing` | TC. Agent picker includes linked agents, including agents who have not logged in. |
| Brokerage portal | `/api/brokerage/access`, `/profile`, `/agents`, `/invoices`, `/invoice-schedule` | BROKERAGE / authorized shared accountant. |

## Financial Operations

| Capability | Primary routes | Notes |
|---|---|---|
| Admin invoices | `/api/admin/invoices`, `/api/admin/invoices/[id]`, `/api/admin/invoices/[id]/send` | ADMIN creates/edits/sends. Drafts do not count as outstanding. |
| Invoice self-service | `/api/invoices`, `/api/invoices/[id]`, `/apply-credit`, `/pay`, `/payment-schedules`, `/pdf` | Owner or authorized TC. Preserve balance checks. |
| Payment instruments | `/api/payment-methods`, `/api/payment-methods/[id]`, `/api/payments/card-on-file`, `/save-card`, `/charge`, `/run-schedules` | Never surface raw card/FluidPay credentials. `/run-schedules` can charge cards. |
| Brokerage statements | `/api/brokerage/statements`, `/consolidated`, `/[id]/pay`, `/[id]/pdf`, `/api/brokerage/auto-pay` | Billing owner/card validation is required; do not manually call related auto-pay cron routes. |
| Reports | `/api/admin/reports/clients`, `/field-techs`, `/inventory`, `/orders`, `/revenue` | ADMIN exports/analytics. |

## Physical Operations

| Capability | Primary routes | Notes |
|---|---|---|
| Admin sign inventory | `/api/admin/signs`, `/api/admin/signs/[id]`, `/bulk`, `/map` | Physical signpost lifecycle; assignments link current listing/realtor. |
| Sign reports/reorders/pickups | `/api/signs/mine`, `/api/signs/[id]/report`, `/api/signs/reorder`, `/api/signs/schedule-pickup`, `/api/sign-pickup-requests` | Realtor/TC/ADMIN depending on endpoint. |
| Inventory and printers | `/api/admin/inventory`, `/api/admin/inventory/[id]`, `/upload`, `/api/inventory/items`, `/api/printers`, `/api/admin/printers/**` | ADMIN manages floors, quantities, printers. |
| Custom signs | `/api/custom-signs`, `/api/printer-partnership-requests` | User-owned workflow. |

## Pricing

| Capability | Primary routes | Notes |
|---|---|---|
| Master/override pricing | `/api/admin/pricing`, `/api/admin/pricing/overrides`, `/api/admin/pricing/overrides/[id]/[action]` | ADMIN. Overrides can be locked; inspect side effects before changing master price. |
| City area pricing | `/api/admin/pricing/areas`, `/api/admin/pricing/areas/[id]`, `/api/pricing/area` | ADMIN groups cities under a price; public order preview endpoint is authenticated. Server re-resolves price at order creation. |

## Smart Sign Phase 6

| Capability | Primary routes | Notes |
|---|---|---|
| Provision reusable tag | `/api/admin/smart-sign` | ADMIN. One tag per physical post; assigned agent gets trial. |
| Agent dashboard/subscription | `/api/smart-sign/dashboard`, `/api/smart-sign/subscription` | REALTOR. Trial, $29 subscription, $99 buyout; saved card identifiers only. |
| Public listing and tap | `/s/[tagCode]`, `/api/smart-sign/[tagCode]/tap` | Public. No lead form, PII, IP logging, or passive location collection. |
| Scheduled lifecycle | `/api/cron/smart-sign` | CRON_SECRET only. Sends day-75 reminder and processes expiry/recurring charge. |

## System and Integrations

| Capability | Primary routes | Notes |
|---|---|---|
| Settings | `/api/admin/settings`, `/test-imap`, `/test-discord`, `/api/admin/2fa/**` | ADMIN. Sensitive stored values are encrypted; do not log decrypted values. |
| Discord settings | Stored in `AppSettings`; notification categories are configured through Admin Settings | Webhook URL is secret. Test endpoint sends a real message. |
| QuickBooks | `/api/quickbooks/connect`, `/callback`, `/webhook`, `/api/admin/quickbooks/**` | OAuth and accounting side effects. Inspect handler before action. |
| Notifications/activity | `/api/notifications`, `/read`, `/api/admin/activity`, `/api/admin/sms-logs` | In-app events/audit records. |
| Leads | `/api/leads`, `/api/admin/leads/**` | Legacy Facebook-ad workflow is retained but not currently surfaced in navigation. |

## Protected Cron Routes

- `/api/cron/brokerage-statements`
- `/api/cron/brokerage-auto-pay`
- `/api/cron/brevo-usage`
- `/api/cron/smart-sign`

All require `Authorization: Bearer ${CRON_SECRET}`. Treat them as production automation, not read/debug endpoints.
