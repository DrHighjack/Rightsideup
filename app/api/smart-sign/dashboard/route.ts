import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { ensureSmartSignTrial, getSmartSignAgentDashboard } from "@/lib/smart-sign";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  const role = session?.user?.role;
  if (!session?.user?.id || (role !== "REALTOR" && role !== "TC")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const agentId = session.user.id;
  const hasTaggedPost = await prisma.smartSignTag.findFirst({
    where: { sign: { assignedToUserId: agentId } },
    select: { id: true },
  });
  if (hasTaggedPost) await ensureSmartSignTrial(agentId);

  return NextResponse.json(await getSmartSignAgentDashboard(agentId));
}
