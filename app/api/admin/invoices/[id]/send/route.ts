import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { getNewInvoiceEmail } from "@/lib/email";

/**
 * POST /api/admin/invoices/[id]/send
 * Send an invoice to the user
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id: params.id },
      include: {
        user: {
          include: {
            brokerage: {
              select: {
                email: true,
                admin: {
                  select: {
                    email: true,
                  },
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

    // Update invoice status to SENT
    const updated = await prisma.invoice.update({
      where: { id: params.id },
      data: {
        status: "SENT",
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            brokerage: {
              select: {
                email: true,
                admin: {
                  select: {
                    email: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    // TODO: Send email notification to user
    // TODO: Create notification record

    const response = {
      success: true,
      message: "Invoice sent successfully",
      invoice: {
        ...updated,
        user: {
          ...updated.user,
          name: `${updated.user.firstName} ${updated.user.lastName}`.trim(),
        },
      },
    };

    // Send new invoice email
    try {
      const tcLinks = await prisma.tCAgentLink.findMany({
        where: { agentUserId: updated.user.id },
        select: { tcUser: { select: { email: true } } },
      });

      const shouldSendToAgent = updated.paidByType !== "BROKERAGE";
      const recipientList = Array.from(
        new Set(
          [
            ...(shouldSendToAgent ? [updated.user.email] : []),
            updated.user.brokerage?.email,
            updated.user.brokerage?.admin?.email,
            ...tcLinks.map((link) => link.tcUser.email),
          ]
            .filter((email): email is string => Boolean(email))
            .map((email) => email.toLowerCase())
        )
      );

      const invoiceEmail = getNewInvoiceEmail(
        updated.user.firstName,
        `INV-${updated.id.slice(0, 8).toUpperCase()}`,
        new Date(updated.createdAt).toLocaleDateString(),
        updated.dueDate ? new Date(updated.dueDate).toLocaleDateString() : "Not specified",
        "Service provided",
        ((updated.amount || 0) / 100).toFixed(2),
        `${process.env.NEXTAUTH_URL}/admin/invoices/${updated.id}`
      );

      await sendEmail({
        to: recipientList,
        subject: invoiceEmail.subject,
        html: invoiceEmail.html,
      });
    } catch (emailError) {
      console.error("Failed to send invoice email:", emailError);
      // Don't fail if email fails
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("Failed to send invoice:", error);
    return NextResponse.json(
      { error: "Failed to send invoice" },
      { status: 500 }
    );
  }
}
