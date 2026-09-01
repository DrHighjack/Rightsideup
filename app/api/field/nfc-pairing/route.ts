import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureSmartSignTrial, getSmartSignUrl } from "@/lib/smart-sign";
import { z } from "zod";

const pairSchema = z.object({
  tagReference: z.string().trim().min(1).max(500),
  orderId: z.string().trim().min(1),
  listingUrl: z.string().trim().url().max(2000),
});

async function requireInstaller() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "FIELD_TECH") return null;
  return session.user.id;
}

function parseTagReference(value: string) {
  const trimmed = value.trim();
  try {
    const url = new URL(trimmed);
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts[0] === "s" && parts[1]) return { tagCode: decodeURIComponent(parts[1]).toUpperCase() };
    if (parts[0] === "tap" && parts[1]) return { signReference: decodeURIComponent(parts[1]) };
  } catch {
    // A printed tag code is also a valid reference.
  }
  return { tagCode: trimmed.toUpperCase() };
}

export async function GET() {
  const fieldTechId = await requireInstaller();
  if (!fieldTechId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const assignments = await prisma.jobAssignment.findMany({
    where: {
      fieldTechId,
      completedAt: null,
      order: {
        type: { in: ["INSTALL", "CHANGE"] },
        status: { notIn: ["CANCELLED", "REMOVED"] },
      },
    },
    select: {
      id: true,
      scheduledFor: true,
      order: {
        select: {
          id: true,
          orderNumber: true,
          address: true,
          rfidListingUrl: true,
          realtor: { select: { firstName: true, lastName: true } },
        },
      },
    },
    orderBy: [{ scheduledFor: "asc" }, { createdAt: "asc" }],
  });

  return NextResponse.json({ assignments });
}

export async function POST(request: NextRequest) {
  const fieldTechId = await requireInstaller();
  if (!fieldTechId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = pairSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Tag, assigned listing, and a valid website URL are required" }, { status: 400 });
  }

  const listingUrl = new URL(parsed.data.listingUrl);
  if (!["http:", "https:"].includes(listingUrl.protocol)) {
    return NextResponse.json({ error: "Listing website must use http or https" }, { status: 400 });
  }

  const assignment = await prisma.jobAssignment.findFirst({
    where: {
      fieldTechId,
      completedAt: null,
      orderId: parsed.data.orderId,
      order: {
        type: { in: ["INSTALL", "CHANGE"] },
        status: { notIn: ["CANCELLED", "REMOVED"] },
      },
    },
    select: {
      order: { select: { id: true, address: true, realtorId: true } },
    },
  });
  if (!assignment) return NextResponse.json({ error: "This listing is not assigned to you" }, { status: 403 });

  const reference = parseTagReference(parsed.data.tagReference);
  const tag = await prisma.smartSignTag.findFirst({
    where: reference.tagCode
      ? { tagCode: reference.tagCode }
      : { sign: { OR: [{ id: reference.signReference }, { signNumber: reference.signReference }] } },
    include: { sign: { select: { id: true, signNumber: true, status: true, assignedToOrderId: true } } },
  });
  if (!tag) return NextResponse.json({ error: "NFC box was not found. Check the printed code or scanned URL." }, { status: 404 });
  if (!tag.isActive) return NextResponse.json({ error: "This NFC box is paused. An administrator must reactivate it." }, { status: 409 });
  if (tag.sign.status === "DEPLOYED" && tag.sign.assignedToOrderId && tag.sign.assignedToOrderId !== assignment.order.id) {
    return NextResponse.json({ error: "This NFC box is already paired to another active listing" }, { status: 409 });
  }

  await prisma.$transaction([
    prisma.order.update({
      where: { id: assignment.order.id },
      data: { rfidListingUrl: listingUrl.toString() },
    }),
    prisma.sign.update({
      where: { id: tag.sign.id },
      data: {
        status: "DEPLOYED",
        assignedToUserId: assignment.order.realtorId,
        assignedToOrderId: assignment.order.id,
        deployedAddress: assignment.order.address,
      },
    }),
  ]);
  await ensureSmartSignTrial(assignment.order.realtorId);

  return NextResponse.json({
    success: true,
    publicUrl: getSmartSignUrl(tag.tagCode),
    listingAddress: assignment.order.address,
    signNumber: tag.sign.signNumber,
  });
}