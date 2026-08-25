import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { normalizeCities } from "@/lib/area-pricing";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const areaPriceGroupSchema = z.object({
  name: z.string().trim().min(1).max(80),
  cities: z.array(z.string().trim().min(1).max(80)).min(1).max(100),
  amountCents: z.number().int().min(0).max(1_000_000),
  isActive: z.boolean(),
});

async function requireAdmin() {
  const session = await auth();
  return session?.user?.id && (session.user as { role?: string }).role === "ADMIN";
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = areaPriceGroupSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid area price group", details: parsed.error.flatten() }, { status: 400 });
  }

  const cities = normalizeCities(parsed.data.cities);
  if (!cities.length) return NextResponse.json({ error: "Add at least one city" }, { status: 400 });

  if (parsed.data.isActive) {
    const conflictingGroup = await prisma.areaPriceGroup.findFirst({
      where: { id: { not: params.id }, isActive: true, cities: { hasSome: cities } },
      select: { name: true, cities: true },
    });
    if (conflictingGroup) {
      const conflict = cities.find((city) => conflictingGroup.cities.includes(city));
      return NextResponse.json(
        { error: `${conflict || "A city"} is already active in ${conflictingGroup.name}` },
        { status: 409 }
      );
    }
  }

  const group = await prisma.areaPriceGroup.update({
    where: { id: params.id },
    data: { ...parsed.data, cities },
  }).catch(() => null);
  if (!group) return NextResponse.json({ error: "Area price group not found" }, { status: 404 });
  return NextResponse.json({ group });
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.areaPriceGroup.delete({ where: { id: params.id } }).catch(() => null);
  return NextResponse.json({ success: true });
}
