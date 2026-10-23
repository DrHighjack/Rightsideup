import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";
import { SignJWT } from "jose";
import { prisma } from "@/lib/prisma";
import { GET as authGet, POST as authPost } from "@/app/api/auth/[...nextauth]/route";
import { POST as mobileLogin } from "@/app/api/auth/mobile-login/route";
import { POST as createOrder } from "@/app/api/orders/route";
import { GET as listInvoices } from "@/app/api/invoices/route";
import { GET as getInvoice } from "@/app/api/invoices/[id]/route";
import { POST as chargeInvoice } from "@/app/api/payments/charge/route";
import { GET as getRealtorPolicy } from "@/app/api/realtor/self811-policy/route";
import { GET as getRealtorTicket } from "@/app/api/realtor/811/[id]/route";
import { chargeToken, chargeVaultRecord } from "@/lib/fluidpay";
import { assertDisposableDatabase } from "./database";

const requestContext = vi.hoisted(() => ({ headers: new Headers() }));

vi.mock("next/headers", () => ({
  headers: () => requestContext.headers,
  cookies: () => ({ getAll: () => [] }),
}));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn(), setUser: vi.fn() }));
vi.mock("@/lib/email", () => ({
  sendOrderConfirmationEmail: vi.fn().mockResolvedValue(undefined),
  sendEmail: vi.fn().mockResolvedValue(undefined),
  getPaymentConfirmationEmail: vi.fn().mockReturnValue({ subject: "Test receipt", html: "Test" }),
}));
vi.mock("@/lib/discord", () => ({
  sendActivityDiscordWebhook: vi.fn().mockResolvedValue(undefined),
  sendNewOrderDiscordWebhook: vi.fn().mockResolvedValue(undefined),
  sendInvoicePaidDiscordWebhook: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/notifications", () => ({ notifyOrderUpdate: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/fluidpay", () => ({ chargeToken: vi.fn(), chargeVaultRecord: vi.fn() }));

const password = "Integration-password-123!";
const userA = "integration-realtor-a";
const userB = "integration-realtor-b";
const invoiceA = "c0000000000000000000000001";
const invoiceB = "c0000000000000000000000002";
const baseUrl = "http://localhost:3000";

function request(path: string, body?: unknown, token?: string) {
  const headers = new Headers({ host: "localhost:3000", "x-forwarded-proto": "http" });
  if (body !== undefined) headers.set("content-type", "application/json");
  if (token) headers.set("authorization", `Bearer ${token}`);
  requestContext.headers = headers;
  return new NextRequest(`${baseUrl}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function cookies(response: Response) {
  return response.headers.getSetCookie().map((cookie) => cookie.split(";")[0]).join("; ");
}

async function credentialsLogin(email = "a@example.test", suppliedPassword = password) {
  const csrf = await authGet(request("/api/auth/csrf"));
  const { csrfToken } = await csrf.json();
  expect(csrfToken).toEqual(expect.any(String));
  const headers = new Headers({
    "content-type": "application/x-www-form-urlencoded",
    cookie: cookies(csrf),
    host: "localhost:3000",
    "x-forwarded-proto": "http",
  });
  return authPost(new NextRequest(`${baseUrl}/api/auth/callback/credentials`, {
    method: "POST",
    headers,
    body: new URLSearchParams({ email, password: suppliedPassword, csrfToken, callbackUrl: `${baseUrl}/dashboard` }),
  }));
}

async function mobileToken(email = "a@example.test") {
  const response = await mobileLogin(request("/api/auth/mobile-login", { email, password }));
  expect(response.status).toBe(200);
  const body = await response.json();
  expect(body.token).toEqual(expect.any(String));
  expect(body.user).not.toHaveProperty("passwordHash");
  return body.token as string;
}

beforeEach(async () => {
  vi.clearAllMocks();
  vi.mocked(chargeToken).mockReset().mockResolvedValue({ transactionId: "test-token-transaction", status: "approved" });
  vi.mocked(chargeVaultRecord).mockReset().mockResolvedValue({ transactionId: "test-vault-transaction", status: "approved" });
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("External HTTP is forbidden in integration tests"); }));
  requestContext.headers = new Headers({ host: "localhost:3000", "x-forwarded-proto": "http" });
  assertDisposableDatabase(process.env.DATABASE_URL!);
  await prisma.ticket811.deleteMany();
  await prisma.self811Policy.deleteMany();
  await prisma.user.deleteMany();
  await prisma.inventoryItem.deleteMany();
  await prisma.areaPriceGroup.deleteMany();
  const passwordHash = await bcrypt.hash(password, 4);
  await prisma.user.createMany({ data: [
    { id: userA, email: "a@example.test", firstName: "Realtor", lastName: "A", passwordHash, role: "REALTOR", emailVerifiedAt: new Date(), vaultId: "test-vault-a" },
    { id: userB, email: "b@example.test", firstName: "Realtor", lastName: "B", passwordHash, role: "REALTOR", emailVerifiedAt: new Date() },
  ] });
  await prisma.invoice.createMany({ data: [
    { id: invoiceA, userId: userA, invoiceNumber: "TEST-A", amount: 10000, discountAmount: 1000, taxAmount: 900, paidAmount: 2000, status: "SENT" },
    { id: invoiceB, userId: userB, invoiceNumber: "TEST-B", amount: 5000, status: "SENT" },
    { id: "integration-draft-a", userId: userA, amount: 4000, status: "DRAFT" },
  ] });
});

afterAll(async () => {
  await prisma.$disconnect();
  vi.unstubAllGlobals();
});

describe("database safety", () => {
  it.each([
    "postgresql://integration:integration@railway.example:5432/rightsignup_integration",
    "postgresql://integration:integration@127.0.0.1:5432/production",
    "postgresql://production:secret@127.0.0.1:5432/rightsignup_integration",
    "postgresql://integration:integration@127.0.0.1:5432/rightsignup_integration?host=railway.example",
  ])("refuses unsafe database URL %s", (url) => {
    expect(() => assertDisposableDatabase(url)).toThrow("non-disposable");
  });
});

describe("legitimate policy and TC ticket flows", () => {
  it("lets a REALTOR fetch the stored policy from the new realtor endpoint", async () => {
    const policy = await prisma.self811Policy.create({ data: {
      content: "# Self 811 policy\nReview this policy before accepting.", version: "integration-v1",
    } });
    const token = await mobileToken();
    const response = await getRealtorPolicy(request("/api/realtor/self811-policy", undefined, token));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ policy: {
      id: policy.id, content: policy.content, version: policy.version, updatedAt: policy.updatedAt.toISOString(),
    } });
  });

  const ownershipPaths = ["realtor", "order", "matched-order"] as const;
  type OwnershipPath = typeof ownershipPaths[number];

  async function tcTicketFixture(agentId: string, ownership: OwnershipPath) {
    const tc = await prisma.user.create({ data: {
      email: "tc@example.test", firstName: "Test", lastName: "Coordinator", role: "TC",
      passwordHash: await bcrypt.hash(password, 4), emailVerifiedAt: new Date(),
    } });
    await prisma.tCAgentLink.create({ data: { tcUserId: tc.id, agentUserId: userA, grantedBy: "ADMIN" } });
    const order = ownership === "realtor" ? null : await prisma.order.create({ data: {
      orderNumber: "TEST-TC-811", realtorId: agentId, type: "INSTALL", address: "123 Integration St",
    } });
    const ticket = await prisma.ticket811.create({ data: {
      ticketNumber: "TEST-811", sourceEmail: "811@example.test", emailSubject: "Test ticket", emailBody: "Fixture ticket",
      realtorId: ownership === "realtor" ? agentId : null,
      orderId: ownership === "order" ? order!.id : null,
      matchedOrderIds: ownership === "matched-order" ? [order!.id] : [],
      parsedAddress: "123 Integration St", stage: "TICKET_SUBMITTED",
      utilityLines: [{ name: "Test Utility", status: "CLEAR" }],
    } });
    return { ticket, token: await mobileToken(tc.email) };
  }

  it.each(ownershipPaths)("lets a TC read a linked agent's ticket via %s ownership", async (ownership) => {
    const { ticket, token } = await tcTicketFixture(userA, ownership);
    const response = await getRealtorTicket(request(`/api/realtor/811/${ticket.id}`, undefined, token), { params: { id: ticket.id } });
    expect(response.status).toBe(200);
    expect((await response.json()).ticket).toMatchObject({
      id: ticket.id, ticketNumber: "TEST-811", parsedAddress: "123 Integration St", stage: "TICKET_SUBMITTED",
      utilityLines: [{ name: "Test Utility", status: "CLEAR" }],
    });
  });

  it.each(ownershipPaths)("forbids a TC from reading an unlinked agent's ticket via %s ownership", async (ownership) => {
    const { ticket, token } = await tcTicketFixture(userB, ownership);
    const response = await getRealtorTicket(request(`/api/realtor/811/${ticket.id}`, undefined, token), { params: { id: ticket.id } });
    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body).toEqual({ error: "Unauthorized" });
    expect(body).not.toHaveProperty("ticket");
    expect(await prisma.ticket811.findUnique({ where: { id: ticket.id } })).not.toBeNull();
  });
});

describe("credentials login (real NextAuth HTTP handlers)", () => {
  it("sets a session cookie and resolves the authenticated user", async () => {
    const response = await credentialsLogin("A@EXAMPLE.TEST");
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(`${baseUrl}/dashboard`);
    expect(cookies(response)).toContain("authjs.session-token=");
    const sessionRequest = request("/api/auth/session");
    sessionRequest.headers.set("cookie", cookies(response));
    const session = await authGet(sessionRequest);
    expect((await session.json()).user).toMatchObject({ id: userA, email: "a@example.test", role: "REALTOR" });
    expect((await prisma.user.findUniqueOrThrow({ where: { id: userA } })).lastLoginAt).not.toBeNull();
    const invoicesRequest = request("/api/invoices");
    invoicesRequest.headers.set("cookie", cookies(response));
    requestContext.headers = invoicesRequest.headers;
    const invoices = await listInvoices(invoicesRequest);
    expect(invoices.status).toBe(200);
    expect((await invoices.json()).invoices.map((invoice: { id: string }) => invoice.id)).toEqual([invoiceA]);
  });

  it.each([
    ["a@example.test", "wrong-password"],
    ["missing@example.test", password],
    ["not-an-email", password],
  ])("rejects credentials for %s", async (email, suppliedPassword) => {
    const response = await credentialsLogin(email, suppliedPassword);
    expect(response.headers.get("location")).not.toBe(`${baseUrl}/dashboard`);
    expect(cookies(response)).not.toContain("authjs.session-token=");
    expect((await prisma.user.findUniqueOrThrow({ where: { id: userA } })).lastLoginAt).toBeNull();
  });

  it("rejects an inactive account", async () => {
    await prisma.user.update({ where: { id: userA }, data: { tags: ["INACTIVE"] } });
    const response = await credentialsLogin();
    expect(response.headers.get("location")).not.toBe(`${baseUrl}/dashboard`);
    expect(cookies(response)).not.toContain("authjs.session-token=");
  });
});

describe("mobile-login and bearer-token access", () => {
  it("logs in case-insensitively and grants access to a protected route", async () => {
    const token = await mobileToken(" A@EXAMPLE.TEST ");
    const response = await listInvoices(request("/api/invoices", undefined, token));
    expect(response.status).toBe(200);
    expect((await response.json()).invoices.map((invoice: { id: string }) => invoice.id)).toEqual([invoiceA]);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: userA } })).lastLoginAt).not.toBeNull();
  });

  it.each([
    [{ email: "a@example.test", password: "wrong" }, 401],
    [{ email: "missing@example.test", password }, 401],
    [{ email: "invalid", password }, 400],
    [{ email: "a@example.test" }, 400],
  ])("rejects invalid mobile login %#", async (body, status) => {
    const response = await mobileLogin(request("/api/auth/mobile-login", body));
    expect(response.status).toBe(status);
    expect(await response.json()).not.toHaveProperty("token");
  });

  it("rejects inactive accounts at login and after token issuance", async () => {
    const token = await mobileToken();
    await prisma.user.update({ where: { id: userA }, data: { tags: ["INACTIVE"] } });
    expect((await mobileLogin(request("/api/auth/mobile-login", { email: "a@example.test", password }))).status).toBe(403);
    expect((await listInvoices(request("/api/invoices", undefined, token))).status).toBe(401);
  });

  it("rejects deleted users even with a previously valid token", async () => {
    const token = await mobileToken();
    await prisma.user.delete({ where: { id: userA } });
    expect((await listInvoices(request("/api/invoices", undefined, token))).status).toBe(401);
  });

  it.each(["not-a-jwt", "expired", "wrong-type", "wrong-signature"])("rejects %s bearer tokens", async (kind) => {
    let token = kind;
    if (kind !== "not-a-jwt") {
      token = await new SignJWT({ role: "REALTOR", email: "a@example.test", type: kind === "wrong-type" ? "web" : "mobile" })
        .setProtectedHeader({ alg: "HS256" }).setSubject(userA)
        .setExpirationTime(kind === "expired" ? 1 : "1h")
        .sign(new TextEncoder().encode(kind === "wrong-signature" ? "different-secret" : process.env.AUTH_SECRET!));
    }
    expect((await listInvoices(request("/api/invoices", undefined, token))).status).toBe(401);
  });
});

describe("POST /api/orders", () => {
  it("persists the authenticated owner, area pricing, and addon price snapshots", async () => {
    await prisma.areaPriceGroup.create({ data: { name: "Test service area", cities: ["Everett"], amountCents: 1500 } });
    const addon = await prisma.inventoryItem.create({ data: { name: "Test rider", category: "RIDER", pricePerUnit: 250 } });
    const token = await mobileToken();
    const response = await createOrder(request("/api/orders", {
      type: "INSTALL", address: "123 Test St, Everett, WA", addressLat: "47.98", addressLng: "-122.20",
      realtorId: userB, addons: [{ inventoryItemId: addon.id, quantity: 2 }],
    }, token));
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.orderNumber).toMatch(/^SPF-\d{5}$/);
    const stored = await prisma.order.findUniqueOrThrow({ where: { id: body.id }, include: { addons: true } });
    expect(stored).toMatchObject({ realtorId: userA, type: "INSTALL", status: "PENDING", areaPriceCents: 1500, addressLat: 47.98, addressLng: -122.20 });
    expect(stored.addons).toHaveLength(1);
    expect(stored.addons[0]).toMatchObject({ inventoryItemId: addon.id, quantity: 2, priceAtOrder: 250 });
  });

  it("rejects unauthenticated creation without writing an order", async () => {
    expect((await createOrder(request("/api/orders", { type: "INSTALL", address: "123 Test St" }))).status).toBe(401);
    expect(await prisma.order.count()).toBe(0);
  });

  it("rejects missing required fields without writing an order", async () => {
    const token = await mobileToken();
    expect((await createOrder(request("/api/orders", { type: "INSTALL" }, token))).status).toBe(400);
    expect(await prisma.order.count()).toBe(0);
  });

  it("requires realtor email verification", async () => {
    await prisma.user.update({ where: { id: userA }, data: { emailVerifiedAt: null } });
    const token = await mobileToken();
    expect((await createOrder(request("/api/orders", { type: "INSTALL", address: "123 Test St" }, token))).status).toBe(403);
    expect(await prisma.order.count()).toBe(0);
  });

  it("rejects a field technician placing an order", async () => {
    await prisma.user.update({ where: { id: userA }, data: { role: "FIELD_TECH" } });
    const token = await mobileToken();
    expect((await createOrder(request("/api/orders", { type: "INSTALL", address: "123 Test St" }, token))).status).toBe(403);
    expect(await prisma.order.count()).toBe(0);
  });
});

describe("GET /api/invoices and invoice IDOR protection", () => {
  it("lists only the caller's non-draft invoices even with another userId supplied", async () => {
    const token = await mobileToken();
    const response = await listInvoices(request(`/api/invoices?userId=${userB}&realtorId=${userB}`, undefined, token));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.total).toBe(1);
    expect(body.invoices.map((invoice: { id: string }) => invoice.id)).toEqual([invoiceA]);
    expect(JSON.stringify(body)).not.toContain(invoiceB);
  });

  it("allows A's own invoice but forbids A from reading B's invoice by ID", async () => {
    const token = await mobileToken();
    const own = await getInvoice(request(`/api/invoices/${invoiceA}`, undefined, token), { params: { id: invoiceA } });
    expect(own.status).toBe(200);
    expect((await own.json()).id).toBe(invoiceA);
    const other = await getInvoice(request(`/api/invoices/${invoiceB}`, undefined, token), { params: { id: invoiceB } });
    expect(other.status).toBe(403);
    expect(await other.json()).toEqual({ error: "Forbidden" });
    const ownerToken = await mobileToken("b@example.test");
    expect((await getInvoice(request(`/api/invoices/${invoiceB}`, undefined, ownerToken), { params: { id: invoiceB } })).status).toBe(200);
  });

  it("rejects unauthenticated listing and detail access", async () => {
    expect((await listInvoices(request("/api/invoices"))).status).toBe(401);
    expect((await getInvoice(request(`/api/invoices/${invoiceA}`), { params: { id: invoiceA } })).status).toBe(401);
  });

  it("hides draft invoices from list filters and direct reads", async () => {
    const token = await mobileToken();
    expect((await listInvoices(request("/api/invoices?status=DRAFT", undefined, token))).status).toBe(403);
    expect((await getInvoice(request("/api/invoices/integration-draft-a", undefined, token), { params: { id: "integration-draft-a" } })).status).toBe(404);
  });
});

describe("POST /api/payments/charge (FluidPay mocked)", () => {
  it.each([false, true])("charges the server-calculated remaining balance (useVault=%s)", async (useVault) => {
    const token = await mobileToken();
    const response = await chargeInvoice(request("/api/payments/charge", { invoiceId: invoiceA, token: "test-payment-token", useVault, amount: 1 }, token));
    expect(response.status).toBe(200);
    const transactionId = useVault ? "test-vault-transaction" : "test-token-transaction";
    expect(await response.json()).toEqual({ success: true, transactionId });
    if (useVault) {
      expect(chargeVaultRecord).toHaveBeenCalledExactlyOnceWith(userA, "test-vault-a", 7900, invoiceA);
      expect(chargeToken).not.toHaveBeenCalled();
    } else {
      expect(chargeToken).toHaveBeenCalledExactlyOnceWith("test-payment-token", 7900, invoiceA);
      expect(chargeVaultRecord).not.toHaveBeenCalled();
    }
    const invoice = await prisma.invoice.findUniqueOrThrow({ where: { id: invoiceA }, include: { payments: true } });
    expect(invoice).toMatchObject({ status: "PAID", paidAmount: 9900, paidByUserId: userA, fluidpayTransactionId: transactionId });
    expect(invoice.paidAt).toBeInstanceOf(Date);
    expect(invoice.payments).toHaveLength(1);
    expect(invoice.payments[0]).toMatchObject({ amount: 7900, userId: userA, status: "PAID", payerType: useVault ? "VAULT" : "TOKEN" });
    expect((await chargeInvoice(request("/api/payments/charge", { invoiceId: invoiceA, token: "test-payment-token", useVault }, token))).status).toBe(400);
    expect(await prisma.invoicePayment.count()).toBe(1);
    expect(vi.mocked(useVault ? chargeVaultRecord : chargeToken)).toHaveBeenCalledTimes(1);
  });

  it("forbids charging another realtor's invoice before calling FluidPay", async () => {
    const token = await mobileToken();
    expect((await chargeInvoice(request("/api/payments/charge", { invoiceId: invoiceB, token: "test-payment-token", useVault: false }, token))).status).toBe(403);
    expect(chargeToken).not.toHaveBeenCalled();
    expect(chargeVaultRecord).not.toHaveBeenCalled();
    expect(await prisma.invoicePayment.count()).toBe(0);
    expect((await prisma.invoice.findUniqueOrThrow({ where: { id: invoiceB } })).status).toBe("SENT");
  });

  it("leaves invoice and payment records unchanged when FluidPay fails", async () => {
    vi.mocked(chargeToken).mockRejectedValueOnce(new Error("Test processor decline"));
    const token = await mobileToken();
    const before = await prisma.invoice.findUniqueOrThrow({ where: { id: invoiceA } });
    expect((await chargeInvoice(request("/api/payments/charge", { invoiceId: invoiceA, token: "test-payment-token", useVault: false }, token))).status).toBe(500);
    expect(await prisma.invoice.findUniqueOrThrow({ where: { id: invoiceA } })).toEqual(before);
    expect(await prisma.invoicePayment.count()).toBe(0);
  });

  it.each(["PAID", "VOIDED"] as const)("rejects %s invoices without charging", async (status) => {
    await prisma.invoice.update({ where: { id: invoiceA }, data: { status } });
    const token = await mobileToken();
    expect((await chargeInvoice(request("/api/payments/charge", { invoiceId: invoiceA, token: "test-payment-token", useVault: false }, token))).status).toBe(400);
    expect(chargeToken).not.toHaveBeenCalled();
    expect(await prisma.invoicePayment.count()).toBe(0);
  });

  it("rejects unauthenticated and malformed charge requests", async () => {
    expect((await chargeInvoice(request("/api/payments/charge", { invoiceId: invoiceA, token: "test-payment-token", useVault: false }))).status).toBe(401);
    const token = await mobileToken();
    expect((await chargeInvoice(request("/api/payments/charge", { invoiceId: "", token: "test-payment-token", useVault: false }, token))).status).toBe(400);
    expect(chargeToken).not.toHaveBeenCalled();
    expect(await prisma.invoicePayment.count()).toBe(0);
  });
});