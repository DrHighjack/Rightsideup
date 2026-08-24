import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getAutoInvoicePeriodStart,
  getNextAutoInvoiceRun,
  isAutoInvoiceInterval,
} from "@/lib/brokerage-auto-invoicing";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.id || (session.user as { role?: string }).role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  if (!["APPROVE", "DENY", "DISABLE"].includes(body.action)) {
    return NextResponse.json({ error: "Invalid schedule action" }, { status: 400 });
  }

  const brokerage = await prisma.brokerage.findUnique({ where: { id: params.id } });
  if (!brokerage) return NextResponse.json({ error: "Brokerage not found" }, { status: 404 });

  if (body.action === "APPROVE") {
    const interval = body.interval || brokerage.autoInvoiceInterval;
    if (!isAutoInvoiceInterval(interval)) {
      return NextResponse.json({ error: "Interval must be MONTHLY or BIWEEKLY" }, { status: 400 });
    }
    if (brokerage.billingType !== "BROKERAGE") {
      return NextResponse.json(
        { error: "Set billing type to Brokerage pays before approving automatic invoicing" },
        { status: 409 }
      );
    }
    const approvedAt = new Date();
    const periodStart =
      brokerage.autoInvoiceStatus === "APPROVED" && brokerage.autoInvoicePeriodStart
        ? brokerage.autoInvoicePeriodStart
        : getAutoInvoicePeriodStart(approvedAt);
    const nextRunAt =
      brokerage.autoInvoiceStatus === "APPROVED" && brokerage.autoInvoiceNextRunAt
        ? brokerage.autoInvoiceNextRunAt
        : getNextAutoInvoiceRun(interval, approvedAt);
    const updated = await prisma.brokerage.update({
      where: { id: brokerage.id },
      data: {
        autoInvoiceStatus: "APPROVED",
        autoInvoiceInterval: interval,
        autoInvoiceApprovedAt: approvedAt,
        autoInvoiceApprovedById: session.user.id,
        autoInvoiceOwnerUserId: brokerage.autoInvoiceOwnerUserId || brokerage.adminId,
        autoInvoicePeriodStart: periodStart,
        autoInvoiceNextRunAt: nextRunAt,
      },
    });
    return NextResponse.json({ schedule: updated });
  }

  const disabled = body.action === "DISABLE";
  const updated = await prisma.brokerage.update({
    where: { id: brokerage.id },
    data: {
      autoInvoiceStatus: disabled ? "DISABLED" : "DENIED",
      autoInvoiceApprovedAt: null,
      autoInvoiceApprovedById: null,
      autoInvoiceOwnerUserId: null,
      autoInvoicePeriodStart: null,
      autoInvoiceNextRunAt: null,
      autoInvoiceInterval: null,
    },
  });
  return NextResponse.json({ schedule: updated });
}