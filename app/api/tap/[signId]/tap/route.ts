import { NextRequest, NextResponse } from "next/server";
import { recordSmartSignTap } from "@/lib/smart-sign";
import { z } from "zod";

const tapSchema = z.object({
  latitude: z.number().finite().min(-90).max(90).optional(),
  longitude: z.number().finite().min(-180).max(180).optional(),
  deviceType: z.string().trim().max(30).optional(),
  isReload: z.boolean().optional(),
});

export async function POST(request: NextRequest, { params }: { params: { signId: string } }) {
  const parsed = tapSchema.safeParse(await request.json().catch(() => ({})));
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
  const response = NextResponse.json({ recorded: result.recorded, isLive: result.isLive }, { status: 202 });
  if ("visitId" in result && result.visitId) {
    response.cookies.set(`smart-sign-visit-${params.signId}`, result.visitId, { httpOnly: true, sameSite: "lax", secure: request.nextUrl.protocol === "https:", path: "/", maxAge: 90 * 24 * 60 * 60 });
  }
  return response;
}
