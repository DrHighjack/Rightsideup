import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  findUnique: vi.fn(),
  update: vi.fn(),
  sendEmail: vi.fn(),
  limit: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { user: { findFirst: mocks.findFirst, findUnique: mocks.findUnique, update: mocks.update } },
}));
vi.mock("@/lib/email", () => ({
  sendEmail: mocks.sendEmail,
  getAccountVerificationEmail: (_name: string, link: string) => ({ subject: "Verify email", html: link }),
}));
vi.mock("@/lib/ratelimit", () => ({ authLimiter: { limit: mocks.limit } }));

import { GET, POST } from "@/app/api/auth/verify-email/route";

function resendRequest(email = "agent@example.com") {
  return new NextRequest("https://app.northshoresignco.com/api/auth/verify-email", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": "192.0.2.1" },
    body: JSON.stringify({ email }),
  });
}

const user = {
  id: "agent-1",
  email: "agent@example.com",
  firstName: "Agent",
  tags: [],
  emailVerifiedAt: null,
  emailVerificationToken: "existing-token",
  emailVerificationExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.limit.mockResolvedValue({ success: true });
  mocks.findFirst.mockResolvedValue({ ...user });
  mocks.sendEmail.mockResolvedValue({ success: true });
  mocks.update.mockResolvedValue({});
});

describe("verification email resend", () => {
  it("normalizes the email and preserves an unexpired verification link", async () => {
    const response = await POST(resendRequest(" Agent@Example.com "));
    expect(response.status).toBe(200);
    expect(mocks.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { email: { equals: "agent@example.com", mode: "insensitive" } },
    }));
    expect(mocks.sendEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: user.email,
      html: expect.stringContaining("/verify-email?token=existing-token"),
    }));
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("persists a fresh 24-hour token before sending an expired link", async () => {
    mocks.findFirst.mockResolvedValue({ ...user, emailVerificationExpiresAt: new Date(0) });
    const before = Date.now();
    expect((await POST(resendRequest())).status).toBe(200);
    const updated = mocks.update.mock.calls[0][0].data;
    expect(updated.emailVerificationToken).not.toBe(user.emailVerificationToken);
    expect(updated.emailVerificationExpiresAt.getTime()).toBeGreaterThanOrEqual(before + 24 * 60 * 60 * 1000);
    expect(mocks.sendEmail).toHaveBeenCalledWith(expect.objectContaining({
      html: expect.stringContaining(updated.emailVerificationToken),
    }));
  });

  it("reports unconfigured email instead of falsely reporting success", async () => {
    mocks.sendEmail.mockResolvedValue({ success: false, skipped: true });
    const response = await POST(resendRequest());
    expect(response.status).toBe(503);
    expect((await response.json()).error).toContain("could not send");
  });

  it("reports provider failures without exposing provider details", async () => {
    mocks.sendEmail.mockRejectedValue(new Error("Provider rejected message"));
    const response = await POST(resendRequest());
    expect(response.status).toBe(503);
    expect((await response.json()).error).not.toContain("Provider rejected");
  });

  it.each([
    ["unknown", null],
    ["verified", { ...user, emailVerifiedAt: new Date() }],
    ["inactive", { ...user, tags: ["INACTIVE"] }],
  ])("does not disclose or send for %s accounts", async (_label, account) => {
    mocks.findFirst.mockResolvedValue(account);
    const response = await POST(resendRequest());
    expect(response.status).toBe(200);
    expect((await response.json()).message).toContain("If this account needs verification");
    expect(mocks.sendEmail).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("rejects invalid email without accessing the database", async () => {
    expect((await POST(resendRequest("invalid"))).status).toBe(400);
    expect(mocks.findFirst).not.toHaveBeenCalled();
  });

  it("limits requests by both IP and email", async () => {
    mocks.limit.mockResolvedValueOnce({ success: true }).mockResolvedValueOnce({ success: false });
    expect((await POST(resendRequest())).status).toBe(429);
    expect(mocks.limit).toHaveBeenCalledWith("verification:ip:192.0.2.1");
    expect(mocks.limit).toHaveBeenCalledWith("verification:email:agent@example.com");
    expect(mocks.findFirst).not.toHaveBeenCalled();
  });
});

describe("email verification link", () => {
  it("marks an account verified and consumes a valid token", async () => {
    mocks.findUnique.mockResolvedValue(user);
    const response = await GET(new NextRequest("https://app.northshoresignco.com/api/auth/verify-email?token=existing-token"));
    expect(response.status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: user.id },
      data: { emailVerifiedAt: expect.any(Date), emailVerificationToken: null, emailVerificationExpiresAt: null },
    });
  });

  it("rejects expired links without verifying the account", async () => {
    mocks.findUnique.mockResolvedValue({ ...user, emailVerificationExpiresAt: new Date(0) });
    expect((await GET(new NextRequest("https://app.northshoresignco.com/api/auth/verify-email?token=existing-token"))).status).toBe(410);
    expect(mocks.update).not.toHaveBeenCalled();
  });
});