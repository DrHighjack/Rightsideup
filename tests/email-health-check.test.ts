import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import vercelConfig from "../vercel.json";

const { sendEmail } = vi.hoisted(() => ({ sendEmail: vi.fn() }));

vi.mock("@/lib/email", () => ({ sendEmail }));

import { GET } from "@/app/api/cron/email-health-check/route";

function request() {
  return new NextRequest("https://app.northshoresignco.com/api/cron/email-health-check", {
    headers: { authorization: "Bearer test-secret" },
  });
}

describe("email health check cron", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-15T13:00:00.000Z"));
    vi.stubEnv("CRON_SECRET", "test-secret");
    vi.stubEnv("ADMIN_ALERT_EMAIL", "admin@example.com");
    vi.clearAllMocks();
    sendEmail.mockResolvedValue({ success: true });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it("sends once at 5 AM Pacific during standard time", async () => {
    const response = await GET(request());

    expect(response.status).toBe(200);
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: "admin@example.com",
      subject: "Daily email delivery test",
    }));
  });

  it("sends at the daylight-time UTC schedule too", async () => {
    vi.setSystemTime(new Date("2026-07-15T12:00:00.000Z"));

    const response = await GET(request());

    expect(response.status).toBe(200);
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  it.each(["2026-01-15T12:00:00.000Z", "2026-07-15T13:00:00.000Z"])("skips the other scheduled UTC hour at %s", async (date) => {
    vi.setSystemTime(new Date(date));

    const response = await GET(request());

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ skipped: true });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("requires the cron secret and reports provider failure", async () => {
    const unauthorized = await GET(new NextRequest("https://app.northshoresignco.com/api/cron/email-health-check"));
    expect(unauthorized.status).toBe(401);

    sendEmail.mockResolvedValueOnce({ success: false });
    const failed = await GET(request());
    expect(failed.status).toBe(503);
  });

  it("configures both UTC schedules for 5 AM Pacific", () => {
    expect(vercelConfig.crons.filter((cron) => cron.path === "/api/cron/email-health-check").map((cron) => cron.schedule))
      .toEqual(["0 12 * * *", "0 13 * * *"]);
  });

  it("does not send without an admin recipient", async () => {
    vi.stubEnv("ADMIN_ALERT_EMAIL", "");
    expect((await GET(request())).status).toBe(503);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("does not allow an unset cron secret", async () => {
    vi.stubEnv("CRON_SECRET", "");
    expect((await GET(request())).status).toBe(401);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("reports an email provider exception", async () => {
    sendEmail.mockRejectedValueOnce(new Error("Email service unavailable"));
    expect((await GET(request())).status).toBe(500);
  });
});