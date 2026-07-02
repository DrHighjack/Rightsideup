import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const updateTCSchema = z.object({
  firstName: z.string().trim().min(1).optional(),
  lastName: z.string().trim().min(1).optional(),
  phone: z.string().trim().optional(),
  isActive: z.boolean().optional(),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();

    if (!session?.user?.id || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const existingTc = await prisma.user.findFirst({
      where: { id: params.id, role: "TC" },
      select: { id: true, tags: true },
    });

    if (!existingTc) {
      return NextResponse.json({ error: "TC not found" }, { status: 404 });
    }

    const body = await request.json();
    const parsed = updateTCSchema.parse(body);

    const tagsWithoutInactive = existingTc.tags.filter((tag) => tag !== "INACTIVE");
    const nextTags =
      parsed.isActive === undefined
        ? undefined
        : parsed.isActive
        ? tagsWithoutInactive
        : [...tagsWithoutInactive, "INACTIVE"];

    const updatedTc = await prisma.user.update({
      where: { id: params.id },
      data: {
        ...(parsed.firstName !== undefined ? { firstName: parsed.firstName } : {}),
        ...(parsed.lastName !== undefined ? { lastName: parsed.lastName } : {}),
        ...(parsed.phone !== undefined ? { phone: parsed.phone || null } : {}),
        ...(nextTags ? { tags: { set: nextTags } } : {}),
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        tags: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: "TC updated successfully",
      tc: updatedTc,
    });
  } catch (error: any) {
    if (error.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Failed to update TC:", error);
    return NextResponse.json({ error: "Failed to update TC" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();

    if (!session?.user?.id || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tc = await prisma.user.findFirst({
      where: { id: params.id, role: "TC" },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        tags: true,
      },
    });

    if (!tc) {
      return NextResponse.json({ error: "TC not found" }, { status: 404 });
    }

    if (tc.tags.includes("INACTIVE")) {
      return NextResponse.json({
        success: true,
        message: "TC is already inactive",
      });
    }

    await prisma.user.update({
      where: { id: tc.id },
      data: {
        tags: {
          set: [...tc.tags, "INACTIVE"],
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: `${tc.firstName} ${tc.lastName} has been deactivated`,
    });
  } catch (error) {
    console.error("Failed to deactivate TC:", error);
    return NextResponse.json(
      { error: "Failed to deactivate TC" },
      { status: 500 }
    );
  }
}
