/**
 * POST /api/orders/[id]/coupon - Apply coupon to order
 * DELETE /api/orders/[id]/coupon?couponId=xxx - Remove coupon from order
 */

import { auth } from '@/lib/auth';
import {
  validateAndApplyCoupon,
  applyCouponToOrder,
  removeCouponFromOrder,
  getOrderPriceSummary,
} from '@/lib/discounts';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { couponCode } = body;

    if (!couponCode) {
      return NextResponse.json(
        { error: 'Coupon code required' },
        { status: 400 }
      );
    }

    // Get order
    const order = await prisma.order.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        realtorId: true,
      },
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Check permissions
    if (session.user?.id !== order.realtorId && (session.user as any)?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const orderSummary = await getOrderPriceSummary(params.id);
    const subtotal = orderSummary.subtotal;

    // Validate coupon
    const validation = await validateAndApplyCoupon(couponCode, subtotal);

    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    // Apply coupon
    const orderDiscount = await applyCouponToOrder(
      params.id,
      validation.coupon!.id,
      validation.coupon!.discountAmount!
    );

    // Get updated price summary
    const summary = await getOrderPriceSummary(params.id);

    return NextResponse.json({
      message: 'Coupon applied successfully',
      discount: orderDiscount,
      priceSummary: summary,
    });
  } catch (error) {
    console.error('Error applying coupon:', error);
    return NextResponse.json(
      { error: 'Failed to apply coupon' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(req.url);
    const couponId = url.searchParams.get('couponId');

    if (!couponId) {
      return NextResponse.json(
        { error: 'Coupon ID required' },
        { status: 400 }
      );
    }

    // Get order
    const order = await prisma.order.findUnique({
      where: { id: params.id },
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Check permissions
    if (session.user?.id !== order.realtorId && (session.user as any)?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Remove coupon
    await removeCouponFromOrder(params.id, couponId);

    // Get updated price summary
    const summary = await getOrderPriceSummary(params.id);

    return NextResponse.json({
      message: 'Coupon removed successfully',
      priceSummary: summary,
    });
  } catch (error) {
    console.error('Error removing coupon:', error);
    return NextResponse.json(
      { error: 'Failed to remove coupon' },
      { status: 500 }
    );
  }
}
