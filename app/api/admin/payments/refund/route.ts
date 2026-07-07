import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { refundTransaction } from "@/lib/fluidpay";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const role = (session?.user as { role?: string } | undefined)?.role;

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const invoiceId = String(body?.invoiceId || "").trim();
    const amountCents = Number(body?.amountCents);

    if (!invoiceId || !Number.isFinite(amountCents) || amountCents <= 0) {
      return NextResponse.json({ error: "invoiceId and amountCents are required" }, { status: 400 });
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: {
        id: true,
        fluidpayTransactionId: true,
      },
    });

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    if (!invoice.fluidpayTransactionId) {
      return NextResponse.json({ error: "Invoice does not have a FluidPay transaction" }, { status: 400 });
    }

    await refundTransaction(invoice.fluidpayTransactionId, amountCents);

    await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        status: "VOIDED",
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to refund invoice:", error);
    const message = error instanceof Error ? error.message : "Failed to refund invoice";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
