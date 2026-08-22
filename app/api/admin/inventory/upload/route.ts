import { put } from '@vercel/blob';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { mkdir, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB in bytes
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];
const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'pdf'];

const getBlobToken = () => process.env.BLOB_READ_WRITE_TOKEN || process.env.NEXT_PUBLIC_BLOB_READ_WRITE_TOKEN;
const shouldUseLocalUploads = () => process.env.UPLOAD_STORAGE === 'local' || process.env.NODE_ENV !== 'production';

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    if ((session.user as any).role !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Get form data
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File size exceeds 5MB limit (${(file.size / 1024 / 1024).toFixed(2)}MB)` },
        { status: 400 }
      );
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Only JPG, JPEG, PNG, and PDF files are allowed' },
        { status: 400 }
      );
    }

    // Validate file extension
    const fileName = file.name.toLowerCase();
    const fileExtension = fileName.split('.').pop();
    if (!fileExtension || !ALLOWED_EXTENSIONS.includes(fileExtension)) {
      return NextResponse.json(
        { error: 'Invalid file extension. Only .jpg, .jpeg, .png, and .pdf are allowed' },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const isPng = buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const isJpeg = buffer.length >= 3 && buffer.subarray(0, 3).equals(Buffer.from([255, 216, 255]));
    const isPdf = buffer.subarray(0, 5).toString('ascii') === '%PDF-';
    const hasValidSignature = (file.type === 'image/png' && isPng) ||
      (file.type === 'image/jpeg' && isJpeg) ||
      (file.type === 'application/pdf' && isPdf);

    if (!hasValidSignature) {
      return NextResponse.json(
        { error: 'File contents do not match the selected PNG, JPEG, or PDF type' },
        { status: 400 }
      );
    }

    // Generate unique filename with timestamp
    const timestamp = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
    const filename = `inventory/${timestamp}-${safeName}`;

    if (shouldUseLocalUploads()) {
      const uploadsDir = join(process.cwd(), 'public', 'uploads', 'inventory');
      if (!existsSync(uploadsDir)) {
        await mkdir(uploadsDir, { recursive: true });
      }

      const localName = `${timestamp}-${safeName}`;
      await writeFile(join(uploadsDir, localName), buffer);

      return NextResponse.json({
        success: true,
        url: `/uploads/inventory/${localName}`,
        filename: `uploads/inventory/${localName}`,
        storage: 'local',
      });
    }

    const blobToken = getBlobToken();

    // Upload to Vercel Blob
    const blobOptions: any = {
      contentType: file.type,
      access: 'private',
    };

    // Prefer explicit token when available, otherwise let Vercel resolve credentials.
    if (blobToken) {
      blobOptions.token = blobToken;
    }

    const blob = await put(filename, buffer, blobOptions);

    return NextResponse.json({
      success: true,
      url: blob.url,
      filename: blob.pathname,
    });
  } catch (error) {
    console.error('Image upload error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    );
  }
}
