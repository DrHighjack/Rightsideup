import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

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

    const formData = await request.formData();
    const name = formData.get('name') as string;
    const width = formData.get('width') as string;
    const height = formData.get('height') as string;
    const material = formData.get('material') as string;
    const printerIdsStr = formData.get('printerIds') as string;
    const image = formData.get('image') as File;

    // Validation
    if (!name || !width || !height || !material || !image || !printerIdsStr) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      );
    }

    // Parse printer IDs
    let printerIds: string[] = [];
    try {
      printerIds = JSON.parse(printerIdsStr);
    } catch {
      return NextResponse.json(
        { error: 'Invalid printer IDs' },
        { status: 400 }
      );
    }

    if (!Array.isArray(printerIds) || printerIds.length === 0) {
      return NextResponse.json(
        { error: 'At least one printer must be selected' },
        { status: 400 }
      );
    }

    // Save image to public folder
    const uploadsDir = join(process.cwd(), 'public', 'uploads', 'custom-signs');
    
    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true });
    }

    const timestamp = Date.now();
    const fileName = `${timestamp}-${image.name}`;
    const filePath = join(uploadsDir, fileName);
    const fileUrl = `/uploads/custom-signs/${fileName}`;

    const buffer = await image.arrayBuffer();
    await writeFile(filePath, Buffer.from(buffer));

    // Create custom sign request in database
    const customSign = await prisma.sign.create({
      data: {
        type: 'Custom',
        assignedToUserId: session.user.id,
        status: 'RETIRED',
        notes: JSON.stringify({
          approvalStatus: 'PENDING_APPROVAL',
          name,
          width,
          height,
          material,
          imageUrl: fileUrl,
          requestedBy: session.user.email,
          requestedAt: new Date().toISOString(),
          preferredPrinterIds: printerIds,
        }),
      },
    });

    // Create printer associations (if the Sign model supports it)
    // Note: You may need to update your Prisma schema to support this relationship

    // Send admin notification (optional)
    console.log(`[CustomSigns] New custom sign request from ${session.user.email}: ${name} (${width}x${height})`);

    return NextResponse.json({ 
      success: true, 
      sign: customSign,
      message: 'Custom sign order submitted successfully. Please wait for admin approval.' 
    });
  } catch (error) {
    console.error('Custom sign creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create custom sign order' },
      { status: 500 }
    );
  }
}

export async function GET(_request: NextRequest) {
  try {
    const session = await auth();
    
    // Check authentication
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userRole = (session.user as any).role as string | undefined;

    // Build query based on role
    const where: any = { type: 'Custom' };
    
    if (userRole === 'ADMIN') {
      // Admins see all custom sign requests
    } else if (userRole === 'REALTOR' || userRole === 'TC') {
      // Realtors/TCs see only their own custom sign requests
      where.assignedToUserId = session.user.id;
    } else {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const signs = await prisma.sign.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ 
      success: true, 
      signs 
    });
  } catch (error) {
    console.error('Custom sign retrieval error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve custom sign requests' },
      { status: 500 }
    );
  }
}
