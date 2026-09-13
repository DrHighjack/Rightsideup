# Phase 6: Smart Sign (Tap Box) — Product Requirements Document

**Product:** North Shore Sign Co. Portal
**Phase:** 6 (follows Phase 5 — QuickBooks integration + UX cleanup)
**Owner:** Darth (Owner/Operator)
**Status:** Draft for build

---

## 1. Summary

Add an NFC + QR-enabled "smart sign" tap tracking product to existing sign posts. Agents get visibility into who's engaging with their listing signage (tap timestamp + rough location), delivered via a subscription. This is a new revenue line and a retention/engagement tool — **not** a mortgage lead-gen tool at launch (see Section 7, Out of Scope).

---

## 2. Goals

- Ship a working tap → landing page → data capture loop for pilot testing
- Support a free trial → paid subscription conversion flow, agent-scoped (not listing-scoped)
- Lay a data model foundation that supports future paid tiers without rework
- Do this without new billing infrastructure — reuse the existing payment setup already live on the site

## 3. Non-Goals (this phase)

- No mortgage branding, CTAs, or copy anywhere in the tap flow
- No lead-capture form (name/phone/email) on the tap landing page — that's a future tier, flagged for compliance review before it's built
- No brokerage-level billing — billing is per-agent
- No physical sign panel changes — tag lives on the reusable post, not the printed listing panel

---

## 4. Hardware / Physical Spec

- NFC tag + QR code combo, mounted once per **signpost** (not per listing panel) — posts are reused across listings, so this is a one-time install per post, not a recurring cost
- Placement: both sides of the post if cost allows (~$0.35–0.50/post all-in for tag + filament)
- QR code is mandatory alongside NFC — most passersby won't have NFC top-of-mind; QR is the actual volume driver
- Every post in active rotation gets tagged going forward; no need to retrofit idle inventory immediately — tag as posts cycle through install jobs

---

## 5. User Flow

### 5.1 Tap/Scan Flow (public, no login)
1. Passerby taps NFC or scans QR on sign post
2. Routes to a listing landing page: photos, basic listing info (address, price, beds/baths, agent contact)
3. Tap event logged: timestamp, rough geolocation (if permitted by device), device type — **no PII captured at this stage**
4. If the associated agent's trial/subscription has lapsed (see 5.3), page shows a generic fallback ("Ask your agent about this listing") instead of live listing data

### 5.2 Agent Onboarding Flow
1. Agent is enrolled at time of install (or retroactively for existing active posts)
2. 3-month free trial starts automatically, scoped to the **agent**, not the individual sign — covers all of that agent's active posts, present and future, for the trial duration
3. Agent gets access to a simple dashboard: tap count, rough day/time pattern, per-listing breakdown

### 5.3 Trial → Paid Conversion Flow
1. Day ~75–80 of trial: automated notification to agent with concrete numbers (total taps, top-performing listing, trend) — this is the upsell moment, must be automated, no manual chasing
2. Day 90: trial ends
   - If agent has entered payment info → auto-converts to subscription, no interruption
   - If not → tap routing goes dark (fallback page per 5.1), tag remains physically in place (no retrieval/removal), reactivates instantly if agent subscribes later
3. Cancellation at any point: immediate stop of live routing, no partial refunds needed given low cost basis

---

## 6. Pricing & Tiers

Build the tier structure into the data model now, even though only Tier 1 launches in Phase 6.

| Tier | Price | Included | Launch in Phase 6? |
|---|---|---|---|
| Smart Sign | $29/mo per agent | Tap tracking, QR+NFC routing, live listing page, basic dashboard | **Yes** |
| Smart Sign + Insights | $49/mo per agent | Above + weekly summary report (patterns, repeat visitors) | No — reserve tier name/price only |
| Smart Sign + Insights + Lead Capture | $69/mo per agent | Above + opt-in contact form on tap page | No — flagged for compliance review before scoping |

- One-time buyout alternative: **$99 flat**, no recurring billing, for agents who decline subscriptions
- Billing: per-agent, covers all of that agent's active posts — not per-sign, not per-brokerage
- Reuse existing payment processing already live on the site — no new billing system

---

## 7. Out of Scope / Explicit Guardrails

- **No mortgage branding or CTAs on any tap-flow page.** Owner is licensed but the agent-facing mortgage conversion process has not been built or announced yet. This must not ship ahead of that on its own timeline.
- **No lead-capture form in this phase.** Capturing name/phone/email on a public tap page — especially one that could later feed a mortgage conversation — needs a compliance pass (RESPA-adjacent) before it's built, not after.
- No brokerage-level invoicing in this phase.

---

## 8. Data Model Notes

- Tap events should key off **signpost ID**, which maps to a **current listing ID**, which maps to an **agent ID** — posts are reused, so listing and agent associations need to be updatable per post over time without losing historical tap data tied to the old listing
- Subscription/trial status keys off **agent ID**, not signpost or listing ID
- Store enough on each tap event (timestamp, rough location, post ID) to support the future Insights tier's weekly summary without needing a schema change later

---

## 9. Success Metrics (Pilot)

- 5–10 posts tagged for initial pilot before wider rollout
- Track: tap volume/post/week, trial-to-paid conversion rate, dashboard engagement (does the agent actually log in and look)
- No revenue target for Phase 6 itself — this phase is about proving the mechanism works before judging conversion economics

---

## 10. Sequencing Note

This is Phase 6, after Phase 5 (QuickBooks integration + UX cleanup) ships. Do not pull engineering time from Phase 5 or mortgage-related portal work to accelerate this.
