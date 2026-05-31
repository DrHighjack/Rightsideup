import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getEffectivePrice } from "@/lib/pricing";

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user || (session.user as any).role !== "TC") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tcUserId = (session.user as any).id;

    // Get all linked agents for this TC
    const linkedAgents = await prisma.tCAgentLink.findMany({
      where: { tcUserId },
      include: {
        agentUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            brokerage: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    // Get all active master prices
    const masterPrices = await prisma.masterPrice.findMany({
      where: { isActive: true },
      orderBy: { serviceType: "asc" },
    });

    // For each agent, resolve their effective prices
    const agentsWithPrices = await Promise.all(
      linkedAgents.map(async (link) => {
        const effectivePrices = await Promise.all(
          masterPrices.map(async (masterPrice) => {
            const effectiveCents = await getEffectivePrice(
              masterPrice.serviceType,
              link.agentUser.id
            );
            return {
              serviceType: masterPrice.serviceType,
              amountCents: effectiveCents,
            };
          })
        );

        return {
          agentId: link.agentUser.id,
          firstName: link.agentUser.firstName,
          lastName: link.agentUser.lastName,
          email: link.agentUser.email,
          brokerageName: link.agentUser.brokerage?.name || "N/A",
          services: effectivePrices,
        };
      })
    );

    return NextResponse.json({ agents: agentsWithPrices });
  } catch (error) {
    console.error("Error fetching TC agent pricing:", error);
    return NextResponse.json(
      { error: "Failed to fetch agent pricing" },
      { status: 500 }
    );
  }
}
