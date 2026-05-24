import nodemailer from "nodemailer";

// For MVP/testing, we create a test email account
// In production, this should use proper SMTP credentials
async function getTransporter() {
  // Try to use environment variables if available
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

  // For MVP, create a test account (Ethereal)
  console.log("No SMTP credentials found, using Ethereal test email account...");
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

export async function sendOrderConfirmationEmail(
  email: string,
  realtorName: string,
  orderNumber: string,
  orderDetails: {
    type: string;
    address: string;
    scheduledDate?: string;
    notes?: string;
  }
) {
  try {
    const transporter = await getTransporter();

    const scheduledDateStr = orderDetails.scheduledDate
      ? new Date(orderDetails.scheduledDate).toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : null;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #1a6640; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
            .header h1 { margin: 0; font-size: 24px; }
            .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
            .details { background: white; padding: 15px; border-radius: 4px; margin: 15px 0; }
            .detail-row { margin: 10px 0; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
            .detail-row:last-child { border-bottom: none; }
            .label { font-weight: 600; color: #1a6640; display: inline-block; min-width: 120px; }
            .value { color: #555; }
            .footer { text-align: center; color: #999; font-size: 12px; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>✓ Order Confirmed</h1>
            </div>
            <div class="content">
              <p>Hi ${realtorName},</p>
              <p>Your order has been successfully placed and we'll get started right away.</p>
              
              <div class="details">
                <div class="detail-row">
                  <span class="label">Order #:</span>
                  <span class="value">${orderNumber}</span>
                </div>
                <div class="detail-row">
                  <span class="label">Type:</span>
                  <span class="value">${orderDetails.type}</span>
                </div>
                <div class="detail-row">
                  <span class="label">Address:</span>
                  <span class="value">${orderDetails.address}</span>
                </div>
                ${
                  scheduledDateStr
                    ? `
                <div class="detail-row">
                  <span class="label">Scheduled:</span>
                  <span class="value">${scheduledDateStr}</span>
                </div>
                `
                    : ""
                }
                ${
                  orderDetails.notes
                    ? `
                <div class="detail-row">
                  <span class="label">Notes:</span>
                  <span class="value">${orderDetails.notes}</span>
                </div>
                `
                    : ""
                }
              </div>
              
              <p>You can view and manage this order anytime in your dashboard.</p>
              <p>Thank you for using SignPost Field!</p>
            </div>
            <div class="footer">
              <p>&copy; 2026 SignPost Field. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.RESEND_FROM_EMAIL || "orders@signpost.local",
      to: email,
      subject: `Order Confirmation - ${orderNumber}`,
      html: htmlContent,
    });

    console.log("Email sent successfully:", info.messageId);

    // Log preview URL for test emails (Ethereal)
    if (info.messageId && info.response?.includes("250")) {
      console.log("Preview URL:", nodemailer.getTestMessageUrl(info));
    }

    return info;
  } catch (error) {
    console.error("Failed to send email:", error);
    throw error;
  }
}

// Generic sendEmail function for alerts and notifications
export interface GenericEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail(options: GenericEmailOptions): Promise<void> {
  try {
    const transporter = await getTransporter();

    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.RESEND_FROM_EMAIL || "noreply@signpost.local",
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    });

    console.log(`Email sent to ${options.to}: ${options.subject}`, info.messageId);

    // Log preview URL for test emails (Ethereal)
    if (info.messageId && info.response?.includes("250")) {
      console.log("Preview URL:", nodemailer.getTestMessageUrl(info));
    }
  } catch (error) {
    console.error("Failed to send email:", error);
    throw error;
  }
}
