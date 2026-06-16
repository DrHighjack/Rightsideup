import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(_request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the latest policy (there should be only one)
    const policy = await prisma.self811Policy.findFirst({
      orderBy: { updatedAt: 'desc' },
    });

    if (!policy) {
      return NextResponse.json(
        { error: 'Policy not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ policy });
  } catch (error) {
    console.error('Policy GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch policy' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id || (session.user as any).role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { content, version } = body;

    if (!content || !version) {
      return NextResponse.json(
        { error: 'Content and version are required' },
        { status: 400 }
      );
    }

    // Get existing policy
    let policy = await prisma.self811Policy.findFirst();

    if (policy) {
      // Update existing
      policy = await prisma.self811Policy.update({
        where: { id: policy.id },
        data: { content, version },
      });
    } else {
      // Create new if doesn't exist
      policy = await prisma.self811Policy.create({
        data: { content, version },
      });
    }

    return NextResponse.json({ policy });
  } catch (error) {
    console.error('Policy PUT error:', error);
    return NextResponse.json(
      { error: 'Failed to update policy' },
      { status: 500 }
    );
  }
}
