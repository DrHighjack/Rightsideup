import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { createNoCacheResponse } from '@/lib/cache-response';
import { sendWelcomeEmailWithMagicLink } from '@/lib/send-welcome';

export const dynamic = 'force-dynamic';

const createFieldTechSchema = z.object({
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().min(1),
  email: z.string().trim().email(),
  phone: z.string().trim().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id || (session.user as any).role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const includeInactive = request.nextUrl.searchParams.get('includeInactive') === 'true';

    const fieldTechs = await prisma.user.findMany({
      where: {
        role: 'FIELD_TECH',
        ...(includeInactive ? {} : { NOT: { tags: { has: 'INACTIVE' } } }),
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        tags: true,
        createdAt: true,
        jobAssignments: {
          where: { completedAt: null }, // Count only non-completed assignments
          select: { id: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Add job count to each tech
    const fieldTechsWithCounts = fieldTechs.map((tech) => ({
      ...tech,
      isActive: !tech.tags.includes('INACTIVE'),
      assignedJobCount: tech.jobAssignments.length,
      tags: undefined,
      jobAssignments: undefined,
    }));

    return createNoCacheResponse(fieldTechsWithCounts);
  } catch (error: any) {
    console.error('[ADMIN FIELD-TECHS] Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id || (session.user as any).role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { firstName, lastName, email, phone } = createFieldTechSchema.parse(await request.json());
    const normalizedEmail = email.toLowerCase();
    const existing = await prisma.user.findFirst({
      where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
      select: { id: true },
    });

    if (existing) {
      return NextResponse.json({ error: 'User with this email already exists' }, { status: 409 });
    }

    const temporaryPassword = crypto.randomBytes(12).toString('base64url');
    const passwordHash = await bcrypt.hash(temporaryPassword, 12);
    const fieldTech = await prisma.user.create({
      data: {
        firstName,
        lastName,
        email: normalizedEmail,
        phone: phone || null,
        passwordHash,
        role: 'FIELD_TECH',
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        createdAt: true,
      },
    });

    let emailWarning: string | null = null;
    try {
      await sendWelcomeEmailWithMagicLink(
        fieldTech.id,
        fieldTech.firstName,
        fieldTech.email,
        temporaryPassword,
        { appUrl: process.env.NEXT_PUBLIC_APP_URL }
      );
    } catch (emailError) {
      console.error('[ADMIN FIELD-TECHS] Welcome email failed:', emailError);
      emailWarning = 'Installer created, but the welcome email could not be sent.';
    }

    return NextResponse.json(
      { fieldTech, temporaryPassword, emailWarning },
      { status: 201 }
    );
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json({ error: 'Invalid input', details: error.errors }, { status: 400 });
    }

    console.error('[ADMIN FIELD-TECHS] Create error:', error);
    return NextResponse.json({ error: 'Failed to create installer account' }, { status: 500 });
  }
}
