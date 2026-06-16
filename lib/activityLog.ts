import { prisma } from '@/lib/prisma';
import { ActivityAction } from '@prisma/client';

interface LogActivityParams {
  userId: string;
  action: ActivityAction;
  entityType: string;
  entityId: string;
  description: string;
  metadata?: Record<string, any>;
}

/**
 * Log an activity to the ActivityLog table
 * Used to create an audit trail of all significant actions in the system
 */
export async function logActivity({
  userId,
  action,
  entityType,
  entityId,
  description,
  metadata,
}: LogActivityParams): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: {
        userId,
        action,
        entityType,
        entityId,
        description,
        metadata,
      },
    });
    
    console.log(`✅ Activity logged:`, {
      userId,
      action,
      entityType,
      entityId,
      description,
    });
  } catch (error) {
    console.error('❌ Failed to log activity:', error);
    // Don't throw - logging shouldn't break the main operation
  }
}

/**
 * Get paginated activity logs with optional filtering
 */
export async function getActivityLogs(
  page: number = 1,
  pageSize: number = 50,
  filters?: {
    userId?: string;
    action?: ActivityAction;
    entityType?: string;
    startDate?: Date;
    endDate?: Date;
  }
) {
  const skip = (page - 1) * pageSize;

  // Build where clause based on filters
  const where: any = {};
  if (filters?.userId) where.userId = filters.userId;
  if (filters?.action) where.action = filters.action;
  if (filters?.entityType) where.entityType = filters.entityType;
  if (filters?.startDate || filters?.endDate) {
    where.createdAt = {};
    if (filters.startDate) where.createdAt.gte = filters.startDate;
    if (filters.endDate) where.createdAt.lte = filters.endDate;
  }

  const [logs, total] = await Promise.all([
    prisma.activityLog.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
    }),
    prisma.activityLog.count({ where }),
  ]);

  return {
    logs,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}
