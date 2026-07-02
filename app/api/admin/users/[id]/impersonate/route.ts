import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateAdminImpersonationToken } from "@/lib/admin-impersonation";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();

    if (!session?.user?.id || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        email: true,
        role: true,
        tags: true,
      },
    });

    if (!targetUser || targetUser.role !== "REALTOR") {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    if (targetUser.tags.includes("INACTIVE")) {
      return NextResponse.json(
        { error: "Cannot generate login link for an inactive client" },
        { status: 400 }
      );
    }

    const token = await generateAdminImpersonationToken(
      session.user.id,
      targetUser.id
    );

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
    const loginUrl = `${appUrl}/login?impersonationToken=${encodeURIComponent(token)}`;

    return NextResponse.json({
      loginUrl,
      email: targetUser.email,
      expiresInMinutes: 10,
    });
  } catch (error) {
    console.error("Failed to generate client login link:", error);
    return NextResponse.json(
      { error: "Failed to generate login link" },
      { status: 500 }
    );
  }
}
