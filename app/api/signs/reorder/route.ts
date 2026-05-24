import { auth } from "@/lib/auth";
import { sendEmail } from "@/lib/email";

// POST /api/signs/reorder - Realtor requests more signs
export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as any;
  if (user.role !== "REALTOR" && user.role !== "TC") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { quantity, type, notes } = body;

    if (!quantity || quantity < 1) {
      return Response.json(
        { error: "quantity must be at least 1" },
        { status: 400 }
      );
    }

    // Send email to admin
    const adminEmail = process.env.ADMIN_ALERT_EMAIL || "admin@signpost.local";

    const emailContent = `
      <h2>Sign Reorder Request</h2>
      <p><strong>From:</strong> ${user.name || user.email}</p>
      <p><strong>Quantity Requested:</strong> ${quantity}</p>
      <p><strong>Sign Type:</strong> ${type || "Any"}</p>
      ${notes ? `<p><strong>Notes:</strong> ${notes}</p>` : ""}
      <p>Please process this request and assign signs to the realtor in the admin panel.</p>
    `;

    try {
      await sendEmail({
        to: adminEmail,
        subject: `Sign Reorder Request: ${quantity} signs from ${user.name || user.email}`,
        html: emailContent,
      });
    } catch (emailErr) {
      console.error("Error sending reorder email:", emailErr);
      // Don't fail the request if email fails
    }

    return Response.json(
      {
        message: `Reorder request for ${quantity} signs sent to admin. You will be notified when signs are assigned.`,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("Error processing reorder request:", err);
    return Response.json({ error: "Failed to process reorder" }, { status: 500 });
  }
}
