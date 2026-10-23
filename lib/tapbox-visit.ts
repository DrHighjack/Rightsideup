import { SignJWT, jwtVerify } from "jose";
import { z } from "zod";
import { NextResponse } from "next/server";
import { sendTapboxVisitDiscordWebhook } from "@/lib/discord";

const durationSchema = z.object({
  visitToken: z.string().min(1).max(12000),
  activeMilliseconds: z.number().int().min(0).max(86400000),
});
const visitSchema = z.object({
  address: z.string().max(1024),
  tagCode: z.string().max(200),
  scope: z.string().max(300),
  visitedAt: z.string().datetime(),
  messageId: z.string().regex(/^\d+$/),
});

function secret() {
  const value = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!value) throw new Error("AUTH_SECRET is required for Tapbox duration tracking");
  return new TextEncoder().encode(value);
}

export async function startTapboxDiscordVisit(input: {
  address: string;
  tagCode: string;
  scope: string;
  visitedAt: Date;
}) {
  try {
    const messageId = await sendTapboxVisitDiscordWebhook(input);
    if (!messageId) return undefined;
    return await new SignJWT({
      ...input, address: input.address.slice(0, 1024), visitedAt: input.visitedAt.toISOString(), messageId,
    }).setProtectedHeader({ alg: "HS256" }).setAudience("tapbox-duration")
      .setIssuedAt().setExpirationTime("24h").sign(secret());
  } catch (error) {
    console.error("[TAPBOX] Discord visit notification failed:", error);
    return undefined;
  }
}

export async function updateTapboxDiscordVisit(body: unknown, scope: string) {
  const parsed = durationSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid visit duration" }, { status: 400 });
  let visit: z.infer<typeof visitSchema>;
  try {
    const { payload } = await jwtVerify(parsed.data.visitToken, secret(), {
      audience: "tapbox-duration", algorithms: ["HS256"],
    });
    visit = visitSchema.parse(payload);
  } catch {
    return NextResponse.json({ error: "Invalid or expired visit token" }, { status: 401 });
  }
  if (visit.scope !== scope) return NextResponse.json({ error: "Visit does not match this Tapbox" }, { status: 403 });
  const elapsed = Math.max(0, Date.now() - new Date(visit.visitedAt).getTime());
  const activeSeconds = Math.floor(Math.min(parsed.data.activeMilliseconds, elapsed) / 1000);
  try {
    await sendTapboxVisitDiscordWebhook({ ...visit, activeSeconds });
    return NextResponse.json({ updated: true }, { status: 202 });
  } catch (error) {
    console.error("[TAPBOX] Discord duration update failed:", error);
    return NextResponse.json({ error: "Duration update unavailable" }, { status: 503 });
  }
}