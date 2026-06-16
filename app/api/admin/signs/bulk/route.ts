import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// POST /api/admin/signs/bulk - Create multiple signs in bulk
export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as any;
  if (user.role !== "ADMIN") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { signs, startNumber, type, quantity } = body;

    // Two modes: explicit signs array or auto-generate with startNumber + quantity
    let signData: Array<{
      signNumber: string;
      type: string;
    }> = [];

    if (signs && Array.isArray(signs)) {
      // Explicit list provided
      signData = signs;
    } else if (startNumber && type && quantity) {
      // Auto-generate sequential sign numbers
      // Assumes startNumber format like "SPF-S-0042"
      const match = startNumber.match(/^(.+?)-(\d+)$/);
      if (!match) {
        return Response.json(
          { error: "startNumber must be in format like SPF-S-0042" },
          { status: 400 }
        );
      }

      const [, prefix, numStr] = match;
      const paddingLength = numStr.length;

      // Query all existing signs with this prefix to find the highest number
      const existingSigns = await prisma.sign.findMany({
        where: {
          signNumber: {
            startsWith: prefix + "-",
          },
        },
        select: { signNumber: true },
      });

      // Parse all existing numbers and find the maximum
      let maxNum = parseInt(numStr) - 1; // Start from provided startNumber - 1
      for (const sign of existingSigns) {
        if (!sign.signNumber) continue;
        const numMatch = sign.signNumber.match(new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}-(\d+)$`));
        if (numMatch) {
          const num = parseInt(numMatch[1]);
          if (num > maxNum) {
            maxNum = num;
          }
        }
      }

      // Generate signs starting from maxNum + 1
      for (let i = 0; i < quantity; i++) {
        const newNum = maxNum + 1 + i;
        const paddedNum = String(newNum).padStart(paddingLength, "0");
        signData.push({
          signNumber: `${prefix}-${paddedNum}`,
          type,
        });
      }
    } else {
      return Response.json(
        { error: "Provide either 'signs' array or 'startNumber'+'type'+'quantity'" },
        { status: 400 }
      );
    }

    // Create all signs
    const created = await prisma.sign.createMany({
      data: signData.map((s) => ({
        signNumber: s.signNumber,
        type: s.type,
        status: "AVAILABLE",
      })),
      skipDuplicates: true,
    });

    return Response.json(
      {
        created: created.count,
        total: signData.length,
        message: `${created.count} of ${signData.length} signs created`,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("Error bulk creating signs:", err);
    return Response.json({ error: "Failed to create signs in bulk" }, { status: 500 });
  }
}
