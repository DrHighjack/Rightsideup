import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";

const schema = z.object({
  inquiryType: z.enum(["CONTACT", "REMINDER"]), orderId: z.string().min(1), name: z.string().trim().min(2).max(100).optional(),
  phone: z.string().trim().min(7).max(40), email: z.string().trim().email().max(200), message: z.string().trim().min(2).max(1000).optional(),
  notifyWhen: z.enum(["SOLD", "PENDING", "OFF_MARKET"]).optional(), termsAccepted: z.literal(true).optional(),
});

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] || character);
}

export async function POST(request: NextRequest, { params }: { params: { tagCode: string } }) {
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success || (parsed.data.inquiryType === "CONTACT" && (!parsed.data.name || !parsed.data.message)) || (parsed.data.inquiryType === "REMINDER" && (!parsed.data.notifyWhen || parsed.data.termsAccepted !== true))) {
    return NextResponse.json({ error: "Please complete all required fields and accept the terms." }, { status: 400 });
  }
  const tag = await prisma.smartSignTag.findUnique({ where: { tagCode: params.tagCode }, include: { sign: { include: { assignedToOrder: true, assignedToUser: true } } } });
  if (!tag || !tag.isActive || tag.sign.assignedToOrder?.id !== parsed.data.orderId || !tag.sign.assignedToUser) return NextResponse.json({ error: "This listing is unavailable." }, { status: 404 });
  const inquiry = await prisma.smartSignInquiry.create({ data: { tagCode: params.tagCode, orderId: parsed.data.orderId, inquiryType: parsed.data.inquiryType, name: parsed.data.name, phone: parsed.data.phone, email: parsed.data.email, message: parsed.data.message, notifyWhen: parsed.data.notifyWhen, termsAccepted: parsed.data.termsAccepted === true } });
  const destination = tag.sign.assignedToUser.email;
  const name = escapeHtml(parsed.data.name || "Not provided");
  const phone = escapeHtml(parsed.data.phone);
  const email = escapeHtml(parsed.data.email);
  const notifyWhen = escapeHtml(parsed.data.notifyWhen || "N/A");
  const message = escapeHtml(parsed.data.message || "N/A");
  await sendEmail({ to: destination, subject: `${parsed.data.inquiryType === "CONTACT" ? "New listing inquiry" : "New listing reminder signup"} for ${tag.sign.assignedToOrder.address}`, html: `<p>A visitor submitted a ${parsed.data.inquiryType.toLowerCase()} request for <strong>${escapeHtml(tag.sign.assignedToOrder.address)}</strong>.</p><p>Name: ${name}<br>Phone: ${phone}<br>Email: ${email}<br>Notify when: ${notifyWhen}<br>Message: ${message}</p><p>Inquiry ID: ${escapeHtml(inquiry.id)}</p>` });
  return NextResponse.json({ success: true });
}