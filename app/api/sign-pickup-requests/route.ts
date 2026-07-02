import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { sendSignPickupRequestNotification } from '@/lib/notifications';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    
    // Check authentication
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check authorization - REALTOR or TC
    const userRole = (session.user as any).role as string | undefined;
    if (!userRole || !['REALTOR', 'TC'].includes(userRole)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { location, dateNeeded, description } = body;

    // Validation
    if (!location || !dateNeeded) {
      return NextResponse.json(
        { error: 'Location and date needed are required' },
        { status: 400 }
      );
    }

    // Create the pickup request
    const pickupRequest = await prisma.signPickupRequest.create({
      data: {
        requestedByUserId: session.user.id,
        location,
        dateNeeded: new Date(dateNeeded),
        description: description || null,
        status: 'PENDING',
      },
      include: {
        requestedByUser: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // Get all admins to notify
    const admins = await prisma.user.findMany({
      where: { role: 'ADMIN' },
      select: { id: true, email: true },
    });

    // Send notifications to admins
    for (const admin of admins) {
      await sendSignPickupRequestNotification(admin.email, pickupRequest);
    }

    return NextResponse.json({ success: true, request: pickupRequest });
  } catch (error) {
    console.error('Sign pickup request error:', error);
    return NextResponse.json(
      { error: 'Failed to create pickup request' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    
    // Check authentication
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userRole = (session.user as any).role as string | undefined;

    // Build query based on role
    const where: any = {};
    if (userRole === 'ADMIN') {
      // Admins see all requests
    } else if (userRole === 'REALTOR' || userRole === 'TC') {
      // Realtors/TCs see only their own requests
      where.requestedByUserId = session.user.id;
    } else {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const requests = await prisma.signPickupRequest.findMany({
      where,
      include: {
        requestedByUser: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        approvedByUser: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ requests });
  } catch (error) {
    console.error('Fetch pickup requests error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch requests' },
      { status: 500 }
    );
  }
}
