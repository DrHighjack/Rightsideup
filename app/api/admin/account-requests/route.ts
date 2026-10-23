import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const actionSchema = z.object({
  userId: z.string().min(1),
  action: z.enum(["APPROVE", "ACTIVATE", "REJECT"]),
});

async function requireAdmin(): Promise<{ error: NextResponse } | { adminId: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (session.user.role !== "ADMIN") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { adminId: session.user.id };
}

export async function GET() {
  const access = await requireAdmin();
  if ("error" in access) return access.error;

  const requests = await prisma.user.findMany({
    where: {
      role: { in: ["TC", "BROKERAGE"] },
      accountStatus: { in: ["PENDING_APPROVAL", "APPROVED"] },
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      role: true,
      accountStatus: true,
      emailVerifiedAt: true,
      brokerage: { select: { id: true, name: true, isActive: true } },
      createdAt: true,
    },
    orderBy: [{ accountStatus: "asc" }, { createdAt: "asc" }],
  });

  return NextResponse.json({ requests });
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const access = await requireAdmin();
  if ("error" in access) return access.error;

  const parsed = actionSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "A valid account action is required" }, { status: 400 });
  }

  const account = await prisma.user.findUnique({
    where: { id: parsed.data.userId },
    select: {
      id: true,
      role: true,
      accountStatus: true,
      emailVerifiedAt: true,
      brokerageId: true,
    },
  });

  if (!account || !["TC", "BROKERAGE"].includes(account.role)) {
    return NextResponse.json({ error: "Account request not found" }, { status: 404 });
  }

  if (parsed.data.action === "APPROVE") {
    if (account.accountStatus !== "PENDING_APPROVAL") {
      return NextResponse.json({ error: "Only pending requests can be approved" }, { status: 409 });
    }
    const updated = await prisma.user.updateMany({
      where: { id: account.id, accountStatus: "PENDING_APPROVAL" },
      data: { accountStatus: "APPROVED" },
    });
    if (updated.count !== 1) {
      return NextResponse.json({ error: "The account changed while being approved; refresh and try again" }, { status: 409 });
    }
    return NextResponse.json({ success: true, accountStatus: "APPROVED" });
  }

  if (parsed.data.action === "ACTIVATE") {
    if (account.accountStatus !== "APPROVED") {
      return NextResponse.json({ error: "Approve this account before activating it" }, { status: 409 });
    }
    if (!account.emailVerifiedAt) {
      return NextResponse.json({ error: "The user must verify their email before activation" }, { status: 409 });
    }
    if (account.role === "BROKERAGE" && !account.brokerageId) {
      return NextResponse.json({ error: "The brokerage record is missing" }, { status: 409 });
    }

    await prisma.$transaction(async (tx) => {
      const updated = await tx.user.updateMany({
        where: { id: account.id, accountStatus: "APPROVED" },
        data: { accountStatus: "ACTIVE" },
      });
      if (updated.count !== 1) throw new Error("ACCOUNT_STATUS_CHANGED");

      if (account.role === "BROKERAGE" && account.brokerageId) {
        await tx.brokerage.update({ where: { id: account.brokerageId }, data: { isActive: true } });
      }
    }).catch((error) => {
      if (error instanceof Error && error.message === "ACCOUNT_STATUS_CHANGED") return null;
      throw error;
    });

    const current = await prisma.user.findUnique({ where: { id: account.id }, select: { accountStatus: true } });
    if (current?.accountStatus !== "ACTIVE") {
      return NextResponse.json({ error: "The account changed while being activated; refresh and try again" }, { status: 409 });
    }
    return NextResponse.json({ success: true, accountStatus: "ACTIVE" });
  }

  if (!["PENDING_APPROVAL", "APPROVED"].includes(account.accountStatus)) {
    return NextResponse.json({ error: "Only pending or approved accounts can be rejected" }, { status: 409 });
  }

  const rejected = await prisma.$transaction(async (tx) => {
    const updated = await tx.user.updateMany({
      where: { id: account.id, accountStatus: { in: ["PENDING_APPROVAL", "APPROVED"] } },
      data: { accountStatus: "REJECTED" },
    });
    if (updated.count !== 1) return false;
    if (account.brokerageId) {
      await tx.brokerage.update({ where: { id: account.brokerageId }, data: { isActive: false } });
    }
    return true;
  });

  if (!rejected) {
    return NextResponse.json({ error: "The account changed while being rejected; refresh and try again" }, { status: 409 });
  }

  return NextResponse.json({ success: true, accountStatus: "REJECTED" });
}