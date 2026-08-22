import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    const role = (session?.user as { role?: string } | undefined)?.role;

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const actorUserId = session.user.id;
    if (role !== "REALTOR" && role !== "TC") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const invoiceId = new URL(request.url).searchParams.get("invoiceId");
    let invoiceOwnerId: string | null = null;

    if (invoiceId) {
      const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
        select: { userId: true },
      });
      if (!invoice) {
        return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
      }

      if (invoice.userId !== actorUserId) {
        const link = role === "TC"
          ? await prisma.tCAgentLink.findUnique({
              where: {
                tcUserId_agentUserId: {
                  tcUserId: actorUserId,
                  agentUserId: invoice.userId,
                },
              },
              select: { id: true },
            })
          : null;
        if (!link) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
      }
      invoiceOwnerId = invoice.userId;
    }

    const cardOwnerIds = Array.from(new Set([actorUserId, invoiceOwnerId].filter(Boolean))) as string[];

    const cardOwners = await prisma.user.findMany({
      where: { id: { in: cardOwnerIds } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        vaultId: true,
        paymentCardLast4: true,
        paymentCardNickname: true,
      },
    });

    if (!cardOwners.some((owner) => owner.id === actorUserId)) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const cards = await prisma.savedPaymentMethod.findMany({
      where: { userId: { in: cardOwnerIds } },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        userId: true,
        fluidpayPaymentMethodId: true,
        last4: true,
        nickname: true,
        createdAt: true,
        user: { select: { firstName: true, lastName: true } },
      },
    });

    const accountCredits = await prisma.coupon.aggregate({
      where: {
        assignedUserId: actorUserId,
        isCredit: true,
        isActive: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      _sum: { remainingValue: true },
    });

    const labeledCards = cards.map((card) => ({
      id: card.id,
      last4: card.last4,
      nickname: card.nickname,
      createdAt: card.createdAt,
      ownerType: card.userId === actorUserId ? "SELF" : "AGENT",
      ownerName:
        `${card.user.firstName || ""} ${card.user.lastName || ""}`.trim() ||
        (card.userId === actorUserId ? "My account" : "Agent"),
    }));

    for (const owner of cardOwners) {
      const vaultAlreadyListed = cards.some(
        (card) => card.fluidpayPaymentMethodId === owner.vaultId
      );
      if (owner.vaultId && !vaultAlreadyListed) {
        labeledCards.push({
          id: `legacy:${owner.id}`,
          last4: owner.paymentCardLast4,
          nickname: owner.paymentCardNickname,
          createdAt: new Date(0),
          ownerType: owner.id === actorUserId ? "SELF" : "AGENT",
          ownerName:
            `${owner.firstName || ""} ${owner.lastName || ""}`.trim() ||
            (owner.id === actorUserId ? "My account" : "Agent"),
        });
      }
    }

    return NextResponse.json({
      cards: labeledCards,
      hasCard: labeledCards.length > 0,
      accountCreditAmount: accountCredits._sum.remainingValue || 0,
    });
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
    if (role !== "REALTOR" && role !== "TC") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await request.json()) as { cardId?: unknown; nickname?: unknown };
    const cardId = typeof body.cardId === "string" ? body.cardId : "";
    const nickname = typeof body.nickname === "string" ? body.nickname.trim() : "";
    if (nickname.length > 60) {
      return NextResponse.json({ error: "Nickname must be 60 characters or fewer" }, { status: 400 });
    }

    if (cardId.startsWith("legacy:")) {
      const ownerId = cardId.slice("legacy:".length);
      if (ownerId !== session.user.id) {
        return NextResponse.json({ error: "Payment method not found" }, { status: 404 });
      }
      await prisma.user.update({
        where: { id: session.user.id },
        data: { paymentCardNickname: nickname || null },
      });
    } else if (cardId) {
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
