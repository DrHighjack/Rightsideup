import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { refundTransaction } from "@/lib/fluidpay";
import { adminPaymentRefundSchema } from "@/lib/schemas";
import { ZodError } from "zod";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const role = session?.user?.role;

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const parsedBody = adminPaymentRefundSchema.parse(await request.json());
    const invoiceId = parsedBody.invoiceId.trim();
    const amountCents = parsedBody.amountCents;

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
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.flatten() }, { status: 400 });
    }
    console.error("Failed to refund invoice:", error);
    const message = error instanceof Error ? error.message : "Failed to refund invoice";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
