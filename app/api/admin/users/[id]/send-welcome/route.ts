import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getWelcomeEmail, sendEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const realtor = await prisma.user.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        firstName: true,
        email: true,
        role: true,
        tags: true,
      },
    });

    if (!realtor || realtor.role !== "REALTOR") {
      return NextResponse.json({ error: "Realtor not found" }, { status: 404 });
    }
    if (realtor.tags.includes("INACTIVE")) {
      return NextResponse.json({ error: "Cannot send a welcome email to an inactive account" }, { status: 409 });
    }

    const appUrl = (
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXTAUTH_URL ||
      request.nextUrl.origin
    ).replace(/\/$/, "");
    const welcomeEmail = getWelcomeEmail(realtor.firstName || "there", `${appUrl}/login`);
    const result = await sendEmail({
      to: realtor.email,
      subject: welcomeEmail.subject,
      html: welcomeEmail.html,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: "Welcome email was not sent. Configure the Brevo email transport and try again." },
        { status: 503 }
      );
    }

    return NextResponse.json({ success: true, email: realtor.email });
  } catch (error) {
    console.error("Failed to send welcome email:", error);
    return NextResponse.json(
      { error: "Failed to send welcome email" },
      { status: 500 }
    );
  }
}
