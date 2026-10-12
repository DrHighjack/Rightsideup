# Stability Verification

## Invoice IDOR Mutation (Recorded Step 2 Output)

Command: `npm run test:integration -- -t "allows A's own invoice but forbids A"`

The following is the failing-output excerpt captured when the ownership guard
was removed from GET `/api/invoices/[id]`, not a hypothetical failure:

```text
FAIL tests/integration/critical-api.test.ts > GET /api/invoices and invoice IDOR protection > allows A's own invoice but forbids A from reading B's invoice by ID
AssertionError: expected 200 to be 403 // Object.is equality

- Expected
+ Received

- 403
+ 200

Test Files  1 failed (1)
Tests  1 failed | 35 skipped (36)
Start at  15:06:55
Duration  1.93s
```

The ownership guard was restored immediately. The same command then reported
`1 passed | 35 skipped (36)` at 15:07:08.

## Admin Role Mutation (Recorded Current Output)

Command: `npm run test:integration -- tests/integration/route-roles.test.ts -t "GET.*admin/inventory' as"`

Only `session.user.role !== 'ADMIN'` was temporarily removed from GET
`/api/admin/inventory`; the missing-session check stayed in place.

```text
FAIL tests/integration/route-roles.test.ts > protected route role matrix > 'GET' /api/'admin/inventory' as 'REALTOR'
FAIL tests/integration/route-roles.test.ts > protected route role matrix > 'GET' /api/'admin/inventory' as 'TC'
FAIL tests/integration/route-roles.test.ts > protected route role matrix > 'GET' /api/'admin/inventory' as 'FIELD_TECH'
AssertionError: expected 200 to be 403 // Object.is equality

- Expected
+ Received

- 403
+ 200

Test Files  1 failed (1)
Tests  3 failed | 2 passed | 726 skipped (731)
Start at  15:37:51
Duration  2.72s
```

The role predicate was restored immediately and the identical command produced:

```text
Test Files  1 passed (1)
Tests  5 passed | 726 skipped (731)
Start at  15:38:05
Duration  2.72s
```

## Authorization Findings

- GET `/api/admin/self811-policy` was the admin handler missing a role check.
  It previously accepted any authenticated account. It now requires ADMIN.
- The realtor policy modal relied on that shared read. It now reads the new
  `/api/realtor/self811-policy` route, restricted to REALTOR and TC.
- GET `/api/realtor/811/[id]` applied ownership checks only inside REALTOR/TC
  branches; other roles could fall through for an existing ticket. It now
  rejects other roles before database lookup.
- Combined and helper-based guards returned inconsistent 401/403 statuses.
  They now distinguish missing identity (401) from disallowed role (403).
  Existing sales/brokerage access to specific brokerage functions is preserved.

## Coverage and Local Results

The explicit route/method table exercises anonymous, ADMIN, REALTOR, TC, and
FIELD_TECH callers with real encrypted NextAuth cookies, real handlers, and a
disposable Postgres database. It checks every exported HTTP method, including
PATCH, and fails if a protected route or method is not listed. It also discovers
exclusive caller-role guards outside the admin/realtor/field directories.
Allowed-role cases assert only that authorization succeeds; empty bodies and
missing-resource fixtures can still produce business-validation errors.

- Integration tests: 772 passed (736 role/completeness tests and 36 critical API tests).
- Unit tests: 74 passed.
- Type-check: passed.
- Neither mutation remains in the working tree.
- All local test databases are disposable Docker Postgres, never Railway.

## GitHub Actions Workflow

Current contents of `.github/workflows/stability.yml`:

```yaml
name: Stability

on:
  pull_request:
  push:
    branches: [main, "feature/stability-*"]

permissions:
  contents: read

jobs:
  checks:
    runs-on: ubuntu-latest
    timeout-minutes: 25
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: integration
          POSTGRES_PASSWORD: integration
          POSTGRES_DB: rightsignup_integration
        ports:
          - 5432:5432
        options: >-
          --health-cmd "pg_isready -U integration -d rightsignup_integration"
          --health-interval 5s
          --health-timeout 5s
          --health-retries 10
    env:
      DATABASE_URL: postgresql://integration:integration@127.0.0.1:5432/rightsignup_integration
      INTEGRATION_DATABASE_URL: postgresql://integration:integration@127.0.0.1:5432/rightsignup_integration
      AUTH_SECRET: ci-only-dummy-auth-secret-not-for-production
      AUTH_TRUST_HOST: "true"
      NEXTAUTH_URL: http://127.0.0.1:3000
      NEXT_PUBLIC_APP_URL: http://127.0.0.1:3000
      FLUIDPAY_SECRET_KEY: ci-only-dummy-payment-key
      FLUIDPAY_BASE_URL: http://127.0.0.1:9
      NEXT_PUBLIC_FLUIDPAY_PUBLIC_KEY: ci-only-dummy-public-key
      NEXT_PUBLIC_FLUIDPAY_BASE_URL: http://127.0.0.1:9
      NEXT_TELEMETRY_DISABLED: "1"
    steps:
      - uses: actions/checkout@v4
        with:
          persist-credentials: false
      - uses: actions/setup-node@v4
        with:
          node-version: "22"
          cache: npm
      - run: npm ci
      - run: npm run db:generate
      - run: npm run lint
      - run: npm run type-check
      - run: npm test
      - run: npm run test:integration
      - run: npx --no-install next build
```

CI has no Railway URL, production-secret references, or deployment migrations.
Feature pushes are enabled only for `feature/stability-*`, in addition to main
pushes and all pull requests. Step 3 has not been started.