import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { renderToBuffer } from "@react-pdf/renderer";
import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import React from "react";

const styles = StyleSheet.create({
  page: { padding: 48, fontFamily: "Helvetica", color: "#0f172a" },
  header: { borderBottom: "2 solid #0f172a", paddingBottom: 18, marginBottom: 28 },
  brand: { fontSize: 20, fontWeight: 700, color: "#0f3d5e" },
  title: { marginTop: 18, fontSize: 26, fontWeight: 700 },
  status: { marginTop: 8, fontSize: 12, fontWeight: 700, color: "#047857" },
  section: { marginBottom: 24 },
  sectionTitle: { marginBottom: 10, fontSize: 13, fontWeight: 700, color: "#475569" },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 9, borderBottom: "1 solid #e2e8f0", fontSize: 11 },
  label: { color: "#64748b" },
  value: { fontWeight: 700 },
  total: { marginTop: 10, padding: 12, flexDirection: "row", justifyContent: "space-between", backgroundColor: "#e0f2fe", fontSize: 14, fontWeight: 700 },
  paid: { marginBottom: 24, padding: 16, border: "2 solid #059669", backgroundColor: "#ecfdf5", color: "#065f46", fontSize: 18, fontWeight: 700, textAlign: "center" },
  footer: { position: "absolute", bottom: 40, left: 48, right: 48, color: "#64748b", fontSize: 9, textAlign: "center" },
});

function money(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

async function canAccessInvoice(userId: string, role: string, invoiceUserId: string) {
  if (role === "ADMIN" || userId === invoiceUserId) return true;
  if (role === "BROKERAGE") {
    const [brokerageUser, invoiceUser] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { brokerageId: true } }),
      prisma.user.findUnique({ where: { id: invoiceUserId }, select: { brokerageId: true } }),
    ]);
    return Boolean(
      brokerageUser?.brokerageId && brokerageUser.brokerageId === invoiceUser?.brokerageId
    );
  }
  if (role !== "TC") return false;
  const link = await prisma.tCAgentLink.findUnique({
    where: { tcUserId_agentUserId: { tcUserId: userId, agentUserId: invoiceUserId } },
    select: { id: true },
  });
  return Boolean(link);
}

function InvoicePdf({ invoice }: { invoice: { invoiceNumber: string | null; amount: number | null; discountAmount: number | null; paidAmount: number | null; status: string; dueDate: Date | null; createdAt: Date; paidAt: Date | null; paidByType: string | null; fluidpayTransactionId: string | null; lineItems: Array<{ description: string; quantity: number; unitAmount: number; totalAmount: number }>; user: { firstName: string; lastName: string; email: string } } }) {
  const amount = invoice.amount || 0;
  const discount = invoice.discountAmount || 0;
  const paid = invoice.paidAmount || 0;
  const total = Math.max(0, amount - discount);
  const isPaid = invoice.status === "PAID";

  return React.createElement(Document, null,
    React.createElement(Page, { size: "LETTER", style: styles.page },
      React.createElement(View, { style: styles.header },
        React.createElement(Text, { style: styles.brand }, "North Shore Sign Co"),
        React.createElement(Text, { style: styles.title }, invoice.invoiceNumber || "Invoice"),
        React.createElement(Text, { style: isPaid ? styles.status : { marginTop: 8, fontSize: 12, fontWeight: 700, color: "#b45309" } }, invoice.status)
      ),
      isPaid ? React.createElement(Text, { style: styles.paid }, "PAID") : null,
      React.createElement(View, { style: styles.section },
        React.createElement(Text, { style: styles.sectionTitle }, "BILLED TO"),
        React.createElement(Text, null, `${invoice.user.firstName} ${invoice.user.lastName}`.trim()),
        React.createElement(Text, { style: { color: "#64748b", fontSize: 10, marginTop: 4 } }, invoice.user.email)
      ),
      React.createElement(View, { style: styles.section },
        React.createElement(Text, { style: styles.sectionTitle }, "INVOICE DETAILS"),
        ...(invoice.lineItems.length ? invoice.lineItems : [{ description: "Service charge", quantity: 1, unitAmount: amount, totalAmount: amount }]).map((item) => React.createElement(View, { key: item.description, style: styles.row }, React.createElement(Text, { style: styles.label }, `${item.description} x${item.quantity}`), React.createElement(Text, { style: styles.value }, money(item.totalAmount)))),
        React.createElement(View, { style: styles.row }, React.createElement(Text, { style: styles.label }, "Issued"), React.createElement(Text, { style: styles.value }, invoice.createdAt.toLocaleDateString())),
        React.createElement(View, { style: styles.row }, React.createElement(Text, { style: styles.label }, "Due"), React.createElement(Text, { style: styles.value }, invoice.dueDate ? invoice.dueDate.toLocaleDateString() : "No due date")),
        React.createElement(View, { style: styles.row }, React.createElement(Text, { style: styles.label }, "Subtotal"), React.createElement(Text, { style: styles.value }, money(amount))),
        discount > 0 ? React.createElement(View, { style: styles.row }, React.createElement(Text, { style: styles.label }, "Credit / discount"), React.createElement(Text, { style: styles.value }, `-${money(discount)}`)) : null,
        React.createElement(View, { style: styles.total }, React.createElement(Text, null, isPaid ? "Total paid" : "Total due"), React.createElement(Text, null, money(total)))
      ),
      isPaid ? React.createElement(View, { style: styles.section },
        React.createElement(Text, { style: styles.sectionTitle }, "PAYMENT DETAILS"),
        React.createElement(View, { style: styles.row }, React.createElement(Text, { style: styles.label }, "Amount paid"), React.createElement(Text, { style: styles.value }, money(paid))),
        React.createElement(View, { style: styles.row }, React.createElement(Text, { style: styles.label }, "Paid date"), React.createElement(Text, { style: styles.value }, invoice.paidAt ? invoice.paidAt.toLocaleDateString() : "—")),
        invoice.paidByType ? React.createElement(View, { style: styles.row }, React.createElement(Text, { style: styles.label }, "Payment type"), React.createElement(Text, { style: styles.value }, invoice.paidByType)) : null,
        invoice.fluidpayTransactionId ? React.createElement(View, { style: styles.row }, React.createElement(Text, { style: styles.label }, "Transaction ID"), React.createElement(Text, { style: styles.value }, invoice.fluidpayTransactionId)) : null
      ) : null,
      React.createElement(Text, { style: styles.footer }, "North Shore Sign Co · billing@northshoresignco.com · (206) 659-6323")
    )
  );
}

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const role = (session.user as { role?: string }).role || "";
    const invoice = await prisma.invoice.findUnique({ where: { id: params.id }, include: { lineItems: true, user: { select: { firstName: true, lastName: true, email: true } } } });
    if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    if (!(await canAccessInvoice(session.user.id, role, invoice.userId))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const pdfElement = React.createElement(InvoicePdf, { invoice }) as unknown as React.ReactElement;
    const buffer = await renderToBuffer(pdfElement as React.ReactElement<React.ComponentProps<typeof Document>>);
    return new NextResponse(buffer as unknown as BodyInit, { status: 200, headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${invoice.invoiceNumber || "invoice"}.pdf"`, "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Failed to generate invoice PDF:", error);
    return NextResponse.json({ error: "Failed to generate invoice PDF" }, { status: 500 });
  }
}
