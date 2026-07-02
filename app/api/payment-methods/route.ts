import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encryptToken } from "@/lib/encryption";

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

    const body = await request.json();
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
      termsAccepted,
    } = body;

    if (!nickname || !cardNumber || !cvv || !expMonth || !expYear || !billingAddressLine1 || !billingCity || !billingState || !billingPostalCode) {
      return NextResponse.json({ error: "All card and billing fields are required" }, { status: 400 });
    }

    if (!termsAccepted) {
      return NextResponse.json(
        { error: "You must accept Terms of Service, Refund Policy, and Credit Card Payment Policy" },
        { status: 400 }
      );
    }

    const digitsOnly = String(cardNumber).replace(/\s+/g, "");
    if (!/^\d{13,19}$/.test(digitsOnly)) {
      return NextResponse.json({ error: "Card number must be 13-19 digits" }, { status: 400 });
    }

    const cvvDigits = String(cvv).trim();
    if (!/^\d{3,4}$/.test(cvvDigits)) {
      return NextResponse.json({ error: "CVV must be 3 or 4 digits" }, { status: 400 });
    }

    const month = Number(expMonth);
    const year = Number(expYear);
    if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(year) || year < new Date().getFullYear()) {
      return NextResponse.json({ error: "Invalid expiration date" }, { status: 400 });
    }

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
    console.error("Failed to add payment method:", error);
    return NextResponse.json({ error: "Failed to add payment method" }, { status: 500 });
  }
}
