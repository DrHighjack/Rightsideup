import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { registerSchema } from "@/lib/schemas";
import { buildSmsConsentData, SMS_CONSENT_DISCLOSURE, SMS_CONSENT_TAG } from "@/lib/sms-consent";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), findUnique: vi.fn(), sendSMS: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique: mocks.findUnique } } }));
vi.mock("@/lib/sms", () => ({ sendSMS: mocks.sendSMS, getNotificationSMS: (message: string) => message }));

import { POST } from "@/app/api/admin/users/[id]/send-sms/route";

const registration = {
  firstName: "Test", lastName: "Agent", email: "agent@example.com",
  password: "test-password", confirmPassword: "test-password",
};

describe("registration SMS consent", () => {
  it("defaults to no consent and allows registration without a phone", () => {
    expect(registerSchema.parse(registration).smsOptIn).toBe(false);
    expect(buildSmsConsentData(undefined, false)).toEqual({});
  });

  it("does not infer consent from providing a phone number", () => {
    expect(buildSmsConsentData("+12065551234", false)).toEqual({});
  });

  it.each([undefined, "", "2065551234", "not a phone"])("requires an international phone number for consent: %s", (phone) => {
    expect(registerSchema.safeParse({ ...registration, phone, smsOptIn: true }).success).toBe(false);
  });

  it("rejects truthy strings as consent", () => {
    expect(registerSchema.safeParse({ ...registration, phone: "+12065551234", smsOptIn: "true" }).success).toBe(false);
  });

  it("records the phone, disclosure, source, and timestamp together with the opt-in tag", () => {
    const parsed = registerSchema.parse({ ...registration, phone: "+12065551234", smsOptIn: true });
    const data = buildSmsConsentData(parsed.phone, parsed.smsOptIn);
    expect(data.tags).toEqual([SMS_CONSENT_TAG]);
    expect(data.activityLogs?.create.metadata).toMatchObject({
      phone: "+12065551234", source: "/register", disclosure: SMS_CONSENT_DISCLOSURE,
      disclosureVersion: "2026-10-07", consentedAt: expect.any(String),
    });
  });
});

describe("admin SMS notification consent guard", () => {
  function request() {
    return new NextRequest("https://app.northshoresignco.com/api/admin/users/agent-1/send-sms", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Your installation is scheduled." }),
    });
  }

  beforeEach(() => {
    vi.resetAllMocks();
    mocks.auth.mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } });
    mocks.findUnique.mockResolvedValue({
      id: "agent-1", firstName: "Test", phone: "+12065551234", email: "agent@example.com",
      tags: [SMS_CONSENT_TAG], activityLogs: [{ entityId: "+12065551234" }],
    });
    mocks.sendSMS.mockResolvedValue({ success: true });
  });

  it("sends only with consent for the current phone", async () => {
    expect((await POST(request(), { params: { id: "agent-1" } })).status).toBe(200);
    expect(mocks.sendSMS).toHaveBeenCalledWith({ to: "+12065551234", message: "Your installation is scheduled." });
  });

  it.each([
    { tags: [], activityLogs: [] },
    { tags: [SMS_CONSENT_TAG], activityLogs: [] },
    { tags: [SMS_CONSENT_TAG], activityLogs: [{ entityId: "+12065559999" }] },
  ])("blocks absent or mismatched consent: %j", async (consent) => {
    mocks.findUnique.mockResolvedValue({ id: "agent-1", phone: "+12065551234", ...consent });
    expect((await POST(request(), { params: { id: "agent-1" } })).status).toBe(403);
    expect(mocks.sendSMS).not.toHaveBeenCalled();
  });

  it("does not let unauthenticated callers send texts", async () => {
    mocks.auth.mockResolvedValue(null);
    expect((await POST(request(), { params: { id: "agent-1" } })).status).toBe(401);
    expect(mocks.sendSMS).not.toHaveBeenCalled();
  });
});