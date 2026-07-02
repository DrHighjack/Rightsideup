import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";

function uniqueEmails(emails: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      emails
        .map((email) => (typeof email === "string" ? email.trim().toLowerCase() : ""))
        .filter(Boolean)
    )
  );
}

function buildPaidEmailHtml(recipientName: string, invoiceNumber: string, amountPaid: number, payerType: string) {
  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937;">
      <h2 style="margin-bottom: 12px;">Invoice Payment Received</h2>
      <p>Hi ${recipientName},</p>
      <p>We received a payment for invoice <strong>${invoiceNumber}</strong>.</p>
      <ul>
        <li><strong>Amount:</strong> $${amountPaid.toFixed(2)}</li>
        <li><strong>Paid By:</strong> ${payerType}</li>
      </ul>
      <p>Thank you.</p>
    </div>
  `;
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

    const body = await request.json();
    const paymentCardId = String(body.paymentCardId || "").trim();
    const payerType = body.payerType === "BROKERAGE" ? "BROKERAGE" : "AGENT";

    if (!paymentCardId) {
      return NextResponse.json({ error: "paymentCardId is required" }, { status: 400 });
    }

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
    const isAdmin = (session.user as any).role === "ADMIN";

    let isLinkedTc = false;
    if (!isOwner && !isAdmin) {
      const link = await prisma.tCAgentLink.findUnique({
        where: {
          tcUserId_agentUserId: {
            tcUserId: actorUserId,
            agentUserId: invoice.userId,
          },
        },
      });
      isLinkedTc = Boolean(link);
    }

    if (!isOwner && !isAdmin && !isLinkedTc) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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

    const totalDue = Math.max(0, (invoice.amount || 0) - (invoice.discountAmount || 0) - (invoice.paidAmount || 0));
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
      recipients.map((email) =>
        sendEmail({
          to: email,
          subject: `Invoice ${invoiceNumber} paid`,
          html: buildPaidEmailHtml(
            email === invoice.user.email
              ? `${invoice.user.firstName} ${invoice.user.lastName}`.trim()
              : "Team",
            invoiceNumber,
            totalDue,
            payerType
          ),
        })
      )
    );

    return NextResponse.json({
      success: true,
      invoice: paidInvoice.updated,
      payment: paidInvoice.payment,
      emailed: recipients,
    });
  } catch (error) {
    console.error("Failed to pay invoice:", error);
    return NextResponse.json({ error: "Failed to pay invoice" }, { status: 500 });
  }
}
