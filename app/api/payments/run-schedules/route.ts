import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function nextRunDate(dayOfMonth: number) {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const maxDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  next.setDate(Math.min(dayOfMonth, maxDay));
  next.setHours(9, 0, 0, 0);
  return next;
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization") || "";
    const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    const cronSecret = process.env.CRON_SECRET;

    const session = await auth();
    const isAdmin = (session?.user as any)?.role === "ADMIN";
    const isCron = Boolean(cronSecret && bearer && bearer === cronSecret);

    if (!isAdmin && !isCron) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dueSchedules = await prisma.invoicePaymentSchedule.findMany({
      where: {
        isActive: true,
        nextRunAt: { lte: new Date() },
      },
      include: {
        invoice: true,
        paymentCard: {
          select: { id: true, nickname: true },
        },
      },
      take: 100,
    });

    const results: Array<{ scheduleId: string; status: string; reason?: string }> = [];

    for (const schedule of dueSchedules) {
      const invoice = schedule.invoice;
      if (!invoice) {
        results.push({ scheduleId: schedule.id, status: "skipped", reason: "invoice-not-found" });
        continue;
      }

      const totalDue = Math.max(0, (invoice.amount || 0) - (invoice.discountAmount || 0) - (invoice.paidAmount || 0));
      if (totalDue <= 0 || invoice.status === "PAID" || invoice.status === "VOIDED") {
        await prisma.invoicePaymentSchedule.update({ where: { id: schedule.id }, data: { isActive: false } });
        results.push({ scheduleId: schedule.id, status: "skipped", reason: "invoice-closed" });
        continue;
      }

      await prisma.$transaction(async (tx) => {
        await tx.invoicePayment.create({
          data: {
            invoiceId: invoice.id,
            userId: schedule.userId,
            paymentCardId: schedule.paymentCardId,
            amount: totalDue,
            status: "PAID",
            payerType: "AGENT",
            notes: `Scheduled payment using ${schedule.paymentCard.nickname}`,
          },
        });

        await tx.invoice.update({
          where: { id: invoice.id },
          data: {
            status: "PAID",
            paidAt: new Date(),
            paidAmount: (invoice.paidAmount || 0) + totalDue,
            paidByType: "AGENT",
            paidByUserId: schedule.userId,
            paymentCardId: schedule.paymentCardId,
            paymentCardNickname: schedule.paymentCard.nickname,
          },
        });

        await tx.invoicePaymentSchedule.update({
          where: { id: schedule.id },
          data: {
            isActive: schedule.recurring,
            nextRunAt: schedule.recurring ? nextRunDate(schedule.dayOfMonth) : schedule.nextRunAt,
          },
        });
      });

      results.push({ scheduleId: schedule.id, status: "paid" });
    }

    return NextResponse.json({ success: true, processed: results.length, results });
  } catch (error) {
    console.error("Failed to process scheduled payments:", error);
    return NextResponse.json({ error: "Failed to process scheduled payments" }, { status: 500 });
  }
}
