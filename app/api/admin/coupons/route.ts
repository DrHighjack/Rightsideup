/**
 * GET /api/admin/coupons - List all coupons
 * POST /api/admin/coupons - Create new coupon
 */

import { auth } from '@/lib/auth';
import { createCoupon, getActiveCoupons, getCouponStats } from '@/lib/discounts';
import { NextResponse } from 'next/server';
import { logActivity } from '@/lib/activityLog';
import { ActivityAction } from '@prisma/client';

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
    const { code, type, value, description, maxUses, expiresAt } = body;

    if (!code || !type || !value) {
      return NextResponse.json(
        { error: 'Missing required fields: code, type, value' },
        { status: 400 }
      );
    }

    if (!['FIXED', 'PERCENTAGE'].includes(type)) {
      return NextResponse.json(
        { error: 'Type must be FIXED or PERCENTAGE' },
        { status: 400 }
      );
    }

    if (type === 'PERCENTAGE' && (value < 0 || value > 100)) {
      return NextResponse.json(
        { error: 'Percentage value must be between 0 and 100' },
        { status: 400 }
      );
    }

    const coupon = await createCoupon({
      code,
      type,
      value,
      description,
      maxUses,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
    });

    // Log activity
    if (session?.user?.id) {
      await logActivity({
        userId: session.user.id,
        action: ActivityAction.COUPON_REDEEMED,
        entityType: 'Coupon',
        entityId: coupon.id,
        description: `Coupon created: ${code} (${type} - ${value})`,
        metadata: {
          code,
          type,
          value,
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
