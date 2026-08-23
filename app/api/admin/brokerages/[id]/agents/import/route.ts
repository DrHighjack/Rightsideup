import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseRealtorCsv } from "@/lib/realtor-csv";
import { sendWelcomeEmailWithMagicLink } from "@/lib/send-welcome";

const MAX_CSV_SIZE = 1024 * 1024;
const MAX_REALTORS = 250;

function generateTemporaryPassword(): string {
  return `${randomBytes(9).toString("base64url")}aA1!`;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    const role = (session?.user as any)?.role;
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (role !== "ADMIN" && role !== "SALESMEN") {
      const user = role === "BROKERAGE"
        ? await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { brokerageId: true },
          })
        : null;
      if (user?.brokerageId !== params.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const brokerage = await prisma.brokerage.findUnique({
      where: { id: params.id },
      select: { id: true },
    });
    if (!brokerage) {
      return NextResponse.json({ error: "Brokerage not found" }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "A CSV file is required" }, { status: 400 });
    }
    if (file.size > MAX_CSV_SIZE) {
      return NextResponse.json({ error: "CSV must be 1 MB or smaller" }, { status: 400 });
    }

    const parsed = parseRealtorCsv(await file.text());
    if (parsed.rows.length > MAX_REALTORS) {
      return NextResponse.json(
        { error: `CSV cannot contain more than ${MAX_REALTORS} valid realtors` },
        { status: 400 }
      );
    }

    const duplicateRows = new Map<string, number>();
    const uniqueRows = parsed.rows.filter((row) => {
      const firstRow = duplicateRows.get(row.email);
      if (firstRow) {
        parsed.errors.push({ rowNumber: row.rowNumber, error: `Duplicate email from row ${firstRow}` });
        return false;
      }
      duplicateRows.set(row.email, row.rowNumber);
      return true;
    });
    const existingUsers = await prisma.user.findMany({
      where: {
        email: {
          in: uniqueRows.map((row) => row.email),
          mode: "insensitive",
        },
      },
      select: { email: true },
    });
    const existingEmails = new Set(existingUsers.map((user) => user.email.toLowerCase()));

    let created = 0;
    let emailsSent = 0;
    const results = [...parsed.errors];

    for (const row of uniqueRows) {
      if (existingEmails.has(row.email)) {
        results.push({ rowNumber: row.rowNumber, error: "A user with this email already exists" });
        continue;
      }

      try {
        const temporaryPassword = generateTemporaryPassword();
        const agent = await prisma.user.create({
          data: {
            email: row.email,
            firstName: row.firstName,
            lastName: row.lastName,
            phone: row.phone || null,
            role: "REALTOR",
            paymentMethod: "OFFICE",
            brokerageId: brokerage.id,
            passwordHash: await bcrypt.hash(temporaryPassword, 12),
          },
        });
        created += 1;

        try {
          await sendWelcomeEmailWithMagicLink(
            agent.id,
            agent.firstName,
            agent.email,
            temporaryPassword
          );
          emailsSent += 1;
        } catch {
          results.push({ rowNumber: row.rowNumber, error: "Account created, but welcome email failed" });
        }
      } catch (error: any) {
        const duplicate = error?.code === "P2002";
        results.push({
          rowNumber: row.rowNumber,
          error: duplicate ? "A user with this email already exists" : "Account could not be created",
        });
      }
    }

    return NextResponse.json({
      created,
      emailsSent,
      failed: results.length,
      results: results.sort((left, right) => left.rowNumber - right.rowNumber),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to import CSV";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}