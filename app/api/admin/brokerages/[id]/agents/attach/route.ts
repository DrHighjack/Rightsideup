import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const attachAgentSchema = z.object({
  realtorId: z.string().min(1),
});

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    const role = (session?.user as any)?.role;

    if (!session?.user?.id || (role !== "ADMIN" && role !== "SALESMEN")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { realtorId } = attachAgentSchema.parse(await request.json());

    const [brokerage, realtor] = await Promise.all([
      prisma.brokerage.findUnique({
        where: { id: params.id },
        select: { id: true, name: true, isActive: true },
      }),
      prisma.user.findUnique({
        where: { id: realtorId },
        select: {
          id: true,
          role: true,
          brokerageId: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      }),
    ]);

    if (!brokerage) {
      return NextResponse.json({ error: "Brokerage not found" }, { status: 404 });
    }

    if (!brokerage.isActive) {
      return NextResponse.json({ error: "Brokerage is inactive" }, { status: 400 });
    }

    if (!realtor || realtor.role !== "REALTOR") {
      return NextResponse.json({ error: "Realtor not found" }, { status: 404 });
    }

    if (realtor.brokerageId === brokerage.id) {
      return NextResponse.json({ error: "Realtor is already in this brokerage" }, { status: 400 });
    }

    const updated = await prisma.user.update({
      where: { id: realtor.id },
      data: {
        brokerageId: brokerage.id,
        brokerageName: brokerage.name,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        brokerageId: true,
        brokerageName: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: `${updated.firstName} ${updated.lastName} added to ${brokerage.name}`,
      realtor: updated,
    });
  } catch (error: any) {
    if (error?.name === "ZodError") {
      return NextResponse.json({ error: "Invalid input", details: error.errors }, { status: 400 });
    }

    console.error("Failed to attach realtor to brokerage:", error);
    return NextResponse.json({ error: "Failed to add realtor to brokerage" }, { status: 500 });
  }
}
