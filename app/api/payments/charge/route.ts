import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { chargeToken, chargeVaultRecord } from "@/lib/fluidpay";
import { calculateInvoiceBalance } from "@/lib/invoice-totals";
import { getPaymentConfirmationEmail, sendEmail } from "@/lib/email";
import { sendInvoicePaidDiscordWebhook } from "@/lib/discord";
import { paymentChargeSchema } from "@/lib/schemas";
import { ZodError } from "zod";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const role = session?.user?.role;

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const actorUserId = session.user.id;

    if (role !== "REALTOR" && role !== "TC" && role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const parsedBody = paymentChargeSchema.parse(await request.json());
    const invoiceId = parsedBody.invoiceId.trim();
    const useVault = parsedBody.useVault;
    const savedPaymentMethodId = parsedBody.savedPaymentMethodId;
    const token = parsedBody.token.trim();

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
    if (!isAdmin && invoice.userId !== actorUserId) {
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

    if (invoice.status === "PAID" || invoice.status === "VOIDED") {
      return NextResponse.json({ error: "Invoice is not payable" }, { status: 400 });
    }

    const totalDue = calculateInvoiceBalance(invoice);

    if (totalDue <= 0) {
      return NextResponse.json({ error: "Invoice has no balance due" }, { status: 400 });
    }

    const amountCents = Math.round(totalDue);

    const chargeResult = useVault
      ? await (async () => {
          if (savedPaymentMethodId) {
            const allowedOwnerIds = new Set([invoice.userId]);
            if (role === "TC") allowedOwnerIds.add(actorUserId);

            if (savedPaymentMethodId.startsWith("legacy:")) {
              const ownerId = savedPaymentMethodId.slice("legacy:".length);
              if (!allowedOwnerIds.has(ownerId) && !isAdmin) {
                throw new Error("Saved payment method is not available for this invoice");
              }
              const owner = await prisma.user.findUnique({
                where: { id: ownerId },
                select: { id: true, vaultId: true },
              });
              if (!owner?.vaultId) {
                throw new Error("Saved payment method is not available for this invoice");
              }
              return chargeVaultRecord(owner.id, owner.vaultId, amountCents, invoice.id);
            }

            const savedMethod = await prisma.savedPaymentMethod.findUnique({
              where: { id: savedPaymentMethodId },
              select: { userId: true, fluidpayPaymentMethodId: true },
            });
            if (isAdmin) allowedOwnerIds.add(savedMethod?.userId || "");
            if (!savedMethod || !allowedOwnerIds.has(savedMethod.userId)) {
              throw new Error("Saved payment method is not available for this invoice");
            }
            return chargeVaultRecord(
              savedMethod.userId,
              savedMethod.fluidpayPaymentMethodId,
              amountCents,
              invoice.id
            );
          }
          const vaultId = invoice.user.vaultId;
          if (!vaultId) {
            throw new Error("No card on file for this user");
          }
          return chargeVaultRecord(invoice.user.id, vaultId, amountCents, invoice.id);
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
        paidByUserId: actorUserId,
        fluidpayTransactionId: chargeResult.transactionId,
      },
    });

    const invoiceNumber = invoice.invoiceNumber || `INV-${invoice.id.slice(0, 8).toUpperCase()}`;
    const recipientName = `${invoice.user.firstName || ""} ${invoice.user.lastName || ""}`.trim() || "there";

    try {
      const email = getPaymentConfirmationEmail({
        recipientName,
        invoiceNumber,
        amountPaid: totalDue,
      });
      await sendEmail({
        to: invoice.user.email,
        subject: email.subject,
        html: email.html,
      });
    } catch (emailError) {
      console.error("Payment email failed:", emailError);
    }

    sendInvoicePaidDiscordWebhook({
      invoiceId: invoice.id,
      invoiceNumber,
      amountCents: totalDue,
      payerName: recipientName,
      payerType: useVault ? "VAULT" : "TOKEN",
    }).catch((error) => console.error("Failed to send Discord invoice paid webhook:", error));

    return NextResponse.json({ success: true, transactionId: chargeResult.transactionId });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.flatten() }, { status: 400 });
    }
    console.error("Failed to charge invoice:", error);
    const message = error instanceof Error ? error.message : "Failed to charge invoice";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
