import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calculateInvoiceBalance } from "@/lib/invoice-totals";
import { getPaymentConfirmationEmail, sendEmail } from "@/lib/email";
import { sendInvoicePaidDiscordWebhook } from "@/lib/discord";
import { invoicePaySchema } from "@/lib/schemas";
import { ZodError } from "zod";

function uniqueEmails(emails: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      emails
        .map((email) => (typeof email === "string" ? email.trim().toLowerCase() : ""))
        .filter(Boolean)
    )
  );
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
    const actorUserId = session.user.id;

    const parsedBody = invoicePaySchema.parse(await request.json());
    const paymentCardId = parsedBody.paymentCardId.trim();
    const payerType = parsedBody.payerType;

    const invoice = await prisma.invoice.findUnique({
      where: { id: params.id },
      include: {
        user: {
          include: {
            brokerage: {
              select: {
                id: true,
                name: true,
                email: true,
                admin: {
                  select: { id: true, email: true, firstName: true, lastName: true },
                },
              },
            },
          },
        },
      },
    });

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    const isOwner = invoice.userId === actorUserId;
    const isAdmin = session.user.role === "ADMIN";

    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!["SENT", "VIEWED", "OVERDUE"].includes(invoice.status)) {
      return NextResponse.json({ error: "Invoice is not payable" }, { status: 409 });
    }

    const card = await prisma.paymentCard.findUnique({
      where: { id: paymentCardId },
      select: {
        id: true,
        userId: true,
        nickname: true,
      },
    });

    if (!card || card.userId !== actorUserId) {
      return NextResponse.json({ error: "Payment method not found" }, { status: 404 });
    }

    const totalDue = calculateInvoiceBalance(invoice);
    if (totalDue <= 0) {
      return NextResponse.json({ error: "Invoice is already paid" }, { status: 400 });
    }

    const paidInvoice = await prisma.$transaction(async (tx) => {
      const payment = await tx.invoicePayment.create({
        data: {
          invoiceId: invoice.id,
          userId: actorUserId,
          paymentCardId: card.id,
          amount: totalDue,
          status: "PAID",
          payerType,
          notes: `Charged card ${card.nickname}`,
        },
      });

      const updated = await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          status: "PAID",
          paidAt: new Date(),
          paidAmount: (invoice.paidAmount || 0) + totalDue,
          paidByType: payerType,
          paidByUserId: session.user!.id,
          paymentCardId: card.id,
          paymentCardNickname: card.nickname,
        },
      });

      await tx.invoicePaymentSchedule.updateMany({
        where: { invoiceId: invoice.id, isActive: true },
        data: { isActive: false },
      });

      return { payment, updated };
    });

    const tcLinks = await prisma.tCAgentLink.findMany({
      where: { agentUserId: invoice.userId },
      select: {
        tcUser: {
          select: { email: true, firstName: true, lastName: true },
        },
      },
    });

    const invoiceNumber = invoice.invoiceNumber || `INV-${invoice.id.slice(0, 8).toUpperCase()}`;
    const brokerageEmail = invoice.user.brokerage?.email || invoice.user.brokerage?.admin?.email || null;
    const tcEmails = tcLinks.map((link) => link.tcUser.email);

    const notifyAgent = payerType !== "BROKERAGE";
    const recipients = uniqueEmails([
      ...(notifyAgent ? [invoice.user.email] : []),
      brokerageEmail,
      ...tcEmails,
    ]);

    await Promise.all(
      recipients.map((email) => {
        const paymentEmail = getPaymentConfirmationEmail({
          recipientName: email === invoice.user.email
            ? `${invoice.user.firstName} ${invoice.user.lastName}`.trim()
            : "Team",
          invoiceNumber,
          amountPaid: totalDue,
          payerType,
        });
        return sendEmail({
          to: email,
          subject: paymentEmail.subject,
          html: paymentEmail.html,
        }).catch((emailError) => {
          console.error(`Failed to send payment confirmation to ${email}:`, emailError);
        });
      })
    );

    sendInvoicePaidDiscordWebhook({
      invoiceId: invoice.id,
      invoiceNumber,
      amountCents: totalDue,
      payerName: `${invoice.user.firstName} ${invoice.user.lastName}`.trim(),
      payerType,
    }).catch((error) => console.error("Failed to send Discord invoice paid webhook:", error));

    return NextResponse.json({
      success: true,
      invoice: paidInvoice.updated,
      payment: paidInvoice.payment,
      emailed: recipients,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.flatten() }, { status: 400 });
    }
    console.error("Failed to pay invoice:", error);
    return NextResponse.json({ error: "Failed to pay invoice" }, { status: 500 });
  }
}
