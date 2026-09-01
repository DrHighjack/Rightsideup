import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const reviewSchema = z.object({
  id: z.string().trim().min(1),
  decision: z.enum(["APPROVED", "REJECTED"]),
  reviewNotes: z.string().trim().max(1000).optional(),
});

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") return null;
  return session.user.id;
}

export async function GET(request: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const requestedStatus = new URL(request.url).searchParams.get("status") || "PENDING";
  const status = ["PENDING", "APPROVED", "REJECTED", "ALL"].includes(requestedStatus) ? requestedStatus : "PENDING";

  const requests = await prisma.listingLinkRequest.findMany({
    where: status === "ALL" ? {} : { status },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  const [orders, users] = await Promise.all([
    prisma.order.findMany({
      where: { id: { in: requests.map((item) => item.orderId) } },
      select: { id: true, orderNumber: true, address: true, rfidListingUrl: true, realtor: { select: { firstName: true, lastName: true, brokerageName: true } } },
    }),
    prisma.user.findMany({
      where: { id: { in: requests.map((item) => item.requestedById) } },
      select: { id: true, firstName: true, lastName: true, email: true },
    }),
  ]);
  const orderById = new Map(orders.map((order) => [order.id, order]));
  const userById = new Map(users.map((user) => [user.id, user]));

  return NextResponse.json({
    requests: requests.map((item) => ({ ...item, order: orderById.get(item.orderId) || null, requestedBy: userById.get(item.requestedById) || null })),
  });
}

export async function PATCH(request: NextRequest) {
  const adminId = await requireAdmin();
  if (!adminId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = reviewSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "A valid review decision is required" }, { status: 400 });
  if (parsed.data.decision === "REJECTED" && !parsed.data.reviewNotes) {
    return NextResponse.json({ error: "Explain why this link was rejected" }, { status: 400 });
  }

  const linkRequest = await prisma.listingLinkRequest.findFirst({ where: { id: parsed.data.id, status: "PENDING" } });
  if (!linkRequest) return NextResponse.json({ error: "Pending request not found" }, { status: 404 });

  const requestedUrl = new URL(linkRequest.requestedUrl);
  if (!["http:", "https:"].includes(requestedUrl.protocol)) {
    return NextResponse.json({ error: "The submitted link is no longer valid" }, { status: 400 });
  }

  await prisma.$transaction(async (transaction) => {
    await transaction.listingLinkRequest.update({
      where: { id: linkRequest.id },
      data: {
        status: parsed.data.decision,
        reviewNotes: parsed.data.reviewNotes || null,
        reviewedById: adminId,
        reviewedAt: new Date(),
      },
    });
    if (parsed.data.decision === "APPROVED") {
      await transaction.order.update({
        where: { id: linkRequest.orderId },
        data: { rfidListingUrl: requestedUrl.toString() },
      });
    }
  });

  return NextResponse.json({ success: true, status: parsed.data.decision });
}