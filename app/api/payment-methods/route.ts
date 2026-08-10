import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encryptToken } from "@/lib/encryption";
import { paymentMethodCreateSchema } from "@/lib/schemas";
import { ZodError } from "zod";

function detectCardBrand(cardNumber: string) {
  if (cardNumber.startsWith("4")) return "VISA";
  if (/^5[1-5]/.test(cardNumber)) return "MASTERCARD";
  if (/^3[47]/.test(cardNumber)) return "AMEX";
  if (/^6/.test(cardNumber)) return "DISCOVER";
  return "CARD";
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const cards = await prisma.paymentCard.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        nickname: true,
        cardBrand: true,
        cardLast4: true,
        expMonth: true,
        expYear: true,
        billingAddressLine1: true,
        billingAddressLine2: true,
        billingCity: true,
        billingState: true,
        billingPostalCode: true,
        billingCountry: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ cards, maxCards: 5 });
  } catch (error) {
    console.error("Failed to fetch payment methods:", error);
    return NextResponse.json({ error: "Failed to fetch payment methods" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsedBody = paymentMethodCreateSchema.parse(await request.json());
    const {
      nickname,
      cardNumber,
      cvv,
      expMonth,
      expYear,
      billingAddressLine1,
      billingAddressLine2,
      billingCity,
      billingState,
      billingPostalCode,
      billingCountry,
    } = parsedBody;

    const digitsOnly = String(cardNumber).replace(/\s+/g, "");
    const cvvDigits = String(cvv).trim();
    const month = expMonth;
    const year = expYear;

    const cardCount = await prisma.paymentCard.count({ where: { userId: session.user.id } });
    if (cardCount >= 5) {
      return NextResponse.json({ error: "Maximum of 5 cards allowed" }, { status: 400 });
    }

    const now = new Date();
    const created = await prisma.paymentCard.create({
      data: {
        userId: session.user.id,
        nickname: String(nickname).trim(),
        cardBrand: detectCardBrand(digitsOnly),
        cardLast4: digitsOnly.slice(-4),
        expMonth: month,
        expYear: year,
        encryptedCardNumber: encryptToken(digitsOnly),
        encryptedCvv: encryptToken(cvvDigits),
        billingAddressLine1: String(billingAddressLine1).trim(),
        billingAddressLine2: billingAddressLine2 ? String(billingAddressLine2).trim() : null,
        billingCity: String(billingCity).trim(),
        billingState: String(billingState).trim(),
        billingPostalCode: String(billingPostalCode).trim(),
        billingCountry: billingCountry ? String(billingCountry).trim() : "US",
        termsAcceptedAt: now,
        refundPolicyAcceptedAt: now,
        cardPolicyAcceptedAt: now,
      },
      select: {
        id: true,
        nickname: true,
        cardBrand: true,
        cardLast4: true,
        expMonth: true,
        expYear: true,
        billingAddressLine1: true,
        billingAddressLine2: true,
        billingCity: true,
        billingState: true,
        billingPostalCode: true,
        billingCountry: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ card: created }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.flatten() }, { status: 400 });
    }
    console.error("Failed to add payment method:", error);
    return NextResponse.json({ error: "Failed to add payment method" }, { status: 500 });
  }
}
