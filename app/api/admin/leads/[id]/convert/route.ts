import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id || (session.user as any)?.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { firstName, lastName, role = "REALTOR" } = body;

    // Fetch the lead
    const lead = await prisma.instaads.findUnique({
      where: { id: params.id },
    });

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    if (lead.convertedToClientId) {
      return NextResponse.json(
        { error: "Lead already converted to a client" },
        { status: 400 }
      );
    }

    // Determine name from lead or provided values
    const clientFirstName = firstName || lead.fullName.split(" ")[0];
    const clientLastName = lastName || lead.fullName.split(" ").slice(1).join(" ");

    // Generate temporary password
    const tempPassword = Math.random().toString(36).slice(-12);
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    // Create new user (client)
    const newClient = await prisma.user.create({
      data: {
        email: lead.email,
        firstName: clientFirstName,
        lastName: clientLastName,
        phone: lead.phone,
        passwordHash,
        role,
        brokerageName: lead.brokerage,
      },
    });

    // Update lead with converted client reference
    const updatedLead = await prisma.instaads.update({
      where: { id: params.id },
      data: {
        convertedToClientId: newClient.id,
        convertedAt: new Date(),
        status: "CONVERTED",
        lastContactedAt: new Date(),
      },
      include: {
        convertedToClient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: `Lead converted to ${role} client`,
      lead: updatedLead,
      client: newClient,
      tempPassword, // Return temp password for admin to share
    });
  } catch (error) {
    console.error("Failed to convert lead:", error);
    return NextResponse.json(
      { error: "Failed to convert lead" },
      { status: 500 }
    );
  }
}
