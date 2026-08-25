import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createSmartSignTagCode, ensureSmartSignTrial, getSmartSignUrl } from "@/lib/smart-sign";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const createTagSchema = z.object({
  signId: z.string().min(1),
  notes: z.string().trim().max(500).optional(),
});

async function requireAdmin() {
  const session = await auth();
  return session?.user?.id && (session.user as { role?: string }).role === "ADMIN";
}

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [tags, untaggedSigns] = await Promise.all([
    prisma.smartSignTag.findMany({
      include: {
        sign: {
          include: {
            assignedToUser: { select: { id: true, firstName: true, lastName: true, email: true } },
            assignedToOrder: { select: { id: true, orderNumber: true, address: true } },
          },
        },
        _count: { select: { tapEvents: true } },
      },
      orderBy: { installedAt: "desc" },
    }),
    prisma.sign.findMany({
      where: { smartSignTag: null, status: { in: ["AVAILABLE", "DEPLOYED"] } },
      select: {
        id: true,
        signNumber: true,
        type: true,
        status: true,
        deployedAddress: true,
        assignedToUser: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: [{ status: "desc" }, { signNumber: "asc" }],
      take: 200,
    }),
  ]);

  return NextResponse.json({
    tags: tags.map((tag) => ({
      id: tag.id,
      tagCode: tag.tagCode,
      isActive: tag.isActive,
      notes: tag.notes,
      installedAt: tag.installedAt,
      tapCount: tag._count.tapEvents,
      url: getSmartSignUrl(tag.tagCode),
      sign: tag.sign,
    })),
    untaggedSigns,
  });
}

export async function POST(request: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = createTagSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid tag request", details: parsed.error.flatten() }, { status: 400 });

  const sign = await prisma.sign.findUnique({
    where: { id: parsed.data.signId },
    select: { id: true, assignedToUserId: true },
  });
  if (!sign) return NextResponse.json({ error: "Sign not found" }, { status: 404 });

  const existing = await prisma.smartSignTag.findUnique({ where: { signId: sign.id } });
  if (existing) return NextResponse.json({ error: "This post already has a Smart Sign tag" }, { status: 409 });

  let tagCode = createSmartSignTagCode();
  while (await prisma.smartSignTag.findUnique({ where: { tagCode }, select: { id: true } })) {
    tagCode = createSmartSignTagCode();
  }

  const tag = await prisma.smartSignTag.create({
    data: { signId: sign.id, tagCode, notes: parsed.data.notes || null },
  });
  if (sign.assignedToUserId) await ensureSmartSignTrial(sign.assignedToUserId);

  return NextResponse.json({ tag: { ...tag, url: getSmartSignUrl(tag.tagCode) } }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json() as { id?: unknown; isActive?: unknown; notes?: unknown };
  if (typeof body.id !== "string" || typeof body.isActive !== "boolean") {
    return NextResponse.json({ error: "Tag ID and active state are required" }, { status: 400 });
  }

  const tag = await prisma.smartSignTag.update({
    where: { id: body.id },
    data: { isActive: body.isActive, ...(typeof body.notes === "string" ? { notes: body.notes.trim() || null } : {}) },
  }).catch(() => null);
  if (!tag) return NextResponse.json({ error: "Tag not found" }, { status: 404 });
  return NextResponse.json({ tag });
}
