import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/salesmen/clients/[id]/free-install
 * Give a free install to a realtor client
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();

    if (!session?.user?.id || !["ADMIN", "SALESMEN"].includes((session.user as any).role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Check if client already has a free install
    const client = await prisma.user.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        freeInstallGivenBy: true,
        freeInstallDate: true,
      },
    });

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    if (client.freeInstallGivenBy) {
      return NextResponse.json(
        { error: "Client already has a free install allocated" },
        { status: 400 }
      );
    }

    // Give free install
    const updatedClient = await prisma.user.update({
      where: { id: params.id },
      data: {
        freeInstallGivenBy: session.user.id,
        freeInstallDate: new Date(),
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        freeInstallGivenBy: true,
        freeInstallDate: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Free install allocated to ${client.firstName} ${client.lastName}`,
      client: updatedClient,
    });
  } catch (error) {
    console.error("Failed to allocate free install:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/salesmen/clients/[id]/free-install
 * Revoke a free install from a realtor client
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();

    if (!session?.user?.id || !["ADMIN", "SALESMEN"].includes((session.user as any).role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const client = await prisma.user.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        freeInstallGivenBy: true,
      },
    });

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    if (!client.freeInstallGivenBy) {
      return NextResponse.json(
        { error: "Client does not have a free install allocated" },
        { status: 400 }
      );
    }

    // Remove free install
    const updatedClient = await prisma.user.update({
      where: { id: params.id },
      data: {
        freeInstallGivenBy: null,
        freeInstallDate: null,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        freeInstallGivenBy: true,
        freeInstallDate: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Free install revoked from ${client.firstName} ${client.lastName}`,
      client: updatedClient,
    });
  } catch (error) {
    console.error("Failed to revoke free install:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
