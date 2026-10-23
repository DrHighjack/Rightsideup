import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { normalizeCities } from "@/lib/area-pricing";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const areaPriceGroupSchema = z.object({
  name: z.string().trim().min(1).max(80),
  cities: z.array(z.string().trim().min(1).max(80)).min(1).max(100),
  amountCents: z.number().int().min(0).max(1_000_000),
  isActive: z.boolean().optional(),
});

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return null;
}

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  const groups = await prisma.areaPriceGroup.findMany({
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });
  return NextResponse.json({ groups });
}

export async function POST(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const parsed = areaPriceGroupSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid area price group", details: parsed.error.flatten() }, { status: 400 });
  }

  const cities = normalizeCities(parsed.data.cities);
  if (!cities.length) return NextResponse.json({ error: "Add at least one city" }, { status: 400 });

  const conflictingGroup = await prisma.areaPriceGroup.findFirst({
    where: { isActive: true, cities: { hasSome: cities } },
    select: { name: true, cities: true },
  });
  if (conflictingGroup) {
    const conflict = cities.find((city) => conflictingGroup.cities.includes(city));
    return NextResponse.json(
      { error: `${conflict || "A city"} is already active in ${conflictingGroup.name}` },
      { status: 409 }
    );
  }

  const group = await prisma.areaPriceGroup.create({
    data: {
      name: parsed.data.name,
      cities,
      amountCents: parsed.data.amountCents,
      isActive: parsed.data.isActive ?? true,
    },
  });
  return NextResponse.json({ group }, { status: 201 });
}
