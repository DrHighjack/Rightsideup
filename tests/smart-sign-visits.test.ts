import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { findTag, findTagBySign, findSubscription, createEvent, findEvent, sendEmail } = vi.hoisted(() => ({
  findTag: vi.fn(),
  findTagBySign: vi.fn(),
  findSubscription: vi.fn(),
  createEvent: vi.fn(),
  findEvent: vi.fn(),
  sendEmail: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: {
  smartSignTag: { findUnique: findTag, findFirst: findTagBySign },
  smartSignSubscription: { findUnique: findSubscription },
  smartSignTapEvent: { create: createEvent, findUnique: findEvent },
} }));
vi.mock("@/lib/email", () => ({ sendEmail }));
vi.mock("@/lib/fluidpay", () => ({ chargeVaultRecord: vi.fn() }));

import { POST as tagTap } from "@/app/api/smart-sign/[tagCode]/tap/route";
import { POST as signTap } from "@/app/api/tap/[signId]/tap/route";

describe("Smart Sign visit emails", () => {
  const visits = new Map<string, { tagId: string; orderId: string; tappedAt: Date }>();
  let eventCount: number;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-30T12:00:00Z"));
    vi.clearAllMocks();
    visits.clear();
    eventCount = 0;
    const tag = {
      id: "tag-1", tagCode: "NS-0006", isActive: true,
      sign: {
        assignedToUser: { id: "agent-1", email: "gary@example.com" },
        assignedToOrder: { id: "order-1", address: "6211 26th Ave NW", photos: null, notes: null, rfidListingUrl: null },
      },
    };
    findTag.mockResolvedValue(tag);
    findTagBySign.mockResolvedValue(tag);
    findSubscription.mockResolvedValue({ status: "ACTIVE" });
    createEvent.mockImplementation(async () => {
      const id = `event-${++eventCount}`;
      visits.set(id, { tagId: "tag-1", orderId: "order-1", tappedAt: new Date() });
      return { id, tappedAt: new Date() };
    });
    findEvent.mockImplementation(async ({ where }: { where: { id: string } }) => visits.get(where.id) || null);
    sendEmail.mockResolvedValue({ success: true });
  });

  afterEach(() => vi.useRealTimers());

  function request(path: string, cookie?: string, location = false, isReload = false) {
    return new NextRequest(`https://app.northshoresignco.com${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(cookie ? { cookie } : {}) },
      body: JSON.stringify(location ? { latitude: 47.5, longitude: -122.3 } : { deviceType: "iOS", isReload }),
    });
  }

  it("notifies on first open and a later return, but not a refresh or location share", async () => {
    const path = "/api/smart-sign/NS-0006/tap";
    const first = await tagTap(request(path), { params: { tagCode: "NS-0006" } });
    expect(first.status).toBe(202);
    expect(await first.json()).toEqual({ recorded: true, isLive: true });
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail.mock.calls[0][0].subject).toContain("Smart Sign opened");
    const cookie = first.headers.get("set-cookie")!;
    expect(cookie).toContain("HttpOnly");

    const refresh = await tagTap(request(path, cookie), { params: { tagCode: "NS-0006" } });
    expect(refresh.headers.get("set-cookie")).toBeNull();
    await tagTap(request(path, cookie, true), { params: { tagCode: "NS-0006" } });
    expect(sendEmail).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(31 * 60 * 1000);
    const reload = await tagTap(request(path, cookie, false, true), { params: { tagCode: "NS-0006" } });
    expect(reload.headers.get("set-cookie")).toBeNull();
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const returned = await tagTap(request(path, cookie), { params: { tagCode: "NS-0006" } });
    expect(sendEmail).toHaveBeenCalledTimes(2);
    expect(sendEmail.mock.calls[1][0].subject).toContain("Return visit");
    expect(returned.headers.get("set-cookie")).toContain("event-5");
  });

  it("does not treat an unrelated event cookie as a return", async () => {
    visits.set("other-tag", { tagId: "tag-2", orderId: "order-1", tappedAt: new Date() });
    await tagTap(request("/api/smart-sign/NS-0006/tap", "smart-sign-visit-NS-0006=other-tag"), { params: { tagCode: "NS-0006" } });
    expect(sendEmail.mock.calls[0][0].subject).toContain("Smart Sign opened");
  });

  it("also handles the legacy sign URL", async () => {
    const response = await signTap(request("/api/tap/SPF-S-0005/tap"), { params: { signId: "SPF-S-0005" } });
    expect(response.headers.get("set-cookie")).toContain("smart-sign-visit-SPF-S-0005");
    expect(sendEmail.mock.calls[0][0].to).toBe("gary@example.com");
  });
});