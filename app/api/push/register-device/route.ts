import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/mobile-auth";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  token: z.string().min(1),
  platform: z.enum(["ios", "android"]).default("ios"),
});

/**
 * POST /api/push/register-device
 * Stores an APNs device token for the signed-in user so job/order/811
 * events can trigger a push (see lib/apns.ts + lib/notifications.ts).
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getRequestUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const { token, platform } = parsed.data;

    await prisma.deviceToken.upsert({
      where: { token },
      create: { token, platform, userId: user.id },
      update: { userId: user.id, platform },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[PUSH REGISTER-DEVICE] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/** DELETE /api/push/register-device — remove a token on logout. */
export async function DELETE(request: NextRequest) {
  try {
    const user = await getRequestUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = z.object({ token: z.string().min(1) }).safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    await prisma.deviceToken.deleteMany({ where: { token: parsed.data.token, userId: user.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[PUSH REGISTER-DEVICE] Delete error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
