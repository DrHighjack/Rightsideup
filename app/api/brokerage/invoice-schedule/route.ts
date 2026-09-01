import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAutoInvoiceInterval } from "@/lib/brokerage-auto-invoicing";
import { resolveAccessibleBrokerageId } from "@/lib/brokerage-access";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "BROKERAGE") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const brokerageId = await resolveAccessibleBrokerageId(
    session.user.id,
    new URL(request.url).searchParams.get("brokerageId")
  );
  if (!brokerageId) {
    return NextResponse.json({ error: "Brokerage not found" }, { status: 404 });
  }

  const body = await request.json();
  if (!isAutoInvoiceInterval(body.interval)) {
    return NextResponse.json({ error: "Interval must be MONTHLY or BIWEEKLY" }, { status: 400 });
  }

  const brokerage = await prisma.brokerage.findUnique({ where: { id: brokerageId } });
  if (!brokerage || brokerage.billingType !== "BROKERAGE") {
    return NextResponse.json(
      { error: "Brokerage-paid billing is required for automatic invoicing" },
      { status: 409 }
    );
  }

  if (brokerage.autoInvoiceStatus === "APPROVED") {
    return NextResponse.json(
      { error: "An admin must change an approved invoicing schedule" },
      { status: 409 }
    );
  }

  const updated = await prisma.brokerage.updateMany({
    where: { id: brokerage.id, autoInvoiceStatus: { not: "APPROVED" } },
    data: {
      autoInvoiceStatus: "PENDING",
      autoInvoiceInterval: body.interval,
      autoInvoiceRequestedAt: new Date(),
      autoInvoiceApprovedAt: null,
      autoInvoiceApprovedById: null,
      autoInvoiceOwnerUserId: session.user.id,
      autoInvoicePeriodStart: null,
      autoInvoiceNextRunAt: null,
    },
  });
  if (updated.count === 0) {
    return NextResponse.json(
      { error: "An admin must change an approved invoicing schedule" },
      { status: 409 }
    );
  }
  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "BROKERAGE") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const brokerageId = await resolveAccessibleBrokerageId(
    session.user.id,
    new URL(request.url).searchParams.get("brokerageId")
  );
  if (!brokerageId) {
    return NextResponse.json({ error: "Brokerage not found" }, { status: 404 });
  }
  const brokerage = await prisma.brokerage.findUnique({ where: { id: brokerageId } });
  if (brokerage?.autoInvoiceStatus === "APPROVED") {
    return NextResponse.json(
      { error: "Contact an admin to disable an approved invoicing schedule" },
      { status: 409 }
    );
  }
  const updated = await prisma.brokerage.updateMany({
    where: { id: brokerageId, autoInvoiceStatus: { not: "APPROVED" } },
    data: {
      autoInvoiceStatus: "DISABLED",
      autoInvoiceInterval: null,
      autoInvoiceRequestedAt: null,
      autoInvoiceOwnerUserId: null,
    },
  });
  if (updated.count === 0) {
    return NextResponse.json(
      { error: "Contact an admin to disable an approved invoicing schedule" },
      { status: 409 }
    );
  }
  return NextResponse.json({ success: true });
}