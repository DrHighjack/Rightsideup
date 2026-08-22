import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id || (session.user as { role?: string }).role !== "ADMIN") {
    return null;
  }
  return session;
}

export async function GET() {
  try {
    if (!await requireAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const requests = await prisma.printerPartnershipRequest.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
      include: { requestedByUser: { select: { firstName: true, lastName: true, email: true } } },
    });
    return NextResponse.json({ requests });
  } catch (error) {
    console.error("Printer partnership requests GET failed:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to load printer requests" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    if (!await requireAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const body = (await request.json()) as { requestId?: unknown; decision?: unknown };
    const requestId = typeof body.requestId === "string" ? body.requestId : "";
    const decision = body.decision === "APPROVED" || body.decision === "REJECTED" ? body.decision : "";
    if (!requestId || !decision) return NextResponse.json({ error: "requestId and a valid decision are required" }, { status: 400 });

    const partnershipRequest = await prisma.printerPartnershipRequest.findUnique({ where: { id: requestId } });
    if (!partnershipRequest) return NextResponse.json({ error: "Printer request not found" }, { status: 404 });
    if (partnershipRequest.status !== "PENDING") return NextResponse.json({ error: "Printer request has already been reviewed" }, { status: 409 });

    const result = await prisma.$transaction(async (tx) => {
      const updatedRequest = await tx.printerPartnershipRequest.update({ where: { id: requestId }, data: { status: decision } });
      const printer = decision === "APPROVED"
        ? await tx.signPrinter.create({ data: { name: partnershipRequest.name, website: partnershipRequest.website, isActive: true } })
        : null;
      return { updatedRequest, printer };
    });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("Printer partnership request PATCH failed:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to review printer request" }, { status: 500 });
  }
}
