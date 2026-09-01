import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const updateInstallSchema = z.object({
  assignmentId: z.string().min(1),
  installerPayCents: z.number().int().min(0).nullable(),
  satisfactionScore: z.number().int().min(1).max(5).nullable(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const fieldTech = await prisma.user.findFirst({
      where: { id: params.id, role: "FIELD_TECH" },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        tags: true,
        createdAt: true,
        jobAssignments: {
          where: { completedAt: { not: null } },
          select: {
            id: true,
            scheduledFor: true,
            startedAt: true,
            completedAt: true,
            techNotes: true,
            issue: true,
            images: true,
            installerPayCents: true,
            satisfactionScore: true,
            order: {
              select: {
                id: true,
                orderNumber: true,
                type: true,
                status: true,
                address: true,
                addressLat: true,
                addressLng: true,
                realtor: {
                  select: {
                    firstName: true,
                    lastName: true,
                  },
                },
              },
            },
          },
          orderBy: { completedAt: "desc" },
          take: 1000,
        },
        _count: {
          select: {
            jobAssignments: { where: { completedAt: null } },
          },
        },
      },
    });

    if (!fieldTech) {
      return NextResponse.json({ error: "Installer account not found" }, { status: 404 });
    }

    const installs = fieldTech.jobAssignments;
    const timedInstalls = installs.filter(
      (install) => install.startedAt && install.completedAt && install.completedAt >= install.startedAt
    );
    const totalDurationMs = timedInstalls.reduce(
      (total, install) => total + (install.completedAt!.getTime() - install.startedAt!.getTime()),
      0
    );
    const paidInstalls = installs.filter((install) => install.installerPayCents !== null);
    const ratedInstalls = installs.filter((install) => install.satisfactionScore !== null);

    return NextResponse.json({
      installer: {
        id: fieldTech.id,
        firstName: fieldTech.firstName,
        lastName: fieldTech.lastName,
        email: fieldTech.email,
        phone: fieldTech.phone,
        createdAt: fieldTech.createdAt,
        isActive: !fieldTech.tags.includes("INACTIVE"),
      },
      stats: {
        completedInstalls: installs.length,
        openJobs: fieldTech._count.jobAssignments,
        totalPaidCents: paidInstalls.reduce(
          (total, install) => total + (install.installerPayCents ?? 0),
          0
        ),
        paidInstallCount: paidInstalls.length,
        averageInstallMinutes: timedInstalls.length
          ? Math.round(totalDurationMs / timedInstalls.length / 60000)
          : null,
        timedInstallCount: timedInstalls.length,
        satisfactionScore: ratedInstalls.length
          ? ratedInstalls.reduce((total, install) => total + (install.satisfactionScore ?? 0), 0) /
            ratedInstalls.length
          : null,
        ratedInstallCount: ratedInstalls.length,
        mappedInstalls: installs.filter(
          (install) => install.order.addressLat !== null && install.order.addressLng !== null
        ).length,
      },
      installs,
    });
  } catch (error) {
    console.error("[ADMIN FIELD-TECH PROFILE] Fetch error:", error);
    return NextResponse.json({ error: "Failed to load installer profile" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const input = updateInstallSchema.parse(await request.json());
    const assignment = await prisma.jobAssignment.findFirst({
      where: {
        id: input.assignmentId,
        fieldTechId: params.id,
        completedAt: { not: null },
      },
      select: { id: true },
    });

    if (!assignment) {
      return NextResponse.json({ error: "Completed install not found" }, { status: 404 });
    }

    const updated = await prisma.jobAssignment.update({
      where: { id: assignment.id },
      data: {
        installerPayCents: input.installerPayCents,
        satisfactionScore: input.satisfactionScore,
      },
      select: {
        id: true,
        installerPayCents: true,
        satisfactionScore: true,
      },
    });

    return NextResponse.json({ install: updated });
  } catch (error: any) {
    if (error.name === "ZodError") {
      return NextResponse.json({ error: "Invalid input", details: error.errors }, { status: 400 });
    }

    console.error("[ADMIN FIELD-TECH PROFILE] Update error:", error);
    return NextResponse.json({ error: "Failed to update install details" }, { status: 500 });
  }
}