import { NextRequest, NextResponse } from "next/server";
import { recordSmartSignTap } from "@/lib/smart-sign";
import { updateTapboxDiscordVisit } from "@/lib/tapbox-visit";
import { TAPBOX_TEST_MODE_COOKIE } from "@/lib/tapbox-tracking";
import { z } from "zod";

const tapSchema = z.object({
  latitude: z.number().finite().min(-90).max(90).optional(),
  longitude: z.number().finite().min(-180).max(180).optional(),
  deviceType: z.string().trim().max(30).optional(),
  isReload: z.boolean().optional(),
  source: z.enum(["box", "share"]).optional(),
});

export async function POST(request: NextRequest, { params }: { params: { signId: string } }) {
  const body = await request.json().catch(() => ({}));
  const isDurationUpdate = body !== null && typeof body === "object" && "visitToken" in body;
  if (request.cookies.get(TAPBOX_TEST_MODE_COOKIE)?.value === "1") {
    return NextResponse.json(isDurationUpdate ? { updated: false } : { recorded: false, isLive: false }, { status: 202 });
  }
  if (isDurationUpdate) {
    return updateTapboxDiscordVisit(body, `sign:${params.signId}`);
  }
  const parsed = tapSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid tap event" }, { status: 400 });

  const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "";
  const referrer = request.headers.get("referer") || "";
  const userAgent = request.headers.get("user-agent") || "";

  const result = await recordSmartSignTap({
    signId: params.signId,
    previousVisitId: request.cookies.get(`smart-sign-visit-${params.signId}`)?.value,
    ...parsed.data,
    userAgent,
    referrer,
    ip,
  });
  const response = NextResponse.json({ recorded: result.recorded, isLive: result.isLive, ...("visitToken" in result && result.visitToken ? { visitToken: result.visitToken } : {}) }, { status: 202 });
  if ("visitId" in result && result.visitId) {
    response.cookies.set(`smart-sign-visit-${params.signId}`, result.visitId, { httpOnly: true, sameSite: "lax", secure: request.nextUrl.protocol === "https:", path: "/", maxAge: 90 * 24 * 60 * 60 });
  }
  return response;
}
