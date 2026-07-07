import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { chargeToken, chargeVaultRecord } from "@/lib/fluidpay";
import { sendEmail } from "@/lib/email";

function buildPaidEmailHtml(recipientName: string, invoiceNumber: string, amountPaid: number) {
  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937;">
      <h2 style="margin-bottom: 12px;">Payment Received</h2>
      <p>Hi ${recipientName},</p>
      <p>We received your payment for invoice <strong>${invoiceNumber}</strong>.</p>
      <ul>
        <li><strong>Amount:</strong> $${amountPaid.toFixed(2)}</li>
      </ul>
      <p>Thank you for your business.</p>
    </div>
  `;
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const role = (session?.user as { role?: string } | undefined)?.role;

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (role !== "REALTOR" && role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const invoiceId = String(body?.invoiceId || "").trim();
    const useVault = Boolean(body?.useVault);
    const token = String(body?.token || "").trim();

    if (!invoiceId) {
      return NextResponse.json({ error: "invoiceId is required" }, { status: 400 });
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            vaultId: true,
          },
        },
      },
    });

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    const isAdmin = role === "ADMIN";
    if (!isAdmin && invoice.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (invoice.status === "PAID" || invoice.status === "VOIDED") {
      return NextResponse.json({ error: "Invoice is not payable" }, { status: 400 });
    }

    const totalDue = Math.max(
      0,
      (invoice.amount || 0) - (invoice.discountAmount || 0) - (invoice.paidAmount || 0)
    );

    if (totalDue <= 0) {
      return NextResponse.json({ error: "Invoice has no balance due" }, { status: 400 });
    }

    const amountCents = Math.round(totalDue * 100);

    const chargeResult = useVault
      ? await (async () => {
          const vaultId = invoice.user.vaultId;
          if (!vaultId) {
            throw new Error("No card on file for this user");
          }
          return chargeVaultRecord(vaultId, amountCents, invoice.id);
        })()
      : await (async () => {
          if (!token) {
            throw new Error("token is required when useVault is false");
          }
          return chargeToken(token, amountCents, invoice.id);
        })();

    await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        status: "PAID",
        paidAt: new Date(),
        paidAmount: (invoice.paidAmount || 0) + totalDue,
        paidByType: useVault ? "VAULT" : "TOKEN",
        paidByUserId: session.user.id,
        fluidpayTransactionId: chargeResult.transactionId,
      },
    });

    const invoiceNumber = invoice.invoiceNumber || `INV-${invoice.id.slice(0, 8).toUpperCase()}`;
    const recipientName = `${invoice.user.firstName || ""} ${invoice.user.lastName || ""}`.trim() || "there";

    try {
      await sendEmail({
        to: invoice.user.email,
        subject: `Payment received for invoice ${invoiceNumber}`,
        html: buildPaidEmailHtml(recipientName, invoiceNumber, totalDue),
      });
    } catch (emailError) {
      console.error("Payment email failed:", emailError);
    }

    return NextResponse.json({ success: true, transactionId: chargeResult.transactionId });
  } catch (error) {
    console.error("Failed to charge invoice:", error);
    const message = error instanceof Error ? error.message : "Failed to charge invoice";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
