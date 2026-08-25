import { NextRequest, NextResponse } from "next/server";
import { recordSmartSignTap } from "@/lib/smart-sign";
import { z } from "zod";

const tapSchema = z.object({
  latitude: z.number().finite().min(-90).max(90).optional(),
  longitude: z.number().finite().min(-180).max(180).optional(),
  deviceType: z.string().trim().max(30).optional(),
});

export async function POST(request: NextRequest, { params }: { params: { tagCode: string } }) {
  const parsed = tapSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid tap event" }, { status: 400 });

  const result = await recordSmartSignTap({ tagCode: params.tagCode, ...parsed.data });
  return NextResponse.json(result, { status: 202 });
}
