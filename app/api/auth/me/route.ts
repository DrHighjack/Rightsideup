import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/mobile-auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/auth/me
 * Lets the iOS app rehydrate its session on cold launch from a stored mobile JWT
 * without forcing a re-login every time.
 */
export async function GET(request: NextRequest) {
  const requestUser = await getRequestUser(request);
  if (!requestUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: requestUser.id },
    select: { id: true, email: true, firstName: true, lastName: true, phone: true, role: true },
  });

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json(user);
}
