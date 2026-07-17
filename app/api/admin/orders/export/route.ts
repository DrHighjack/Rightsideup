import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const BATCH_SIZE = 500;

function csvField(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export async function GET(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const type = searchParams.get("type");
  const search = searchParams.get("search");
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");

  const where: any = {};
  if (status) where.status = status;
  if (type) where.type = type;
  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) where.createdAt.gte = new Date(dateFrom);
    if (dateTo) {
      const endDate = new Date(dateTo);
      endDate.setHours(23, 59, 59, 999);
      where.createdAt.lte = endDate;
    }
  }
  if (search) {
    where.OR = [
      { orderNumber: { contains: search, mode: "insensitive" } },
      { address: { contains: search, mode: "insensitive" } },
    ];
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        controller.enqueue(
          encoder.encode(
            "Order #,Realtor,Email,Address,Type,Status,Date,Scheduled Date\n"
          )
        );

        let cursor: string | undefined;
        for (;;) {
          const batch = await prisma.order.findMany({
            where,
            take: BATCH_SIZE,
            ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              orderNumber: true,
              address: true,
              type: true,
              status: true,
              scheduledDate: true,
              createdAt: true,
              realtor: {
                select: { firstName: true, lastName: true, email: true },
              },
            },
          });

          if (batch.length === 0) break;

          const rows = batch
            .map((order) =>
              [
                csvField(order.orderNumber),
                csvField(`${order.realtor.firstName} ${order.realtor.lastName}`),
                csvField(order.realtor.email),
                csvField(order.address),
                csvField(order.type),
                csvField(order.status),
                order.createdAt.toISOString().split("T")[0],
                order.scheduledDate
                  ? order.scheduledDate.toISOString().split("T")[0]
                  : "",
              ].join(",")
            )
            .join("\n");

          controller.enqueue(encoder.encode(rows + "\n"));

          if (batch.length < BATCH_SIZE) break;
          cursor = batch[batch.length - 1].id;
        }

        controller.close();
      } catch (error) {
        console.error("CSV export error:", error);
        controller.error(error);
      }
    },
  });

  const filename = `orders-${new Date().toISOString().split("T")[0]}.csv`;
  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
