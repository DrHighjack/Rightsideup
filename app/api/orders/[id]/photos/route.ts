import { get, put } from '@vercel/blob';
import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

interface OrderPhoto {
  id: string;
  pathname: string;
  name: string;
  uploadedAt: string;
  uploadedByUserId: string;
}

async function getAuthorizedOrder(orderId: string, userId: string, role: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, realtorId: true, photos: true },
  });
  if (!order) return { error: 'Order not found', status: 404 } as const;
  if (role === 'ADMIN' || (role === 'REALTOR' && order.realtorId === userId)) return { order } as const;

  if (role === 'TC') {
    const link = await prisma.tCAgentLink.findUnique({
      where: { tcUserId_agentUserId: { tcUserId: userId, agentUserId: order.realtorId } },
      select: { id: true },
    });
    if (link) return { order } as const;
  }

  return { error: 'Forbidden', status: 403 } as const;
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const authorization = await getAuthorizedOrder(params.id, session.user.id, (session.user as any).role);
    if ('error' in authorization) {
      return NextResponse.json({ error: authorization.error }, { status: authorization.status });
    }

    const formData = await request.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) return NextResponse.json({ error: 'Photo is required' }, { status: 400 });
    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json({ error: 'Only JPG, PNG, and WebP photos are allowed' }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'Photo must be 5MB or smaller' }, { status: 400 });
    }

    const id = randomUUID();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
    const pathname = `orders/${params.id}/${id}-${safeName}`;
    const blob = await put(pathname, Buffer.from(await file.arrayBuffer()), {
      access: 'private',
      contentType: file.type,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    const existingPhotos = Array.isArray(authorization.order.photos)
      ? (authorization.order.photos as unknown as OrderPhoto[])
      : [];
    const photo: OrderPhoto = {
      id,
      pathname: blob.pathname,
      name: file.name,
      uploadedAt: new Date().toISOString(),
      uploadedByUserId: session.user.id,
    };

    await prisma.order.update({
      where: { id: params.id },
      data: { photos: [...existingPhotos, photo] as any },
    });

    return NextResponse.json({
      photo: { id, name: photo.name, uploadedAt: photo.uploadedAt, url: `/api/orders/${params.id}/photos?photoId=${id}` },
    });
  } catch (error) {
    console.error('Order photo upload failed:', error);
    return NextResponse.json({ error: 'Failed to upload photo' }, { status: 500 });
  }
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const authorization = await getAuthorizedOrder(params.id, session.user.id, (session.user as any).role);
    if ('error' in authorization) {
      return NextResponse.json({ error: authorization.error }, { status: authorization.status });
    }

    const photoId = request.nextUrl.searchParams.get('photoId');
    const photos = Array.isArray(authorization.order.photos)
      ? (authorization.order.photos as unknown as OrderPhoto[])
      : [];
    const photo = photos.find((item) => item.id === photoId);
    if (!photo) return NextResponse.json({ error: 'Photo not found' }, { status: 404 });

    const blob = await get(photo.pathname, { access: 'private', token: process.env.BLOB_READ_WRITE_TOKEN });
    if (!blob || !blob.stream) return NextResponse.json({ error: 'Photo not found' }, { status: 404 });

    return new NextResponse(blob.stream, {
      headers: {
        'Content-Type': blob.blob.contentType || 'application/octet-stream',
        'Cache-Control': 'private, max-age=300',
      },
    });
  } catch (error) {
    console.error('Order photo retrieval failed:', error);
    return NextResponse.json({ error: 'Failed to load photo' }, { status: 500 });
  }
}