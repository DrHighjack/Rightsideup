import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const accessSchema = z.object({ email: z.string().trim().email() });

async function requireAdmin() {
  const session = await auth();
  return session?.user?.id && session.user.role === "ADMIN";
}

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const brokerage = await prisma.brokerage.findUnique({
    where: { id: params.id },
    select: {
      adminId: true,
      admin: { select: { id: true, firstName: true, lastName: true, email: true } },
      accessGrants: {
        select: {
          user: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!brokerage) return NextResponse.json({ error: "Brokerage not found" }, { status: 404 });

  const accounts = [
    { ...brokerage.admin, isPrimary: true },
    ...brokerage.accessGrants
      .map((grant) => ({ ...grant.user, isPrimary: grant.user.id === brokerage.adminId }))
      .filter((account) => account.id !== brokerage.adminId),
  ];
  return NextResponse.json({ accounts });
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { email } = accessSchema.parse(await request.json());
    const [brokerage, user] = await Promise.all([
      prisma.brokerage.findUnique({ where: { id: params.id }, select: { id: true } }),
      prisma.user.findUnique({
        where: { email: email.toLowerCase() },
        select: { id: true, role: true, firstName: true, lastName: true, email: true },
      }),
    ]);
    if (!brokerage) return NextResponse.json({ error: "Brokerage not found" }, { status: 404 });
    if (!user || user.role !== "BROKERAGE") {
      return NextResponse.json({ error: "Enter an existing brokerage-account email" }, { status: 404 });
    }

    await prisma.brokerageAccess.upsert({
      where: { userId_brokerageId: { userId: user.id, brokerageId: params.id } },
      create: { userId: user.id, brokerageId: params.id },
      update: {},
    });
    return NextResponse.json({ account: { ...user, isPrimary: false } }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to grant brokerage access" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const userId = new URL(request.url).searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "Account is required" }, { status: 400 });

  const brokerage = await prisma.brokerage.findUnique({
    where: { id: params.id },
    select: { adminId: true },
  });
  if (!brokerage) return NextResponse.json({ error: "Brokerage not found" }, { status: 404 });
  if (brokerage.adminId === userId) {
    return NextResponse.json({ error: "The primary account cannot be removed" }, { status: 409 });
  }

  await prisma.brokerageAccess.deleteMany({ where: { brokerageId: params.id, userId } });
  return NextResponse.json({ success: true });
}