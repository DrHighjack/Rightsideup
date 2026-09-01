import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAccessibleBrokerages } from "@/lib/brokerage-access";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const requestSchema = z.object({
  orderId: z.string().trim().min(1),
  requestedUrl: z.string().trim().url().max(2000),
});

type PortalRole = "REALTOR" | "TC" | "BROKERAGE";

async function getPortalUser() {
  const session = await auth();
  const role = session?.user?.role;
  if (!session?.user?.id || !["REALTOR", "TC", "BROKERAGE"].includes(role || "")) return null;
  return { id: session.user.id, role: role as PortalRole };
}

async function getAccessibleOrderWhere(user: { id: string; role: PortalRole }) {
  if (user.role === "REALTOR") return { realtorId: user.id };
  if (user.role === "TC") return { realtor: { linkedTCs: { some: { tcUserId: user.id } } } };

  const brokerageIds = (await getAccessibleBrokerages(user.id)).map((brokerage) => brokerage.id);
  return { realtor: { brokerageId: { in: brokerageIds } } };
}

export async function GET() {
  const user = await getPortalUser();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const accessibleWhere = await getAccessibleOrderWhere(user);
  const orders = await prisma.order.findMany({
    where: {
      ...accessibleWhere,
      type: { not: "REMOVAL" },
      status: { notIn: ["CANCELLED", "REMOVED"] },
    },
    select: {
      id: true,
      orderNumber: true,
      address: true,
      status: true,
      rfidListingUrl: true,
      realtor: { select: { firstName: true, lastName: true, brokerageName: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 250,
  });
  const orderIds = orders.map((order) => order.id);
  const requests = await prisma.listingLinkRequest.findMany({
    where: { orderId: { in: orderIds } },
    orderBy: { createdAt: "desc" },
    take: 250,
  });

  return NextResponse.json({ orders, requests });
}

export async function POST(request: NextRequest) {
  const user = await getPortalUser();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = requestSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Select a listing and enter a valid website URL" }, { status: 400 });

  const requestedUrl = new URL(parsed.data.requestedUrl);
  if (!["http:", "https:"].includes(requestedUrl.protocol)) {
    return NextResponse.json({ error: "Listing website must use http or https" }, { status: 400 });
  }

  const accessibleWhere = await getAccessibleOrderWhere(user);
  const order = await prisma.order.findFirst({
    where: {
      id: parsed.data.orderId,
      ...accessibleWhere,
      type: { not: "REMOVAL" },
      status: { notIn: ["CANCELLED", "REMOVED"] },
    },
    select: { id: true },
  });
  if (!order) return NextResponse.json({ error: "Listing not found or not available to this account" }, { status: 404 });

  const existing = await prisma.listingLinkRequest.findFirst({ where: { orderId: order.id, status: "PENDING" } });
  if (existing) return NextResponse.json({ error: "This listing already has a link awaiting admin review" }, { status: 409 });

  const created = await prisma.listingLinkRequest.create({
    data: {
      orderId: order.id,
      requestedById: user.id,
      requesterRole: user.role,
      requestedUrl: requestedUrl.toString(),
    },
  }).catch(() => null);
  if (!created) return NextResponse.json({ error: "This listing already has a link awaiting admin review" }, { status: 409 });

  return NextResponse.json({ request: created }, { status: 201 });
}