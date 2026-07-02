/**
 * Unified Notification Service
 * Handles SMS and Email notifications for orders and events
 */

import nodemailer from 'nodemailer';
import twilio from 'twilio';
import { prisma } from '@/lib/prisma';

// Twilio client
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

export type NotificationEvent = 
  | 'ORDER_CREATED'
  | 'ORDER_CONFIRMED'
  | 'ORDER_COMPLETED'
  | 'ORDER_CANCELLED'
  | 'ORDER_ASSIGNED'
  | 'INVOICE_READY'
  | 'PAYMENT_RECEIVED'
  | 'SIGN_INSTALLED';

interface NotificationPayload {
  event: NotificationEvent;
  orderId?: string;
  realtorId?: string;
  brokerId?: string;
  recipientPhone?: string;
  recipientEmail?: string;
  data?: Record<string, any>;
}

/**
 * Get template for notification
 */
function getNotificationTemplate(event: NotificationEvent, data?: Record<string, any>) {
  const templates: Record<NotificationEvent, { sms: string; emailSubject: string; emailBody: string }> = {
    ORDER_CREATED: {
      sms: `New order #${data?.orderNumber} created. Address: ${data?.address}`,
      emailSubject: `New Order #${data?.orderNumber} Created`,
      emailBody: `A new order has been created:\n\nOrder #: ${data?.orderNumber}\nAddress: ${data?.address}\nScheduled: ${data?.scheduledDate || 'TBD'}`,
    },
    ORDER_CONFIRMED: {
      sms: `Order #${data?.orderNumber} confirmed for ${data?.scheduledDate}`,
      emailSubject: `Order #${data?.orderNumber} Confirmed`,
      emailBody: `Your order has been confirmed for ${data?.scheduledDate}`,
    },
    ORDER_COMPLETED: {
      sms: `Order #${data?.orderNumber} has been completed!`,
      emailSubject: `Order #${data?.orderNumber} Completed`,
      emailBody: `Your order #${data?.orderNumber} has been completed successfully.`,
    },
    ORDER_CANCELLED: {
      sms: `Order #${data?.orderNumber} has been cancelled. Reason: ${data?.reason || 'N/A'}`,
      emailSubject: `Order #${data?.orderNumber} Cancelled`,
      emailBody: `Your order #${data?.orderNumber} has been cancelled.\n\nReason: ${data?.reason || 'N/A'}`,
    },
    ORDER_ASSIGNED: {
      sms: `New job assigned: ${data?.address}. Due: ${data?.dueDate}`,
      emailSubject: `New Job Assigned`,
      emailBody: `You have been assigned a new job at ${data?.address}, scheduled for ${data?.dueDate}`,
    },
    INVOICE_READY: {
      sms: `Your invoice #${data?.invoiceId} is ready. Amount: $${data?.amount}`,
      emailSubject: `Invoice #${data?.invoiceId} Ready`,
      emailBody: `Your invoice #${data?.invoiceId} for $${data?.amount} is now available.`,
    },
    PAYMENT_RECEIVED: {
      sms: `Payment of $${data?.amount} received for invoice #${data?.invoiceId}`,
      emailSubject: `Payment Received`,
      emailBody: `We've received your payment of $${data?.amount} for invoice #${data?.invoiceId}. Thank you!`,
    },
    SIGN_INSTALLED: {
      sms: `Sign installed at ${data?.address}. Job: ${data?.orderNumber}`,
      emailSubject: `Sign Installation Complete`,
      emailBody: `The sign has been successfully installed at ${data?.address} for order #${data?.orderNumber}`,
    },
  };

  return templates[event] || { sms: 'Notification', emailSubject: 'Update', emailBody: 'Update' };
}

/**
 * Send SMS notification
 */
export async function sendSMS(
  toNumber: string,
  message: string,
  eventType: NotificationEvent,
  orderId?: string
): Promise<boolean> {
  try {
    // Log the SMS attempt
    const smsLog = await prisma.sMSLog.create({
      data: {
        toNumber,
        message,
        eventType,
        orderId,
        status: 'PENDING',
      },
    });

    // Send via Twilio
    const result = await twilioClient.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: toNumber,
    });

    // Update log with success
    await prisma.sMSLog.update({
      where: { id: smsLog.id },
      data: {
        status: 'SENT',
        sentAt: new Date(),
      },
    });

    console.log(`✅ SMS sent to ${toNumber}: ${result.sid}`);
    return true;
  } catch (error) {
    console.error(`❌ SMS send failed to ${toNumber}:`, error);
    
    // Log failure
    await prisma.sMSLog.create({
      data: {
        toNumber,
        message,
        eventType,
        orderId,
        status: 'FAILED',
        failureReason: error instanceof Error ? error.message : 'Unknown error',
      },
    });

    return false;
  }
}

/**
 * Send Email notification (uses existing email service)
 */
/**
 * Get email transporter
 */
async function getEmailTransporter() {
  if (process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_USER && process.env.SMTP_PASS) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT),
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  // Fallback to test account
  console.warn("Email: Using test account (Ethereal) for development");
  const testAccount = await nodemailer.createTestAccount();
  return nodemailer.createTransport({
    host: "smtp.ethereal.email",
    port: 587,
    secure: false,
    auth: {
      user: testAccount.user,
      pass: testAccount.pass,
    },
  });
}

export async function sendEmailNotification(
  toEmail: string,
  subject: string,
  body: string
): Promise<boolean> {
  try {
    const transporter = await getEmailTransporter();

    await transporter.sendMail({
      from: process.env.SMTP_FROM || 'noreply@rightsignup.com',
      to: toEmail,
      subject,
      html: `<p>${body.replace(/\n/g, '<br>')}</p>`,
    });
    console.log(`✅ Email sent to ${toEmail}`);
    return true;
  } catch (error) {
    console.error(`❌ Email send failed to ${toEmail}:`, error);
    return false;
  }
}

/**
 * Main notification dispatcher
 */
export async function sendNotification(payload: NotificationPayload): Promise<void> {
  const template = getNotificationTemplate(payload.event, payload.data);

  console.log(`📢 Sending ${payload.event} notification...`);

  // Send SMS if phone provided
  if (payload.recipientPhone) {
    await sendSMS(payload.recipientPhone, template.sms, payload.event, payload.orderId);
  }

  // Send Email if email provided
  if (payload.recipientEmail) {
    await sendEmailNotification(payload.recipientEmail, template.emailSubject, template.emailBody);
  }
}

/**
 * Send order update notifications to all stakeholders
 */
export async function notifyOrderUpdate(
  orderId: string,
  event: NotificationEvent,
  data?: Record<string, any>
): Promise<void> {
  try {
    // Get order with related data
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        realtor: {
          include: { brokerage: true },
        },
      },
    });

    if (!order) {
      console.warn(`Order ${orderId} not found for notification`);
      return;
    }

    const orderData = {
      orderNumber: order.orderNumber,
      address: order.address,
      scheduledDate: order.scheduledDate?.toLocaleDateString(),
      ...data,
    };

    // Notify realtor
    if (order.realtor.phone) {
      await sendNotification({
        event,
        orderId,
        recipientPhone: order.realtor.phone,
        recipientEmail: order.realtor.email,
        data: orderData,
      });
    }

    // Notify broker admin if applicable
    if (order.realtor.brokerage?.adminId && order.realtor.brokerage.phone) {
      await sendNotification({
        event,
        orderId,
        recipientPhone: order.realtor.brokerage.phone,
        data: orderData,
      });
    }

    console.log(`✅ Order notifications sent for ${event}`);
  } catch (error) {
    console.error(`Error sending order notifications:`, error);
  }
}

/**
 * Get SMS delivery statistics
 */
export async function getSMSStats(startDate?: Date, endDate?: Date) {
  const where = {
    createdAt: {
      gte: startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
      lte: endDate || new Date(),
    },
  };

  const [total, sent, failed] = await Promise.all([
    prisma.sMSLog.count({ where }),
    prisma.sMSLog.count({ where: { ...where, status: 'SENT' } }),
    prisma.sMSLog.count({ where: { ...where, status: 'FAILED' } }),
  ]);

  return {
    total,
    sent,
    failed,
    successRate: total > 0 ? ((sent / total) * 100).toFixed(2) + '%' : '0%',
  };
}

/**
 * Notify realtor that 811 process has started
 */
export async function notifyRealtorAbout811Start(
  realtorId: string,
  ticketNumber: string,
  address: string
): Promise<void> {
  try {
    const realtor = await prisma.user.findUnique({
      where: { id: realtorId },
      select: { email: true, firstName: true, phone: true },
    });

    if (!realtor) {
      console.warn(`Realtor ${realtorId} not found`);
      return;
    }

    const title = '811 Ticket Submitted';
    const message = `Your 811 locate request (Ticket #${ticketNumber}) for ${address} has been submitted.`;

    // Send SMS
    if (realtor.phone) {
      await sendSMS(realtor.phone, message, 'ORDER_CREATED');
    }

    // Send email
    const emailHtml = `
      <h2>${title}</h2>
      <p>Hi ${realtor.firstName},</p>
      <p>Your 811 locate request has been submitted:</p>
      <ul>
        <li><strong>Ticket Number:</strong> ${ticketNumber}</li>
        <li><strong>Address:</strong> ${address}</li>
      </ul>
      <p>We'll notify you when the location is confirmed and the ticket is processed.</p>
    `;

    if (realtor.email) {
      await sendEmailNotification(realtor.email, title, emailHtml);
    }

    console.log(`✅ 811 start notification sent to realtor ${realtorId}`);
  } catch (error) {
    console.error('Error notifying about 811 start:', error);
  }
}

/**
 * Notify realtor that post location has been confirmed
 */
export async function notifyRealtorAbout811Confirmed(
  realtorId: string,
  ticketNumber: string,
  address: string
): Promise<void> {
  try {
    const realtor = await prisma.user.findUnique({
      where: { id: realtorId },
      select: { email: true, firstName: true, phone: true },
    });

    if (!realtor) {
      console.warn(`Realtor ${realtorId} not found`);
      return;
    }

    const title = '811 Location Confirmed';
    const message = `The post location for your 811 ticket #${ticketNumber} has been confirmed. The ticket is now in the system and ready for scheduling.`;

    // Send SMS
    if (realtor.phone) {
      await sendSMS(realtor.phone, message, 'ORDER_CONFIRMED');
    }

    // Send email
    const emailHtml = `
      <h2>${title}</h2>
      <p>Hi ${realtor.firstName},</p>
      <p>Great news! The post location for your 811 locate request has been confirmed:</p>
      <ul>
        <li><strong>Ticket Number:</strong> ${ticketNumber}</li>
        <li><strong>Address:</strong> ${address}</li>
        <li><strong>Status:</strong> Location Confirmed</li>
      </ul>
      <p>The ticket is now in the system and ready for scheduling. We'll proceed with your sign installation.</p>
    `;

    if (realtor.email) {
      await sendEmailNotification(realtor.email, title, emailHtml);
    }

    console.log(`✅ 811 confirmation notification sent to realtor ${realtorId}`);
  } catch (error) {
    console.error('Error notifying about 811 confirmation:', error);
  }
}

/**
 * Phase 5 — DB-level Notifications
 * These notifications appear in the user's dashboard notification center
 */

interface CreateNotificationParams {
  userId: string;
  type: string;
  title: string;
  message: string;
  link?: string;
}

/**
 * Create an in-app notification for a user
 * Soft error handling - logs but doesn't throw to avoid breaking operations
 */
export async function createNotification({
  userId,
  type,
  title,
  message,
  link,
}: CreateNotificationParams): Promise<any> {
  try {
    const notification = await prisma.notification.create({
      data: {
        userId,
        type,
        title,
        message,
        link,
        status: 'UNREAD',
      },
    });

    console.log(`[Notification] Created for user ${userId}: ${title}`);
    return notification;
  } catch (error) {
    console.error(`[Notification] Failed to create notification for user ${userId}:`, error);
    // Don't throw - allow the operation to continue
    return null;
  }
}

/**
 * Get unread notifications for a user
 */
export async function getUnreadNotifications(userId: string, limit: number = 10) {
  try {
    const notifications = await prisma.notification.findMany({
      where: {
        userId,
        status: 'UNREAD',
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    });

    return notifications;
  } catch (error) {
    console.error(`[Notification] Failed to fetch unread notifications for user ${userId}:`, error);
    return [];
  }
}

/**
 * Get all notifications for a user (both read and unread)
 */
export async function getAllNotifications(userId: string, limit: number = 10) {
  try {
    const notifications = await prisma.notification.findMany({
      where: {
        userId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    });

    return notifications;
  } catch (error) {
    console.error(`[Notification] Failed to fetch notifications for user ${userId}:`, error);
    return [];
  }
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllAsRead(userId: string) {
  try {
    const result = await prisma.notification.updateMany({
      where: {
        userId,
        status: 'UNREAD',
      },
      data: {
        status: 'READ',
      },
    });

    console.log(`[Notification] Marked ${result.count} notifications as read for user ${userId}`);
    return result;
  } catch (error) {
    console.error(`[Notification] Failed to mark notifications as read for user ${userId}:`, error);
    return { count: 0 };
  }
}

/**
 * Get unread notification count for a user
 */
export async function getUnreadCount(userId: string): Promise<number> {
  try {
    const count = await prisma.notification.count({
      where: {
        userId,
        status: 'UNREAD',
      },
    });

    return count;
  } catch (error) {
    console.error(`[Notification] Failed to get unread count for user ${userId}:`, error);
    return 0;
  }
}

/**
 * Send sign pickup request notification to admin
 */
export async function sendSignPickupRequestNotification(adminEmail: string, request: any): Promise<void> {
  try {
    const requesterName = `${request.requestedByUser.firstName} ${request.requestedByUser.lastName}`;
    const requesterEmail = request.requestedByUser.email;
    const locationText = request.location;
    const dateText = new Date(request.dateNeeded).toLocaleString();
    const description = request.description || 'No additional details provided';

    const emailBody = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #1e3a8a; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-radius: 0 0 8px 8px; }
    .field { margin: 15px 0; }
    .label { font-weight: bold; color: #1e3a8a; margin-bottom: 5px; }
    .value { color: #666; }
    .button { display: inline-block; background-color: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>📦 New Sign Pickup Request</h2>
    </div>
    <div class="content">
      <p>A sign pickup request has been submitted and is pending your approval.</p>
      
      <div class="field">
        <div class="label">Requested By:</div>
        <div class="value">${requesterName} (${requesterEmail})</div>
      </div>
      
      <div class="field">
        <div class="label">Pickup Location:</div>
        <div class="value">${locationText}</div>
      </div>
      
      <div class="field">
        <div class="label">Date Needed:</div>
        <div class="value">${dateText}</div>
      </div>
      
      <div class="field">
        <div class="label">Additional Details:</div>
        <div class="value">${description}</div>
      </div>
      
      <p style="margin-top: 25px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
        <strong>Status:</strong> Pending your approval. Please review this request and approve or reject it in the admin panel.
      </p>
    </div>
  </div>
</body>
</html>
    `;

    await sendEmailNotification(
      adminEmail,
      'New Sign Pickup Request - Pending Approval',
      emailBody
    );

    console.log(`[Notification] Sign pickup request notification sent to ${adminEmail}`);
  } catch (error) {
    console.error('[Notification] Failed to send sign pickup request notification:', error);
    throw error;
  }
}
