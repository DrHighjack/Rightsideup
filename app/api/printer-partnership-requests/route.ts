import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPrinterPartnershipRequestEmail, sendEmail } from "@/lib/email";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const role = session?.user?.role;
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (role !== "REALTOR" && role !== "TC") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = (await request.json()) as { name?: unknown; website?: unknown };
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const website = typeof body.website === "string" ? body.website.trim() : "";
    if (!name) return NextResponse.json({ error: "Printer name is required" }, { status: 400 });
    try { new URL(website); } catch { return NextResponse.json({ error: "A valid printer website is required" }, { status: 400 }); }

    const pending = await prisma.printerPartnershipRequest.create({
      data: { requestedByUserId: session.user.id, name, website },
    });
    const adminEmail = process.env.ADMIN_ALERT_EMAIL;
    if (adminEmail) {
      try {
        const email = getPrinterPartnershipRequestEmail({
          printerName: name,
          website,
          requestedBy: session.user.email || session.user.id,
        });
        await sendEmail({
          to: adminEmail,
          subject: email.subject,
          html: email.html,
        });
      } catch (emailError) { console.error("Printer request email failed:", emailError); }
    }
    return NextResponse.json({ success: true, request: pending, message: "Printer request submitted" }, { status: 201 });
  } catch (error) {
    console.error("Printer partnership request failed:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to submit printer request" }, { status: 500 });
  }
}