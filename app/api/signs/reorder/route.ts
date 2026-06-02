import { auth } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";

// POST /api/signs/reorder - Realtor requests more signs or inventory items
export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as any;
  if (user.role !== "REALTOR" && user.role !== "TC" && user.role !== "ADMIN") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    // Support both old format (quantity, type) and new format (itemId, quantity, printerId)
    const { quantity, type, notes, itemId, printerId } = body;

    if (!quantity || quantity < 1) {
      return Response.json(
        { error: "quantity must be at least 1" },
        { status: 400 }
      );
    }

    // Determine if this is an inventory item reorder or traditional sign reorder
    const isInventoryReorder = !!itemId;

    let emailContent = "";
    let subject = "";

    if (isInventoryReorder) {
      // Inventory item reorder
      if (!printerId) {
        return Response.json(
          { error: "printerId is required for inventory orders" },
          { status: 400 }
        );
      }

      // Fetch item and printer details for email
      const item = await prisma.inventoryItem.findUnique({
        where: { id: itemId },
      });

      const printer = await prisma.signPrinter.findUnique({
        where: { id: printerId },
      });

      if (!item || !printer) {
        return Response.json(
          { error: "Item or printer not found" },
          { status: 404 }
        );
      }

      subject = `Inventory Reorder: ${quantity} x ${item.name} from ${user.name || user.email}`;
      emailContent = `
        <h2>Inventory Reorder Request</h2>
        <p><strong>From:</strong> ${user.name || user.email}</p>
        <p><strong>Item:</strong> ${item.name}</p>
        <p><strong>Quantity Requested:</strong> ${quantity}</p>
        <p><strong>Printer:</strong> ${printer.name}</p>
        ${notes ? `<p><strong>Special Instructions:</strong> ${notes}</p>` : ""}
        <p>Please process this inventory reorder request.</p>
      `;
    } else {
      // Traditional sign reorder (legacy format)
      subject = `Sign Reorder Request: ${quantity} signs from ${user.name || user.email}`;
      emailContent = `
        <h2>Sign Reorder Request</h2>
        <p><strong>From:</strong> ${user.name || user.email}</p>
        <p><strong>Quantity Requested:</strong> ${quantity}</p>
        <p><strong>Sign Type:</strong> ${type || "Any"}</p>
        ${notes ? `<p><strong>Notes:</strong> ${notes}</p>` : ""}
        <p>Please process this request and assign signs to the realtor in the admin panel.</p>
      `;
    }

    // Send email to admin
    const adminEmail = process.env.ADMIN_ALERT_EMAIL || "admin@signpost.local";

    try {
      await sendEmail({
        to: adminEmail,
        subject,
        html: emailContent,
      });
    } catch (emailErr) {
      console.error("Error sending reorder email:", emailErr);
      // Don't fail the request if email fails
    }

    return Response.json(
      {
        success: true,
        message: isInventoryReorder
          ? `Inventory order for ${quantity} items submitted. Admin will process your request.`
          : `Reorder request for ${quantity} signs sent to admin. You will be notified when signs are assigned.`,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("Error processing reorder request:", err);
    return Response.json({ error: "Failed to process reorder" }, { status: 500 });
  }
}
