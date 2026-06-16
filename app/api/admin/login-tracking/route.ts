import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const session = await auth();
    
    if (!session?.user || (session.user as any).role !== "ADMIN") {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        createdAt: true,
        lastLoginAt: true,
      },
      orderBy: {
        lastLoginAt: {
          sort: "desc",
          nulls: "last",
        },
      },
    });

    return NextResponse.json({ users });
  } catch (error) {
    console.error("Failed to fetch login tracking data:", error);
    return NextResponse.json(
      { error: "Failed to fetch login tracking data" },
      { status: 500 }
    );
  }
}
