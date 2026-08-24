import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calculateInvoiceBalance, calculateTaxAmount } from "@/lib/invoice-totals";
import { sendInvoicePaidDiscordWebhook } from "@/lib/discord";

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = (session.user as { role?: string }).role;
    const invoice = await prisma.invoice.findUnique({
      where: { id: params.id },
      include: { user: { select: { firstName: true, lastName: true } } },
    });
    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }
    if (invoice.qboInvoiceId) {
      return NextResponse.json(
        { error: "Credits cannot be applied to imported QuickBooks invoices" },
        { status: 409 }
      );
    }
    if (role !== "ADMIN" && invoice.userId !== session.user.id) {
      const link = role === "TC"
        ? await prisma.tCAgentLink.findUnique({
            where: {
              tcUserId_agentUserId: {
                tcUserId: session.user.id,
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
    if (!["SENT", "VIEWED", "OVERDUE"].includes(invoice.status)) {
      return NextResponse.json({ error: "Invoice is not payable" }, { status: 409 });
    }

    const balanceCents = calculateInvoiceBalance(invoice);
    if (balanceCents <= 0) {
      return NextResponse.json({ error: "Invoice has no balance due" }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const credit = await tx.coupon.findFirst({
        where: {
          assignedUserId: invoice.userId,
          isCredit: true,
          isActive: true,
          remainingValue: { gt: 0 },
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        orderBy: { createdAt: "asc" },
      });

      if (!credit) {
        throw new Error("No active credit is available for this invoice");
      }

      const creditCents = Math.round((credit.remainingValue || 0) * 100);
      const appliedCents = Math.min(balanceCents, creditCents);
      const appliedDollars = appliedCents / 100;
      const remainingCredit = Math.max(0, (credit.remainingValue || 0) - appliedDollars);
      const newDiscountAmount = (invoice.discountAmount || 0) + appliedCents;
      const newTaxAmount = calculateTaxAmount(
        invoice.amount || 0,
        newDiscountAmount,
        invoice.taxRateBps
      );
      const newBalance = calculateInvoiceBalance({
        ...invoice,
        discountAmount: newDiscountAmount,
        taxAmount: newTaxAmount,
      });

      await tx.coupon.update({
        where: { id: credit.id },
        data: {
          remainingValue: remainingCredit,
          usedCount: { increment: 1 },
          isActive: remainingCredit > 0,
        },
      });

      const updatedInvoice = await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          discountAmount: newDiscountAmount,
          taxAmount: newTaxAmount,
          ...(newBalance === 0
            ? { status: "PAID", paidAt: new Date(), paidAmount: (invoice.paidAmount || 0) + appliedCents }
            : {}),
        },
      });

      await tx.invoicePayment.create({
        data: {
          invoiceId: invoice.id,
          userId: invoice.userId,
          amount: appliedDollars,
          status: "PAID",
          payerType: "AGENT",
          notes: `Paid with credit ${credit.code}`,
        },
      });

      const remainingCredits = await tx.coupon.aggregate({
        where: {
          assignedUserId: invoice.userId,
          isCredit: true,
          isActive: true,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        _sum: { remainingValue: true },
      });

      return {
        updatedInvoice,
        appliedCents,
        creditCode: credit.code,
        remainingCredit: remainingCredits._sum.remainingValue || 0,
      };
    });

    if (result.updatedInvoice.status === "PAID") {
      sendInvoicePaidDiscordWebhook({
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber || `INV-${invoice.id.slice(0, 8).toUpperCase()}`,
        amountCents: result.appliedCents,
        payerName: `${invoice.user.firstName} ${invoice.user.lastName}`.trim(),
        payerType: "CREDIT",
      }).catch((error) => console.error("Failed to send Discord invoice paid webhook:", error));
    }

    return NextResponse.json({
      success: true,
      invoice: result.updatedInvoice,
      appliedAmount: result.appliedCents,
      creditCode: result.creditCode,
      remainingCredit: result.remainingCredit,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to apply credit";
    if (message === "No active credit is available for this invoice") {
      return NextResponse.json({ error: message }, { status: 409 });
    }
    console.error("Failed to apply invoice credit:", error);
    return NextResponse.json({ error: "Failed to apply credit" }, { status: 500 });
  }
}
