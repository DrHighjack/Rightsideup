import { NextRequest, NextResponse } from "next/server";
import { recordSmartSignTap } from "@/lib/smart-sign";
import { z } from "zod";

const tapSchema = z.object({
  latitude: z.number().finite().min(-90).max(90).optional(),
  longitude: z.number().finite().min(-180).max(180).optional(),
  deviceType: z.string().trim().max(30).optional(),
});

export async function POST(request: NextRequest, { params }: { params: { signId: string } }) {
  const parsed = tapSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid tap event" }, { status: 400 });

  const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "";
  const referrer = request.headers.get("referer") || "";
  const userAgent = request.headers.get("user-agent") || "";

  const result = await recordSmartSignTap({
    signId: params.signId,
    ...parsed.data,
    userAgent,
    referrer,
    ip,
  });
  return NextResponse.json(result, { status: 202 });
}
