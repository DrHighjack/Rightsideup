import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await auth();
    const role = (session?.user as { role?: string } | undefined)?.role;

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (role !== "REALTOR") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { vaultId: true, paymentCardLast4: true, paymentCardNickname: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const cards = await prisma.savedPaymentMethod.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "asc" },
      select: { id: true, last4: true, nickname: true, createdAt: true },
    });

    return NextResponse.json({ cards, hasCard: cards.length > 0 || Boolean(user.vaultId) });
  } catch (error) {
    console.error("Failed to check card-on-file:", error);
    return NextResponse.json({ error: "Failed to check card on file" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    const role = (session?.user as { role?: string } | undefined)?.role;

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (role !== "REALTOR") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await request.json()) as { cardId?: unknown; nickname?: unknown };
    const cardId = typeof body.cardId === "string" ? body.cardId : "";
    const nickname = typeof body.nickname === "string" ? body.nickname.trim() : "";
    if (nickname.length > 60) {
      return NextResponse.json({ error: "Nickname must be 60 characters or fewer" }, { status: 400 });
    }

    if (cardId) {
      const card = await prisma.savedPaymentMethod.updateMany({
        where: { id: cardId, userId: session.user.id },
        data: { nickname: nickname || null },
      });
      if (!card.count) return NextResponse.json({ error: "Payment method not found" }, { status: 404 });
    } else {
      await prisma.user.update({
        where: { id: session.user.id },
        data: { paymentCardNickname: nickname || null },
      });
    }

    return NextResponse.json({ nickname: nickname || null });
  } catch (error) {
    console.error("Failed to update card nickname:", error);
    return NextResponse.json({ error: "Failed to save card nickname" }, { status: 500 });
  }
}
