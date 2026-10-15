import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { SignJWT } from "jose";

const { findOrder, findTag, findTagBySign, findSubscription, createEvent, findEvent, getLiveEmail, sendEmail, startVisit } = vi.hoisted(() => ({
  findOrder: vi.fn(),
  findTag: vi.fn(),
  findTagBySign: vi.fn(),
  findSubscription: vi.fn(),
  createEvent: vi.fn(),
  findEvent: vi.fn(),
  getLiveEmail: vi.fn(),
  sendEmail: vi.fn(),
  startVisit: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: {
  order: { findUnique: findOrder },
  smartSignTag: { findUnique: findTag, findFirst: findTagBySign },
  smartSignSubscription: { findUnique: findSubscription },
  smartSignTapEvent: { create: createEvent, findUnique: findEvent },
} }));
vi.mock("@/lib/email", () => ({ sendEmail, getSmartSignLiveEmail: getLiveEmail }));
vi.mock("@/lib/fluidpay", () => ({ chargeVaultRecord: vi.fn() }));
vi.mock("@/lib/discord", () => ({ sendTapboxVisitDiscordWebhook: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/tapbox-visit", async (original) => ({ ...await original<typeof import("@/lib/tapbox-visit")>(), startTapboxDiscordVisit: startVisit }));

import { POST as tagTap } from "@/app/api/smart-sign/[tagCode]/tap/route";
import { POST as signTap } from "@/app/api/tap/[signId]/tap/route";
import { notifySmartSignLiveForOrder } from "@/lib/smart-sign";

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
    findOrder.mockResolvedValue({
      id: "order-1",
      address: "6211 26th Ave NW",
      rfidListingUrl: "https://listing.example/",
      realtor: { firstName: "Gary", email: "gary@example.com" },
      assignedSigns: [{ status: "DEPLOYED", smartSignTag: { tagCode: "NS-0006", isActive: true } }],
    });
    getLiveEmail.mockReturnValue({ subject: "Your Smart Sign box is live", html: "View live box" });
    createEvent.mockImplementation(async () => {
      const id = `event-${++eventCount}`;
      visits.set(id, { tagId: "tag-1", orderId: "order-1", tappedAt: new Date() });
      return { id, tappedAt: new Date() };
    });
    findEvent.mockImplementation(async ({ where }: { where: { id: string } }) => visits.get(where.id) || null);
    sendEmail.mockResolvedValue({ success: true });
    startVisit.mockReset().mockResolvedValue(undefined);
  });

  afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

  function request(path: string, cookie?: string, location = false, isReload = false, source: "box" | "share" = "box") {
    return new NextRequest(`https://app.northshoresignco.com${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(cookie ? { cookie } : {}) },
      body: JSON.stringify(location ? { latitude: 47.5, longitude: -122.3, source } : { deviceType: "iOS", isReload, source }),
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

  it("does not record events from a test-mode browser", async () => {
    const response = await tagTap(request("/api/smart-sign/NS-0006/tap", "tapbox-test-mode=1"), { params: { tagCode: "NS-0006" } });
    expect(await response.json()).toEqual({ recorded: false, isLive: false });
    expect(createEvent).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
    expect(startVisit).not.toHaveBeenCalled();

    const legacyResponse = await signTap(request("/api/tap/SPF-S-0005/tap", "tapbox-test-mode=1"), { params: { signId: "SPF-S-0005" } });
    expect(await legacyResponse.json()).toEqual({ recorded: false, isLive: false });
    expect(createEvent).not.toHaveBeenCalled();
  });

  it("records a shared-link visit without notifying the realtor", async () => {
    const response = await tagTap(request("/api/smart-sign/NS-0006/tap", undefined, false, false, "share"), { params: { tagCode: "NS-0006" } });
    expect(response.status).toBe(202);
    expect((await response.json()).recorded).toBe(true);
    expect(createEvent).toHaveBeenCalledTimes(1);
    expect(sendEmail).not.toHaveBeenCalled();
    expect(createEvent.mock.calls[0][0].data.referrer).toContain("tapbox-source=share");
  });

  it("emails the realtor a live-box URL that suppresses its own visit notification", async () => {
    await expect(notifySmartSignLiveForOrder("order-1")).resolves.toBe(true);
    expect(getLiveEmail).toHaveBeenCalledWith(expect.objectContaining({
      viewUrl: "https://app.northshoresignco.com/s/NS-0006?source=share",
    }));
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: "gary@example.com" }));
  });

  it("also handles the legacy sign URL", async () => {
    const response = await signTap(request("/api/tap/SPF-S-0005/tap"), { params: { signId: "SPF-S-0005" } });
    expect(response.headers.get("set-cookie")).toContain("smart-sign-visit-SPF-S-0005");
    expect(sendEmail.mock.calls[0][0].to).toBe("gary@example.com");
  });

  it("returns Discord tracking data for new opens and reloads, not location updates", async () => {
    startVisit.mockResolvedValue("signed-visit-token");
    const path = "/api/smart-sign/NS-0006/tap";
    const first = await tagTap(request(path), { params: { tagCode: "NS-0006" } });
    expect((await first.json()).visitToken).toBe("signed-visit-token");
    expect(startVisit).toHaveBeenCalledWith(expect.objectContaining({ address: "6211 26th Ave NW", tagCode: "NS-0006", scope: "tag:NS-0006", visitedAt: new Date() }));
    await tagTap(request(path, undefined, true), { params: { tagCode: "NS-0006" } });
    expect(startVisit).toHaveBeenCalledTimes(1);
    const reload = await tagTap(request(path, undefined, false, true), { params: { tagCode: "NS-0006" } });
    expect((await reload.json()).visitToken).toBe("signed-visit-token");
    expect(startVisit).toHaveBeenCalledTimes(2);
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  it("never sends Discord notifications for an inactive listing", async () => {
    findSubscription.mockResolvedValue({ status: "CANCELLED" });
    await tagTap(request("/api/smart-sign/NS-0006/tap"), { params: { tagCode: "NS-0006" } });
    expect(startVisit).not.toHaveBeenCalled();
  });

  it.each(["tag", "sign"] as const)("accepts a %s duration report without recording another hit", async (kind) => {
    vi.stubEnv("AUTH_SECRET", "test-only-route-duration-secret");
    const scope = kind === "tag" ? "tag:NS-0006" : "sign:SPF-S-0005";
    const token = await new SignJWT({
      address: "6211 26th Ave NW", tagCode: "NS-0006", visitedAt: new Date().toISOString(), messageId: "987654321", scope,
    }).setProtectedHeader({ alg: "HS256" }).setAudience("tapbox-duration")
      .setIssuedAt().setExpirationTime("24h").sign(new TextEncoder().encode(process.env.AUTH_SECRET));
    vi.advanceTimersByTime(10000);
    const path = kind === "tag" ? "/api/smart-sign/NS-0006/tap" : "/api/tap/SPF-S-0005/tap";
    const durationRequest = new NextRequest(`https://app.northshoresignco.com${path}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visitToken: token, activeMilliseconds: 10000 }),
    });
    const response = kind === "tag"
      ? await tagTap(durationRequest, { params: { tagCode: "NS-0006" } })
      : await signTap(durationRequest, { params: { signId: "SPF-S-0005" } });
    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ updated: true });
    expect(createEvent).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
    expect(startVisit).not.toHaveBeenCalled();
  });
});