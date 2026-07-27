import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const printers = await prisma.signPrinter.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        website: true,
        phone: true,
        email: true,
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ printers });
  } catch (error) {
    console.error("Printer list error:", error);
    return NextResponse.json({ error: "Failed to fetch printers" }, { status: 500 });
  }
}