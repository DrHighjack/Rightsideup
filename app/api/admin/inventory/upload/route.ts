import { put } from '@vercel/blob';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB in bytes
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'];

const getBlobToken = () => process.env.BLOB_READ_WRITE_TOKEN || process.env.NEXT_PUBLIC_BLOB_READ_WRITE_TOKEN;

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
        { error: 'Only JPG, PNG, and WebP images are allowed' },
        { status: 400 }
      );
    }

    // Validate file extension
    const fileName = file.name.toLowerCase();
    const fileExtension = fileName.split('.').pop();
    if (!fileExtension || !ALLOWED_EXTENSIONS.includes(fileExtension)) {
      return NextResponse.json(
        { error: 'Invalid file extension. Only .jpg, .png, .webp allowed' },
        { status: 400 }
      );
    }

    const blobToken = getBlobToken();
    if (!blobToken) {
      return NextResponse.json(
        {
          error:
            'Image uploads are not configured. Set BLOB_READ_WRITE_TOKEN in your Vercel environment variables and redeploy.',
        },
        { status: 500 }
      );
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Generate unique filename with timestamp
    const timestamp = Date.now();
    const filename = `inventory/${timestamp}-${file.name}`;

    // Upload to Vercel Blob
    const blob = await put(filename, buffer, {
      contentType: file.type,
      access: 'public',
      token: blobToken,
    });

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
