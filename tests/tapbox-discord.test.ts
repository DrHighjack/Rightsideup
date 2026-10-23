import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { setting } = vi.hoisted(() => ({ setting: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { appSettings: { findUnique: setting } } }));
vi.mock("@/lib/encryption", () => ({ decryptToken: (value: string) => value }));
import { sendTapboxVisitDiscordWebhook } from "@/lib/discord";
import { startTapboxDiscordVisit, updateTapboxDiscordVisit } from "@/lib/tapbox-visit";

describe("Tapbox Discord notifications", () => {
  const visit = { address: "123 Test St, Seattle", tagCode: "NS-0006", visitedAt: "2026-10-14T17:00:00Z" };

  beforeEach(() => {
    setting.mockReset().mockResolvedValue(null);
    vi.stubEnv("DISCORD_ORDER_WEBHOOK_URL", "https://discord.com/api/webhooks/123/test-only");
    vi.stubEnv("DISCORD_ACTIVITY_WEBHOOK_URL", "");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: "987654321" }) }));
  });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

  it("posts address and visit time and requests a message ID for duration updates", async () => {
    expect(await sendTapboxVisitDiscordWebhook(visit)).toBe("987654321");
    const [url, options] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("https://discord.com/api/webhooks/123/test-only?wait=true");
    expect(options?.method).toBe("POST");
    const body = JSON.parse(options?.body as string);
    expect(body.allowed_mentions).toEqual({ parse: [] });
    expect(body.embeds[0].timestamp).toBe(new Date(visit.visitedAt).toISOString());
    expect(body.embeds[0].fields).toEqual(expect.arrayContaining([
      { name: "Address", value: visit.address },
      expect.objectContaining({ name: "Opened", value: expect.stringMatching(/^<t:\d+:F>$/) }),
      expect.objectContaining({ name: "Time on site", value: expect.stringContaining("Tracking active time") }),
    ]));
  });

  it("updates the existing message with observed duration instead of posting another", async () => {
    await sendTapboxVisitDiscordWebhook({ ...visit, messageId: "987654321", activeSeconds: 85 });
    const [url, options] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("https://discord.com/api/webhooks/123/test-only/messages/987654321");
    expect(options?.method).toBe("PATCH");
    expect(JSON.parse(options?.body as string).embeds[0].fields).toContainEqual({ name: "Time on site", value: "1m 25s (observed active time)" });
  });

  it("honors the Tapbox Visits notification toggle", async () => {
    setting.mockImplementation(async ({ where }: { where: { key: string } }) =>
      where.key === "discord.notify.tapboxVisits" ? { value: "false", isEncrypted: false } : null);
    expect(await sendTapboxVisitDiscordWebhook(visit)).toBeUndefined();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("does not call Discord when no webhook is configured", async () => {
    vi.stubEnv("DISCORD_ORDER_WEBHOOK_URL", "");
    expect(await sendTapboxVisitDiscordWebhook(visit)).toBeUndefined();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("reports Discord failures to its caller", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: false, status: 429 } as Response);
    await expect(sendTapboxVisitDiscordWebhook(visit)).rejects.toThrow("Discord webhook returned 429");
  });

  async function visitToken() {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(visit.visitedAt));
    vi.stubEnv("AUTH_SECRET", "test-only-tapbox-signing-secret");
    return (await startTapboxDiscordVisit({ ...visit, scope: "tag:NS-0006", visitedAt: new Date(visit.visitedAt) }))!;
  }

  it("uses signed visit metadata and clamps duration to server elapsed time", async () => {
    const token = await visitToken();
    vi.advanceTimersByTime(85000);
    const response = await updateTapboxDiscordVisit({ visitToken: token, activeMilliseconds: 900000 }, "tag:NS-0006");
    expect(response.status).toBe(202);
    const options = vi.mocked(fetch).mock.calls[1][1];
    expect(JSON.parse(options?.body as string).embeds[0].fields).toContainEqual({ name: "Time on site", value: "1m 25s (observed active time)" });
  });

  it("rejects forged tokens and tokens used for another box", async () => {
    const token = await visitToken();
    expect((await updateTapboxDiscordVisit({ visitToken: `${token}tampered`, activeMilliseconds: 1000 }, "tag:NS-0006")).status).toBe(401);
    expect((await updateTapboxDiscordVisit({ visitToken: token, activeMilliseconds: 1000 }, "tag:OTHER")).status).toBe(403);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("rejects expired tokens and invalid durations", async () => {
    const token = await visitToken();
    expect((await updateTapboxDiscordVisit({ visitToken: token, activeMilliseconds: -1 }, "tag:NS-0006")).status).toBe(400);
    vi.advanceTimersByTime(86401000);
    expect((await updateTapboxDiscordVisit({ visitToken: token, activeMilliseconds: 1000 }, "tag:NS-0006")).status).toBe(401);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("does not break visit recording when the initial webhook fails", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("Discord unavailable"));
    expect(await startTapboxDiscordVisit({ ...visit, scope: "tag:NS-0006", visitedAt: new Date(visit.visitedAt) })).toBeUndefined();
  });
});