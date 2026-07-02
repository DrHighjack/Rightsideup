import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function computeNextRunDate(dayOfMonth: number) {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth(), 1);
  const maxDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  next.setDate(Math.min(dayOfMonth, maxDay));
  next.setHours(9, 0, 0, 0);

  if (next <= now) {
    const following = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const maxFollowing = new Date(following.getFullYear(), following.getMonth() + 1, 0).getDate();
    following.setDate(Math.min(dayOfMonth, maxFollowing));
    following.setHours(9, 0, 0, 0);
    return following;
  }

  return next;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id: params.id },
      select: { id: true, userId: true },
    });

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    if (invoice.userId !== session.user.id && (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const schedules = await prisma.invoicePaymentSchedule.findMany({
      where: { invoiceId: params.id },
      include: {
        paymentCard: {
          select: {
            id: true,
            nickname: true,
            cardBrand: true,
            cardLast4: true,
            expMonth: true,
            expYear: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ schedules });
  } catch (error) {
    console.error("Failed to fetch payment schedules:", error);
    return NextResponse.json({ error: "Failed to fetch payment schedules" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const paymentCardId = String(body.paymentCardId || "").trim();
    const dayOfMonth = Number(body.dayOfMonth);
    const recurring = Boolean(body.recurring);

    if (!paymentCardId || !Number.isInteger(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 28) {
      return NextResponse.json(
        { error: "paymentCardId and dayOfMonth (1-28) are required" },
        { status: 400 }
      );
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id: params.id },
      select: { id: true, userId: true, status: true },
    });

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    if (invoice.userId !== session.user.id && (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (invoice.status === "PAID" || invoice.status === "VOIDED") {
      return NextResponse.json({ error: "Cannot schedule payment for closed invoice" }, { status: 400 });
    }

    const card = await prisma.paymentCard.findUnique({
      where: { id: paymentCardId },
      select: { id: true, userId: true },
    });

    if (!card || card.userId !== session.user.id) {
      return NextResponse.json({ error: "Payment method not found" }, { status: 404 });
    }

    const schedule = await prisma.invoicePaymentSchedule.create({
      data: {
        invoiceId: invoice.id,
        userId: session.user.id,
        paymentCardId,
        dayOfMonth,
        recurring,
        nextRunAt: computeNextRunDate(dayOfMonth),
        isActive: true,
      },
      include: {
        paymentCard: {
          select: {
            id: true,
            nickname: true,
            cardBrand: true,
            cardLast4: true,
            expMonth: true,
            expYear: true,
          },
        },
      },
    });

    return NextResponse.json({ schedule }, { status: 201 });
  } catch (error) {
    console.error("Failed to create payment schedule:", error);
    return NextResponse.json({ error: "Failed to create payment schedule" }, { status: 500 });
  }
}
