import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface UtilityLine {
  name: string;
  status: 'PENDING' | 'RESPONDED' | 'CLEAR' | 'CONFLICT';
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  respondedAt?: string;
}

/**
 * POST /api/admin/811/upload-pdf
 * Upload and process 811 PDF ticket
 * Accepts: ticketId, utilityLines, postLat, postLng
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    // Check authentication
    if (!session?.user?.id || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { ticketId, utilityLines, postLat, postLng, pdfUrl } = body;

    if (!ticketId) {
      return NextResponse.json(
        { error: "ticketId is required" },
        { status: 400 }
      );
    }

    // Validate utility lines structure
    if (!utilityLines || !Array.isArray(utilityLines)) {
      return NextResponse.json(
        { error: "utilityLines must be an array" },
        { status: 400 }
      );
    }

    // Validate coordinates
    if (postLat === undefined || postLng === undefined) {
      return NextResponse.json(
        { error: "postLat and postLng are required" },
        { status: 400 }
      );
    }

    if (
      typeof postLat !== "number" ||
      typeof postLng !== "number" ||
      postLat < -90 ||
      postLat > 90 ||
      postLng < -180 ||
      postLng > 180
    ) {
      return NextResponse.json(
        { error: "Invalid coordinates" },
        { status: 400 }
      );
    }

    // Find the ticket
    const ticket = await prisma.ticket811.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      return NextResponse.json(
        { error: "Ticket not found" },
        { status: 404 }
      );
    }

    // Format utility lines
    const formattedUtilityLines: UtilityLine[] = utilityLines.map(
      (line: any) => ({
        name: line.name,
        status: line.status || "PENDING",
        contactName: line.contactName || null,
        contactPhone: line.contactPhone || null,
        contactEmail: line.contactEmail || null,
        respondedAt: line.respondedAt || null,
      })
    );

    // Update ticket with PDF and location data
    const updated = await prisma.ticket811.update({
      where: { id: ticketId },
      data: {
        pdfUrl: pdfUrl || null,
        postAddressLat: postLat,
        postAddressLng: postLng,
        utilityLines: formattedUtilityLines as any,
        status: "NEEDS_REVIEW", // Mark for admin review
      },
      include: {
        realtor: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      ticket: updated,
      message: "811 ticket updated with post location and utility lines",
    });
  } catch (error) {
    console.error("Error uploading 811 PDF:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
