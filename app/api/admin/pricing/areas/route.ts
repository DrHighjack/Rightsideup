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
  return session?.user?.id && session.user.role === "ADMIN";
}

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const groups = await prisma.areaPriceGroup.findMany({
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });
  return NextResponse.json({ groups });
}

export async function POST(request: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
