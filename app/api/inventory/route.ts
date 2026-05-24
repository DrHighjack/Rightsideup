import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const signs = await prisma.sign.findMany({
      include: {
        assignedToUser: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
      orderBy: { signNumber: "asc" },
    });

    return NextResponse.json({ signs });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
