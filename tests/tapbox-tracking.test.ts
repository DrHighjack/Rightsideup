import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { trackTapboxVisit } from "@/lib/tapbox-tracking";

describe("Tapbox browser duration tracking", () => {
  let documentEvents: EventTarget & { visibilityState: string; cookie: string };
  let windowEvents: EventTarget;
  let beacon: ReturnType<typeof vi.fn>;
  let cleanups: (() => void)[];
  const endpoint = "/api/smart-sign/NS-0006/tap";

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-14T17:00:00Z"));
    documentEvents = Object.assign(new EventTarget(), { visibilityState: "visible", cookie: "" });
    windowEvents = Object.assign(new EventTarget(), { setInterval, clearInterval });
    beacon = vi.fn().mockReturnValue(true);
    cleanups = [];
    vi.stubGlobal("document", documentEvents);
    vi.stubGlobal("window", windowEvents);
    vi.stubGlobal("navigator", { userAgent: "iPhone", sendBeacon: beacon });
    vi.stubGlobal("performance", { now: () => Date.now(), getEntriesByType: () => [] });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ recorded: true, isLive: true, visitToken: "signed-token" }) }));
  });
  afterEach(() => {
    cleanups.forEach((cleanup) => cleanup());
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  function start(options?: { source?: "box" | "share"; onBoxVisitRecorded?: () => void }) {
    const cleanup = trackTapboxVisit(endpoint, options);
    cleanups.push(cleanup);
    return cleanup;
  }

  it("reports visible time on background and departure, excluding hidden time", async () => {
    start();
    await vi.advanceTimersByTimeAsync(10000);
    documentEvents.visibilityState = "hidden";
    documentEvents.dispatchEvent(new Event("visibilitychange"));
    expect(JSON.parse(await (beacon.mock.calls[0][1] as Blob).text())).toEqual({ visitToken: "signed-token", activeMilliseconds: 10000 });
    await vi.advanceTimersByTimeAsync(40000);
    documentEvents.visibilityState = "visible";
    documentEvents.dispatchEvent(new Event("visibilitychange"));
    await vi.advanceTimersByTimeAsync(5000);
    windowEvents.dispatchEvent(new Event("pagehide"));
    expect(JSON.parse(await (beacon.mock.calls[1][1] as Blob).text()).activeMilliseconds).toBe(15000);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("updates long visits every 30 seconds", async () => {
    start();
    await vi.advanceTimersByTimeAsync(30000);
    expect(fetch).toHaveBeenCalledTimes(2);
    const options = vi.mocked(fetch).mock.calls[1][1];
    expect(JSON.parse(options?.body as string)).toEqual({ visitToken: "signed-token", activeMilliseconds: 30000 });
    expect(options?.keepalive).toBe(true);
  });

  it("falls back to keepalive fetch when sendBeacon is unavailable", async () => {
    beacon.mockReturnValue(false);
    start();
    await vi.advanceTimersByTimeAsync(5000);
    documentEvents.visibilityState = "hidden";
    documentEvents.dispatchEvent(new Event("visibilitychange"));
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(vi.mocked(fetch).mock.calls[1][1]?.keepalive).toBe(true);
  });

  it("reuses an in-flight opening request across React effect remounts", async () => {
    const cleanup = start();
    cleanup();
    start();
    await vi.advanceTimersByTimeAsync(5000);
    expect(fetch).toHaveBeenCalledTimes(1);
    documentEvents.visibilityState = "hidden";
    documentEvents.dispatchEvent(new Event("visibilitychange"));
    expect(beacon).toHaveBeenCalledTimes(1);
  });

  it("does not send tap events from a test-mode browser", async () => {
    documentEvents.cookie = "tapbox-test-mode=1";
    start();
    await vi.advanceTimersByTimeAsync(30000);
    expect(fetch).not.toHaveBeenCalled();
    expect(beacon).not.toHaveBeenCalled();
  });

  it("marks shared-link visits so they do not notify the realtor", async () => {
    start({ source: "share" });
    expect(JSON.parse(vi.mocked(fetch).mock.calls[0][1]?.body as string)).toMatchObject({ source: "share" });
  });

  it("signals after a live box visit is recorded so the page can switch its URL", async () => {
    const onBoxVisitRecorded = vi.fn();
    start({ source: "box", onBoxVisitRecorded });
    await vi.advanceTimersByTimeAsync(0);
    expect(onBoxVisitRecorded).toHaveBeenCalledTimes(1);
  });
});