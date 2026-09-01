import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BrokerageStatementSnapshot } from "@/lib/brokerage-statements";
import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import { canAccessBrokerages } from "@/lib/brokerage-access";

const styles = StyleSheet.create({
  page: { padding: 38, fontFamily: "Helvetica", color: "#111827", fontSize: 9 },
  header: { borderBottom: "2 solid #0f3d5e", paddingBottom: 14, marginBottom: 18 },
  brand: { fontSize: 18, fontWeight: 700, color: "#0f3d5e" },
  title: { marginTop: 10, fontSize: 22, fontWeight: 700 },
  meta: { marginTop: 4, color: "#4b5563" },
  paid: { marginBottom: 16, padding: 10, backgroundColor: "#dcfce7", color: "#166534", fontSize: 16, fontWeight: 700, textAlign: "center" },
  invoice: { marginBottom: 16, border: "1 solid #d1d5db", padding: 10 },
  invoiceHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 7, fontSize: 11, fontWeight: 700 },
  row: { flexDirection: "row", borderTop: "1 solid #e5e7eb", paddingVertical: 5 },
  description: { width: "50%" },
  qty: { width: "10%", textAlign: "right" },
  price: { width: "20%", textAlign: "right" },
  summary: { marginLeft: "55%", marginTop: 5 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
  total: { marginTop: 8, padding: 10, flexDirection: "row", justifyContent: "space-between", backgroundColor: "#e0f2fe", fontSize: 14, fontWeight: 700 },
  footer: { marginTop: 18, color: "#6b7280", textAlign: "center" },
});

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

function StatementPdf({ statement, snapshot }: {
  statement: { statementNumber: string; periodStart: Date; periodEnd: Date; dueDate: Date; status: string; totalCents: number; paidAt: Date | null; paymentCardLast4: string | null; fluidpayTransactionId: string | null };
  snapshot: BrokerageStatementSnapshot;
}) {
  return React.createElement(Document, null,
    React.createElement(Page, { size: "LETTER", style: styles.page },
      React.createElement(View, { style: styles.header },
        React.createElement(Text, { style: styles.brand }, "North Shore Sign Co"),
        React.createElement(Text, { style: styles.title }, "Brokerage Billing Statement"),
        React.createElement(Text, { style: styles.meta }, `${snapshot.brokerageName} | ${statement.statementNumber}`),
        React.createElement(Text, { style: styles.meta }, `${statement.periodStart.toLocaleDateString()} - ${statement.periodEnd.toLocaleDateString()} | Due ${statement.dueDate.toLocaleDateString()}`)
      ),
      statement.status === "PAID" ? React.createElement(Text, { style: styles.paid }, "PAID") : null,
      ...snapshot.invoices.map((invoice) => React.createElement(View, { key: invoice.id, style: styles.invoice },
        React.createElement(View, { style: styles.invoiceHeader },
          React.createElement(Text, null, `${invoice.brokerageName || snapshot.brokerageName} | ${invoice.invoiceNumber} | ${invoice.realtorName}`),
          React.createElement(Text, null, new Date(invoice.invoiceDate).toLocaleDateString())
        ),
        React.createElement(View, { style: styles.row },
          React.createElement(Text, { style: styles.description }, "Item"),
          React.createElement(Text, { style: styles.qty }, "Qty"),
          React.createElement(Text, { style: styles.price }, "Rate"),
          React.createElement(Text, { style: styles.price }, "Amount")
        ),
        ...invoice.lineItems.map((item, index) => React.createElement(View, { key: `${invoice.id}-${index}`, style: styles.row },
          React.createElement(Text, { style: styles.description }, item.description),
          React.createElement(Text, { style: styles.qty }, String(item.quantity)),
          React.createElement(Text, { style: styles.price }, money(item.unitAmount)),
          React.createElement(Text, { style: styles.price }, money(item.totalAmount))
        )),
        React.createElement(View, { style: styles.summary },
          React.createElement(View, { style: styles.summaryRow }, React.createElement(Text, null, "Subtotal"), React.createElement(Text, null, money(invoice.subtotalCents))),
          invoice.discountCents > 0 ? React.createElement(View, { style: styles.summaryRow }, React.createElement(Text, null, "Discount"), React.createElement(Text, null, `-${money(invoice.discountCents)}`)) : null,
          invoice.taxCents > 0 ? React.createElement(View, { style: styles.summaryRow }, React.createElement(Text, null, `Sales tax (${(invoice.taxRateBps / 100).toFixed(2)}%)`), React.createElement(Text, null, money(invoice.taxCents))) : null,
          invoice.previouslyPaidCents > 0 ? React.createElement(View, { style: styles.summaryRow }, React.createElement(Text, null, "Previously paid"), React.createElement(Text, null, `-${money(invoice.previouslyPaidCents)}`)) : null,
          React.createElement(View, { style: styles.summaryRow }, React.createElement(Text, { style: { fontWeight: 700 } }, "Balance"), React.createElement(Text, { style: { fontWeight: 700 } }, money(invoice.balanceCents)))
        )
      )),
      React.createElement(View, { style: styles.total },
        React.createElement(Text, null, statement.status === "PAID" ? "Total paid" : "Total due"),
        React.createElement(Text, null, money(statement.totalCents))
      ),
      statement.status === "PAID" ? React.createElement(Text, { style: styles.meta }, `Paid ${statement.paidAt?.toLocaleDateString() || ""}${statement.paymentCardLast4 ? ` with card ending ${statement.paymentCardLast4}` : ""}${statement.fluidpayTransactionId ? ` | Transaction ${statement.fluidpayTransactionId}` : ""}`) : null,
      React.createElement(Text, { style: styles.footer }, "North Shore Sign Co | billing@northshoresignco.com | (206) 659-6323")
    )
  );
}

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = session.user.role;

  const statement = await prisma.brokerageStatement.findUnique({ where: { id: params.id } });
  if (!statement) return NextResponse.json({ error: "Statement not found" }, { status: 404 });
  if (
    role !== "ADMIN" &&
    (role !== "BROKERAGE" ||
      statement.ownerUserId !== session.user.id ||
      !(await canAccessBrokerages(session.user.id, statement.brokerageIds)))
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const snapshot = statement.snapshot as unknown as BrokerageStatementSnapshot;
    const element = React.createElement(StatementPdf, { statement, snapshot }) as unknown as React.ReactElement<React.ComponentProps<typeof Document>>;
    const buffer = await renderToBuffer(element);
    return new NextResponse(buffer as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${statement.statementNumber}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Failed to generate brokerage statement PDF:", error);
    return NextResponse.json({ error: "Failed to generate statement PDF" }, { status: 500 });
  }
}