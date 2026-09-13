import http2 from "http2";
import { SignJWT, importPKCS8 } from "jose";
import { prisma } from "@/lib/prisma";

let cachedProviderToken: { token: string; issuedAt: number } | null = null;

/** APNs requires a short-lived ES256 JWT signed with your .p8 auth key, refreshed hourly. */
async function getProviderToken(): Promise<string | null> {
  const keyId = process.env.APNS_KEY_ID;
  const teamId = process.env.APNS_TEAM_ID;
  const privateKeyPem = process.env.APNS_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!keyId || !teamId || !privateKeyPem) return null;

  if (cachedProviderToken && Date.now() - cachedProviderToken.issuedAt < 50 * 60 * 1000) {
    return cachedProviderToken.token;
  }

  const key = await importPKCS8(privateKeyPem, "ES256");
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: keyId })
    .setIssuedAt()
    .setIssuer(teamId)
    .sign(key);

  cachedProviderToken = { token, issuedAt: Date.now() };
  return token;
}

interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

function sendToApns(deviceToken: string, payload: PushPayload, providerToken: string, bundleId: string, host: string) {
  return new Promise<void>((resolve) => {
    const client = http2.connect(host);
    client.on("error", (err) => {
      console.error("[APNS] Connection error:", err);
      resolve();
    });

    const req = client.request({
      ":method": "POST",
      ":path": `/3/device/${deviceToken}`,
      authorization: `bearer ${providerToken}`,
      "apns-topic": bundleId,
      "apns-push-type": "alert",
      "content-type": "application/json",
    });

    const body = JSON.stringify({
      aps: { alert: { title: payload.title, body: payload.body }, sound: "default" },
      ...payload.data,
    });

    req.setEncoding("utf8");
    let responseBody = "";
    req.on("data", (chunk) => (responseBody += chunk));
    req.on("end", () => {
      if (responseBody) console.warn("[APNS] Response:", responseBody);
      client.close();
      resolve();
    });
    req.on("error", (err) => {
      console.error("[APNS] Request error:", err);
      client.close();
      resolve();
    });

    req.write(body);
    req.end();
  });
}

/**
 * Best-effort push notification to every registered iOS device for a user.
 * Silently no-ops if APNs isn't configured (env vars unset) so the web app
 * keeps working without push credentials during early development.
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  const bundleId = process.env.APNS_BUNDLE_ID;
  if (!bundleId) return;

  const providerToken = await getProviderToken();
  if (!providerToken) return;

  const host =
    process.env.APNS_ENV === "production"
      ? "https://api.push.apple.com"
      : "https://api.sandbox.push.apple.com";

  const devices = await prisma.deviceToken.findMany({
    where: { userId, platform: "ios" },
    select: { token: true },
  });

  await Promise.all(devices.map((d) => sendToApns(d.token, payload, providerToken, bundleId, host)));
}
