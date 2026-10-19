import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { decodeJwt, SignJWT } from "jose";

const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  findUnique: vi.fn(),
  sendEmail: vi.fn(),
  limit: vi.fn(),
  generateLoginToken: vi.fn(),
  verifyLoginToken: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { user: { findFirst: mocks.findFirst, findUnique: mocks.findUnique } },
}));
vi.mock("@/lib/email", () => ({ sendEmail: mocks.sendEmail }));
vi.mock("@/lib/ratelimit", () => ({ authLimiter: { limit: mocks.limit } }));
vi.mock("@/lib/magic-login", () => ({
  generateLoginToken: mocks.generateLoginToken,
  verifyLoginToken: mocks.verifyLoginToken,
}));

import { GET, POST } from "@/app/api/auth/magic-login/route";

function request(body: unknown, url = "https://app.northshoresignco.com/api/auth/magic-login") {
  return new NextRequest(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": "192.0.2.1" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.limit.mockResolvedValue({ success: true });
  mocks.generateLoginToken.mockResolvedValue("signed-token");
  mocks.sendEmail.mockResolvedValue({ success: true });
  mocks.findFirst.mockResolvedValue({
    id: "user-1",
    email: "agent@example.com",
    role: "REALTOR",
    tags: [],
    accountStatus: "ACTIVE",
  });
  mocks.verifyLoginToken.mockResolvedValue("user-1");
  mocks.findUnique.mockResolvedValue({
    id: "user-1",
    email: "agent@example.com",
    role: "REALTOR",
    tags: [],
    accountStatus: "ACTIVE",
  });
});

describe("magic login link requests", () => {
  it("sends a 30-minute link to an eligible account", async () => {
    const response = await POST(request({ email: "Agent@Example.com" }));

    expect(response.status).toBe(200);
    expect(mocks.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { email: { equals: "agent@example.com", mode: "insensitive" } },
    }));
    expect(mocks.generateLoginToken).toHaveBeenCalledWith("user-1", "30m");
    expect(mocks.sendEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: "agent@example.com",
      html: expect.stringContaining("expires in 30 minutes"),
      text: expect.stringContaining("signed-token"),
    }));
  });

  it("returns the same response and sends no email for an unknown address", async () => {
    mocks.findFirst.mockResolvedValue(null);
    const unknownResponse = await POST(request({ email: "unknown@example.com" }));
    mocks.findFirst.mockResolvedValue({
      id: "user-1",
      email: "agent@example.com",
      role: "REALTOR",
      tags: [],
      accountStatus: "ACTIVE",
    });
    const knownResponse = await POST(request({ email: "agent@example.com" }));

    expect(unknownResponse.status).toBe(200);
    expect(await unknownResponse.json()).toEqual(await knownResponse.json());
    expect(mocks.sendEmail).toHaveBeenCalledTimes(1);
  });

  it("does not send sign-in links to pending or inactive accounts", async () => {
    mocks.findFirst.mockResolvedValue({
      id: "user-1",
      email: "agent@example.com",
      role: "TC",
      tags: [],
      accountStatus: "PENDING_APPROVAL",
    });
    const response = await POST(request({ email: "agent@example.com" }));

    expect(response.status).toBe(200);
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it("rate limits before looking up an account", async () => {
    mocks.limit.mockResolvedValueOnce({ success: false }).mockResolvedValueOnce({ success: true });
    const response = await POST(request({ email: "agent@example.com" }));

    expect(response.status).toBe(429);
    expect(mocks.findFirst).not.toHaveBeenCalled();
  });
});

describe("magic login callback", () => {
  it("redirects through NextAuth with a safe relative destination", async () => {
    const response = await GET(new NextRequest(
      "https://app.northshoresignco.com/api/auth/magic-login?token=signed-token&redirect=%2Fdashboard%2Forders"
    ));

    expect(response.status).toBe(307);
    const destination = new URL(response.headers.get("location")!);
    expect(destination.pathname).toBe("/login");
    expect(destination.searchParams.get("magicLoginToken")).toBe("signed-token");
    expect(destination.searchParams.get("redirect")).toBe("/dashboard/orders");
  });

  it("replaces external redirect destinations with the dashboard", async () => {
    const response = await GET(new NextRequest(
      "https://app.northshoresignco.com/api/auth/magic-login?token=signed-token&redirect=https%3A%2F%2Fevil.example"
    ));

    expect(new URL(response.headers.get("location")!).searchParams.get("redirect")).toBe("/dashboard");
  });
});

describe("magic login token lifetime", () => {
  it("sets a 30-minute expiration and rejects older links", async () => {
    const previousSecret = process.env.AUTH_SECRET;
    process.env.AUTH_SECRET = "magic-login-test-secret";
    const { generateLoginToken, verifyLoginToken } = await vi.importActual<typeof import("@/lib/magic-login")>("@/lib/magic-login");

    try {
      const token = await generateLoginToken("user-1", "30m");
      const payload = decodeJwt(token);
      expect(payload.exp! - payload.iat!).toBe(30 * 60);
      expect(await verifyLoginToken(token)).toBe("user-1");

      const now = Math.floor(Date.now() / 1000);
      const expiredToken = await new SignJWT({ userId: "user-1", type: "magic-login" })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt(now - 30 * 60 - 1)
        .setExpirationTime(now - 1)
        .sign(new TextEncoder().encode(process.env.AUTH_SECRET));
      expect(await verifyLoginToken(expiredToken)).toBeNull();
    } finally {
      if (previousSecret === undefined) delete process.env.AUTH_SECRET;
      else process.env.AUTH_SECRET = previousSecret;
    }
  });
});