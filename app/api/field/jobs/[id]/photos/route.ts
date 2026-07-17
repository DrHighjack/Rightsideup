import { put } from '@vercel/blob';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const MAX_FILE_SIZE = 8 * 1024 * 1024; // 8MB in bytes
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id || (session.user as any).role !== 'FIELD_TECH') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const assignment = await prisma.jobAssignment.findUnique({
      where: { id: params.id },
      select: { id: true, fieldTechId: true, completedAt: true },
    });

    if (!assignment) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }
    if (assignment.fieldTechId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden - not assigned to you' }, { status: 403 });
    }
    if (assignment.completedAt) {
      return NextResponse.json({ error: 'Job already completed' }, { status: 400 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File size exceeds 8MB limit (${(file.size / 1024 / 1024).toFixed(2)}MB)` },
        { status: 400 }
      );
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Only JPG, PNG, and WebP images are allowed' },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const timestamp = Date.now();
    const filename = `job-photos/${params.id}/${timestamp}-${file.name}`;

    const blob = await put(filename, buffer, {
      contentType: file.type,
      access: 'public',
    });

    return NextResponse.json({ url: blob.url, name: file.name });
  } catch (error) {
    console.error('Job photo upload error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    );
  }
}
