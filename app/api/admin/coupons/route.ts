/**
 * GET /api/admin/coupons - List all coupons
 * POST /api/admin/coupons - Create new coupon
 */

import { auth } from '@/lib/auth';
import { createCoupon, getActiveCoupons, getCouponStats } from '@/lib/discounts';
import { NextResponse } from 'next/server';
import { logActivity } from '@/lib/activityLog';
import { ActivityAction } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const session = await auth();

    if (!session || (session.user as any)?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [activeCoupons, stats] = await Promise.all([
      getActiveCoupons(),
      getCouponStats(),
    ]);

    return NextResponse.json({
      coupons: activeCoupons,
      stats,
    });
  } catch (error) {
    console.error('Error fetching coupons:', error);
    return NextResponse.json(
      { error: 'Failed to fetch coupons' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();

    if (!session || (session.user as any)?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { code, type, value, description, maxUses, expiresAt, isCredit, assignedUserId } = body;
    const numericValue = Number(value);

    if ((!isCredit && !code) || !type || !Number.isFinite(numericValue) || numericValue <= 0) {
      return NextResponse.json(
        { error: 'A positive value and all required fields are required' },
        { status: 400 }
      );
    }

    if (isCredit && !assignedUserId) {
      return NextResponse.json({ error: 'Select a realtor account' }, { status: 400 });
    }

    if (isCredit) {
      const realtor = await prisma.user.findFirst({
        where: { id: assignedUserId, role: 'REALTOR' },
        select: { id: true },
      });
      if (!realtor) {
        return NextResponse.json({ error: 'Realtor account not found' }, { status: 404 });
      }
    }

    if (!['FIXED', 'PERCENTAGE'].includes(type)) {
      return NextResponse.json(
        { error: 'Type must be FIXED or PERCENTAGE' },
        { status: 400 }
      );
    }

    if (!isCredit && type === 'PERCENTAGE' && (numericValue < 0 || numericValue > 100)) {
      return NextResponse.json(
        { error: 'Percentage value must be between 0 and 100' },
        { status: 400 }
      );
    }

    const creditCode = `CREDIT-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const coupon = await createCoupon({
      code: isCredit ? creditCode : code,
      type: isCredit ? 'FIXED' : type,
      value: numericValue,
      remainingValue: isCredit ? numericValue : undefined,
      isCredit: Boolean(isCredit),
      assignedUserId: isCredit ? assignedUserId : undefined,
      description,
      maxUses: isCredit ? undefined : maxUses,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
    });

    // Log activity
    if (session?.user?.id) {
      await logActivity({
        userId: session.user.id,
        action: ActivityAction.COUPON_REDEEMED,
        entityType: 'Coupon',
        entityId: coupon.id,
        description: isCredit
          ? `Account credit granted: $${numericValue.toFixed(2)}`
          : `Coupon created: ${code} (${type} - ${numericValue})`,
        metadata: {
          code: isCredit ? creditCode : code,
          type: isCredit ? 'FIXED' : type,
          value: numericValue,
          isCredit: Boolean(isCredit),
          assignedUserId: isCredit ? assignedUserId : undefined,
          maxUses,
          expiresAt,
        },
      });
    }

    return NextResponse.json(coupon, { status: 201 });
  } catch (error: any) {
    console.error('Error creating coupon:', error);

    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Coupon code already exists' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create coupon' },
      { status: 500 }
    );
  }
}
