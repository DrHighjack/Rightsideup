import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { sendEmail } from '@/lib/email';
import { z } from 'zod';

const flagJobSchema = z.object({
  issue: z.string().min(1),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();

    if (!session?.user?.id || (session.user as any).role !== 'FIELD_TECH') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const fieldTechId = session.user.id;
    const { id } = params;
    const body = await request.json();
    const { issue } = flagJobSchema.parse(body);

    // Get assignment - verify it belongs to this field tech
    const assignment = await prisma.jobAssignment.findUnique({
      where: { id },
      include: {
        order: {
          include: {
            realtor: {
              select: {
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        fieldTech: {
          select: {
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!assignment) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    if (assignment.fieldTechId !== fieldTechId) {
      return NextResponse.json(
        { error: 'Forbidden - not assigned to you' },
        { status: 403 }
      );
    }

    // Update assignment with issue
    const updatedAssignment = await prisma.jobAssignment.update({
      where: { id },
      data: {
        issue,
      },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            address: true,
            status: true,
          },
        },
        fieldTech: {
          select: {
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // Send alert email to admin
    const adminAlertEmail = process.env.ADMIN_ALERT_EMAIL || 'alerts@northshoresignco.com';
    
    try {
      await sendEmail({
        to: adminAlertEmail,
        subject: `⚠️ Field Tech Issue Flagged - Order ${assignment.order.orderNumber}`,
        html: `
          <h2>Issue Flagged on Field Job</h2>
          <p><strong>Field Tech:</strong> ${assignment.fieldTech.firstName} ${assignment.fieldTech.lastName}</p>
          <p><strong>Order:</strong> ${assignment.order.orderNumber}</p>
          <p><strong>Address:</strong> ${assignment.order.address}</p>
          <p><strong>Issue:</strong></p>
          <p>${issue.replace(/\n/g, '<br>')}</p>
          <p><strong>Status:</strong> ${assignment.order.status}</p>
          <hr>
          <p><small>This is an automated alert. Please review and take action.</small></p>
        `,
      });
    } catch (emailError) {
      console.error('[FIELD JOB FLAG] Email send error:', emailError);
      // Don't fail the operation if email fails
    }

    return NextResponse.json(updatedAssignment);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request body', details: error.errors },
        { status: 400 }
      );
    }

    console.error('[FIELD JOB FLAG] Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
