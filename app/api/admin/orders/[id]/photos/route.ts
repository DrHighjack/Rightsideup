import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();

    if (!session?.user?.id || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = params;

    // Find the order and its associated job assignment with photos
    const assignment = await prisma.jobAssignment.findUnique({
      where: { orderId: id },
      select: {
        id: true,
        images: true,
        completedAt: true,
        techNotes: true,
      },
    });

    if (!assignment) {
      return NextResponse.json({ photos: [], completedAt: null });
    }

    // Parse images if they exist
    const photos = assignment.images
      ? Array.isArray(assignment.images)
        ? assignment.images
        : [assignment.images]
      : [];

    return NextResponse.json({
      photos,
      completedAt: assignment.completedAt,
      techNotes: assignment.techNotes,
      jobAssignmentId: assignment.id,
    });
  } catch (error) {
    console.error("Photos fetch error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();

    if (!session?.user?.id || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = params;
    const { photoId } = await request.json();

    if (!photoId) {
      return NextResponse.json(
        { error: "photoId is required" },
        { status: 400 }
      );
    }

    // Find the assignment for this order
    const assignment = await prisma.jobAssignment.findUnique({
      where: { orderId: id },
      select: { id: true, images: true },
    });

    if (!assignment) {
      return NextResponse.json(
        { error: "Order not found" },
        { status: 404 }
      );
    }

    // Filter out the photo with the matching ID
    const currentPhotos = assignment.images
      ? Array.isArray(assignment.images)
        ? assignment.images
        : [assignment.images]
      : [];

    const updatedPhotos = currentPhotos.filter(
      (photo: any) => photo.id !== photoId
    );

    // Update the assignment
    const updated = await prisma.jobAssignment.update({
      where: { id: assignment.id },
      data: {
        images: updatedPhotos,
      },
      select: {
        images: true,
      },
    });

    return NextResponse.json({
      photos: updated.images || [],
      message: "Photo deleted successfully",
    });
  } catch (error) {
    console.error("Photo deletion error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();

    if (!session?.user?.id || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = params;
    const { photos: newPhotosData } = await request.json();

    if (!newPhotosData || !Array.isArray(newPhotosData) || newPhotosData.length === 0) {
      return NextResponse.json(
        { error: "At least one photo is required" },
        { status: 400 }
      );
    }

    // Find the assignment for this order
    const assignment = await prisma.jobAssignment.findUnique({
      where: { orderId: id },
      select: { id: true, images: true },
    });

    if (!assignment) {
      return NextResponse.json(
        { error: "Order not found" },
        { status: 404 }
      );
    }

    // Get existing photos
    const currentPhotos = assignment.images
      ? Array.isArray(assignment.images)
        ? assignment.images
        : [assignment.images]
      : [];

    // Create new photo objects with IDs and timestamps
    const formattedNewPhotos = newPhotosData.map((photo: any, idx: number) => ({
      id: `img-${Date.now()}-${idx}`,
      data: photo.data,
      name: photo.name,
      uploadedAt: new Date().toISOString(),
    }));

    // Combine existing and new photos
    const updatedPhotos = [...currentPhotos, ...formattedNewPhotos];

    // Update the assignment
    const updated = await prisma.jobAssignment.update({
      where: { id: assignment.id },
      data: {
        images: updatedPhotos,
      },
      select: {
        images: true,
      },
    });

    return NextResponse.json({
      photos: updated.images || [],
      message: "Photos uploaded successfully",
    });
  } catch (error) {
    console.error("Photo upload error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
