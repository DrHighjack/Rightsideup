import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { mkdir, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';

const getBlobToken = () => process.env.BLOB_READ_WRITE_TOKEN || process.env.NEXT_PUBLIC_BLOB_READ_WRITE_TOKEN;
const shouldUseLocalUploads = () => process.env.UPLOAD_STORAGE === 'local' || process.env.NODE_ENV !== 'production';
const getBlobAccess = (): 'public' | 'private' => (process.env.BLOB_ACCESS === 'private' ? 'private' : 'public');

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

    const timestamp = Date.now();
    const safeName = image.name.replace(/[^a-zA-Z0-9._-]/g, '-');
    const fileName = `custom-signs/${timestamp}-${safeName}`;

    const buffer = await image.arrayBuffer();
    let imageUrl: string;

    if (shouldUseLocalUploads()) {
      const uploadsDir = join(process.cwd(), 'public', 'uploads', 'custom-signs');
      if (!existsSync(uploadsDir)) {
        await mkdir(uploadsDir, { recursive: true });
      }

      const localName = `${timestamp}-${safeName}`;
      await writeFile(join(uploadsDir, localName), Buffer.from(buffer));
      imageUrl = `/uploads/custom-signs/${localName}`;
    } else {
      const blobToken = getBlobToken();
      const blobOptions: any = {
        access: getBlobAccess(),
        contentType: image.type || 'application/octet-stream',
      };

      // Prefer explicit token when available, otherwise let Vercel resolve credentials.
      if (blobToken) {
        blobOptions.token = blobToken;
      }

      const blob = await put(fileName, Buffer.from(buffer), blobOptions);
      imageUrl = blob.url;
    }

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
          imageUrl,
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
