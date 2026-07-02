import sgMail from "@sendgrid/mail";

const sendGridApiKey = process.env.SENDGRID_API_KEY || "";
const isSendGridConfigured = sendGridApiKey.startsWith("SG.");
const NORTH_SHORE_SIGN_CO = "North Shore Sign Co";
const NORTH_SHORE_BILLING_EMAIL = "billing@northshoresignco.com";
const NORTH_SHORE_SENDER_EMAIL = "noreply@northshoresignco.com";
const NORTH_SHORE_APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://app.northshoresignco.com";
const STANDARD_FOOTER_HTML = `
        <div class="footer">
            <div class="footer-text">${NORTH_SHORE_SIGN_CO} Â· Seattle, WA Â· (206) 659-6323 Â· <a href="mailto:${NORTH_SHORE_BILLING_EMAIL}">${NORTH_SHORE_BILLING_EMAIL}</a></div>
        </div>`;

if (isSendGridConfigured) {
    sgMail.setApiKey(sendGridApiKey);
} else {
    console.warn("[EMAIL] SENDGRID_API_KEY missing/invalid; email sending disabled.");
}

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
}

export async function sendEmail(options: EmailOptions) {
  try {
        if (!isSendGridConfigured) {
            console.warn("[EMAIL] Skipping send; SendGrid not configured.");
            return { success: false, skipped: true };
        }

    const {
      to,
      subject,
      html,
      text,
            from = process.env.SENDGRID_FROM_EMAIL || process.env.RESEND_FROM_EMAIL || NORTH_SHORE_SENDER_EMAIL,
    } = options;

        const sender = from.includes("<") ? from : `${NORTH_SHORE_SIGN_CO} <${from}>`;

    const msg = {
      to,
            from: sender,
      subject,
      html,
      text: text || html.replace(/<[^>]*>/g, ""),
    };

    await sgMail.send(msg);
    console.log(`Email sent to ${to}: ${subject}`);
    return { success: true };
  } catch (error) {
    console.error("SendGrid error:", error);
    throw error;
  }
}

// Password reset email template
export function getPasswordResetEmail(
  firstName: string,
  resetLink: string,
  _supportUrl?: string,
  _privacyUrl?: string,
  _termsUrl?: string
) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reset Your Password</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
            background-color: #f3f4f6;
            color: #333;
        }
        
        .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: white;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
        
        .header {
            background: linear-gradient(135deg, #ea580c 0%, #c2410c 100%);
            color: white;
            padding: 40px 30px;
            text-align: center;
        }
        
        .header h1 {
            font-size: 28px;
            font-weight: 700;
            margin-bottom: 8px;
        }
        
        .header p {
            font-size: 16px;
            opacity: 0.95;
        }
        
        .content {
            padding: 40px 30px;
        }
        
        .greeting {
            font-size: 16px;
            margin-bottom: 24px;
            line-height: 1.6;
        }
        
        .security-notice {
            background-color: #fed7aa;
            border: 2px solid #fdba74;
            border-radius: 6px;
            padding: 16px;
            margin: 24px 0;
        }
        
        .security-notice-title {
            font-size: 14px;
            color: #92400e;
            font-weight: 600;
            margin-bottom: 8px;
        }
        
        .security-notice-text {
            font-size: 13px;
            color: #b45309;
            line-height: 1.6;
        }
        
        .cta-button {
            display: inline-block;
            width: 100%;
            padding: 14px 24px;
            margin: 24px 0;
            background: linear-gradient(135deg, #ea580c 0%, #c2410c 100%);
            color: white;
            text-decoration: none;
            border-radius: 6px;
            font-size: 16px;
            font-weight: 600;
            text-align: center;
            transition: transform 0.2s, box-shadow 0.2s;
            box-shadow: 0 4px 6px rgba(234, 88, 12, 0.3);
        }
        
        .cta-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 12px rgba(234, 88, 12, 0.4);
        }
        
        .link-section {
            background-color: #fef3c7;
            border: 1px solid #fcd34d;
            border-radius: 6px;
            padding: 16px;
            margin: 20px 0;
            word-break: break-all;
        }
        
        .link-label {
            font-size: 12px;
            color: #92400e;
            font-weight: 600;
            text-transform: uppercase;
            margin-bottom: 8px;
            letter-spacing: 0.5px;
        }
        
        .link-text {
            font-size: 12px;
            color: #b45309;
            font-family: 'Courier New', monospace;
            line-height: 1.5;
            word-wrap: break-word;
        }
        
        .instructions {
            background-color: #f8fafc;
            padding: 16px;
            border-radius: 6px;
            margin: 20px 0;
        }
        
        .instructions h3 {
            font-size: 14px;
            font-weight: 600;
            color: #1e293b;
            margin-bottom: 8px;
        }
        
        .instructions ol {
            margin-left: 20px;
            font-size: 13px;
            color: #475569;
            line-height: 1.8;
        }
        
        .instructions li {
            margin-bottom: 8px;
        }
        
        .expiration {
            background-color: #fee2e2;
            border-left: 4px solid #ef4444;
            padding: 12px 16px;
            margin: 20px 0;
            border-radius: 4px;
        }
        
        .expiration-text {
            font-size: 13px;
            color: #991b1b;
            line-height: 1.6;
        }
        
        .support-section {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e2e8f0;
        }
        
        .support-text {
            font-size: 13px;
            color: #64748b;
            line-height: 1.6;
        }
        
        .support-link {
            color: #ea580c;
            text-decoration: none;
        }
        
        .footer {
            background-color: #f1f5f9;
            padding: 24px 30px;
            text-align: center;
            border-top: 1px solid #e2e8f0;
        }
        
        .footer-text {
            font-size: 12px;
            color: #64748b;
            margin-bottom: 8px;
        }
        
        .footer-links {
            font-size: 11px;
            color: #94a3b8;
        }
        
        .footer-links a {
            color: #ea580c;
            text-decoration: none;
            margin: 0 8px;
        }
        
        @media (max-width: 600px) {
            .container {
                margin: 0;
                border-radius: 0;
            }
            
            .header {
                padding: 30px 20px;
            }
            
            .header h1 {
                font-size: 24px;
            }
            
            .content {
                padding: 24px 20px;
            }
            
            .security-notice {
                padding: 12px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <!-- Header -->
        <div class="header">
            <h1>ðŸ” Reset Your Password</h1>
            <p>Secure access to your North Shore Sign Co account</p>
        </div>
        
        <!-- Content -->
        <div class="content">
            <div class="greeting">
                <p>Hi ${firstName},</p>
                <p style="margin-top: 12px;">We received a request to reset the password for your North Shore Sign Co account. Click the button below to create a new password.</p>
            </div>
            
            <!-- Security Notice -->
            <div class="security-notice">
                <div class="security-notice-title">âš ï¸ Didn't request this?</div>
                <div class="security-notice-text">
                    If you didn't request a password reset, you can ignore this email. Your account remains secure.
                </div>
            </div>
            
            <!-- CTA Button -->
            <a href="${resetLink}" class="cta-button">Reset Your Password</a>
            
            <!-- Link Fallback -->
            <div class="link-section">
                <div class="link-label">Or copy this link:</div>
                <div class="link-text">${resetLink}</div>
            </div>
            
            <!-- Expiration Warning -->
            <div class="expiration">
                <div class="expiration-text">
                    <strong>â±ï¸ This link expires in 24 hours</strong><br>
                    If you don't reset your password within 24 hours, you'll need to request a new reset link.
                </div>
            </div>
            
            <!-- Instructions -->
            <div class="instructions">
                <h3>How to Reset</h3>
                <ol>
                    <li>Click the "Reset Your Password" button above</li>
                    <li>Enter your new password</li>
                    <li>Confirm your new password</li>
                    <li>You're all set! Log in with your new password</li>
                </ol>
            </div>
            
            <!-- Support -->
            <div class="support-section">
                <div class="support-text">
                    <p><strong>Having trouble?</strong> If the button above doesn't work, copy and paste the link into your browser. If you continue to have issues, <a href="mailto:support@northshoresignco.com" class="support-link">contact our support team</a>.</p>
                </div>
            </div>
        </div>
        
        <!-- Footer -->
${STANDARD_FOOTER_HTML}
    </div>
</body>
</html>`;

  return {
    subject: "ðŸ” Reset Your Password",
    html,
  };
}

export function getAccountVerificationEmail(
  firstName: string,
  verificationLink: string,
  _supportUrl?: string,
  _privacyUrl?: string,
  _termsUrl?: string
) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Verify Your Email</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif; background-color: #f3f4f6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); }
        .header { background: linear-gradient(135deg, #0f766e 0%, #115e59 100%); color: white; padding: 40px 30px; text-align: center; }
        .header h1 { font-size: 28px; font-weight: 700; margin-bottom: 8px; }
        .header p { font-size: 16px; opacity: 0.95; }
        .content { padding: 40px 30px; }
        .greeting { font-size: 16px; margin-bottom: 24px; line-height: 1.6; }
        .notice { background-color: #ecfeff; border: 2px solid #99f6e4; border-radius: 6px; padding: 16px; margin: 24px 0; }
        .notice-title { font-size: 14px; color: #0f766e; font-weight: 600; margin-bottom: 8px; }
        .notice-text { font-size: 13px; color: #0f766e; line-height: 1.6; }
        .cta-button { display: inline-block; width: 100%; padding: 14px 24px; margin: 24px 0; background: linear-gradient(135deg, #0f766e 0%, #115e59 100%); color: white; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: 600; text-align: center; box-shadow: 0 4px 6px rgba(15, 118, 110, 0.3); }
        .link-section { background-color: #f0fdfa; border: 1px solid #99f6e4; border-radius: 6px; padding: 16px; margin: 20px 0; word-break: break-all; }
        .link-label { font-size: 12px; color: #0f766e; font-weight: 600; text-transform: uppercase; margin-bottom: 8px; letter-spacing: 0.5px; }
        .link-text { font-size: 12px; color: #115e59; font-family: 'Courier New', monospace; line-height: 1.5; word-wrap: break-word; }
        .instructions { background-color: #f8fafc; padding: 16px; border-radius: 6px; margin: 20px 0; }
        .instructions h3 { font-size: 14px; font-weight: 600; color: #1e293b; margin-bottom: 8px; }
        .instructions ol { margin-left: 20px; font-size: 13px; color: #475569; line-height: 1.8; }
        .instructions li { margin-bottom: 8px; }
        .support-section { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; }
        .support-text { font-size: 13px; color: #64748b; line-height: 1.6; }
        .support-link { color: #0f766e; text-decoration: none; }
        .footer { background-color: #f1f5f9; padding: 24px 30px; text-align: center; border-top: 1px solid #e2e8f0; }
        .footer-text { font-size: 12px; color: #64748b; margin-bottom: 8px; }
        .footer-links { font-size: 11px; color: #94a3b8; }
        .footer-links a { color: #0f766e; text-decoration: none; margin: 0 8px; }
        @media (max-width: 600px) { .container { margin: 0; border-radius: 0; } .header { padding: 30px 20px; } .header h1 { font-size: 24px; } .content { padding: 24px 20px; } }
    </style>
</head>
<body>
    <div class="container">
        <div class="header"> 
            <h1>âœ… Verify Your Email</h1>
            <p>Confirm your North Shore Sign Co account before placing orders</p>
        </div>
        <div class="content">
            <div class="greeting">
                <p>Hi ${firstName},</p>
                <p style="margin-top: 12px;">Your North Shore Sign Co account was created successfully. Click the button below to verify your email address and activate ordering access.</p>
            </div>
            <div class="notice">
                <div class="notice-title">Why this is required</div>
                <div class="notice-text">For security, orders cannot be submitted until your email is verified. This keeps account ownership tied to the inbox you control.</div>
            </div>
            <a href="${verificationLink}" class="cta-button">Verify Email Address</a>
            <div class="link-section">
                <div class="link-label">Or copy this link:</div>
                <div class="link-text">${verificationLink}</div>
            </div>
            <div class="instructions">
                <h3>Next Steps</h3>
                <ol>
                    <li>Click the verification button above.</li>
                    <li>Confirm your email in the browser.</li>
                    <li>Sign in and start placing orders.</li>
                </ol>
            </div>
            <div class="support-section">
                <div class="support-text">
                    <p>If the button does not work, paste the link into your browser or contact <a href="mailto:support@northshoresignco.com" class="support-link">support</a>.</p>
                </div>
            </div>
        </div>
${STANDARD_FOOTER_HTML}
    </div>
</body>
</html>`;

  return {
    subject: "Verify your North Shore Sign Co email",
    html,
  };
}

export function getWelcomeEmail(
  firstName: string,
  loginLink: string,
  _supportUrl?: string,
  _privacyUrl?: string,
  _termsUrl?: string
) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to North Shore Sign Co</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif; background-color: #f3f4f6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); }
        .header { background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%); color: white; padding: 40px 30px; text-align: center; }
        .header h1 { font-size: 28px; font-weight: 700; margin-bottom: 8px; }
        .header p { font-size: 16px; opacity: 0.95; }
        .content { padding: 40px 30px; }
        .greeting { font-size: 16px; margin-bottom: 24px; line-height: 1.6; }
        .cta-button { display: inline-block; width: 100%; padding: 14px 24px; margin: 24px 0; background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%); color: white; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: 600; text-align: center; }
        .instructions { background-color: #f8fafc; padding: 16px; border-radius: 6px; margin: 20px 0; }
        .instructions h3 { font-size: 14px; font-weight: 600; color: #1e293b; margin-bottom: 8px; }
        .instructions ol { margin-left: 20px; font-size: 13px; color: #475569; line-height: 1.8; }
        .footer { background-color: #f1f5f9; padding: 24px 30px; text-align: center; border-top: 1px solid #e2e8f0; }
        .footer-text { font-size: 12px; color: #64748b; }
        @media (max-width: 600px) { .container { margin: 0; border-radius: 0; } .header { padding: 30px 20px; } .header h1 { font-size: 24px; } .content { padding: 24px 20px; } }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>ðŸŽ‰ Welcome to North Shore Sign Co!</h1>
            <p>Your account is ready to use</p>
        </div>
        <div class="content">
            <div class="greeting">
                <p>Hi <strong>${firstName}</strong>,</p>
                <p style="margin-top: 12px;">Your account has been created and is ready to go. Click the button below to log in and get started.</p>
            </div>
            <a href="${loginLink}" class="cta-button">Log In</a>
            <div class="instructions">
                <h3>Getting Started</h3>
                <ol>
                    <li>Click the login button above.</li>
                    <li>Use your email address to sign in.</li>
                    <li>Complete your profile and place your first order.</li>
                </ol>
            </div>
        </div>
${STANDARD_FOOTER_HTML}
    </div>
</body>
</html>`;

  return {
    subject: "Welcome to North Shore Sign Co",
    html,
  };
}

export function getOrderStatusUpdateEmail(
  customerName: string,
  orderNumber: string,
  status: string,
  address: string,
  dashboardLink: string
) {
  if (status === "COMPLETED") {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Installation Complete</title>
</head>
<body>
    <div style="max-width:600px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f3f4f6;padding:24px;">
        <div style="background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb;">
            <div style="background:linear-gradient(135deg,#059669 0%,#047857 100%);color:#fff;padding:32px;text-align:center;">
                <h1 style="margin:0;font-size:28px;">âœ… Installation Complete</h1>
                <p style="margin-top:8px;opacity:0.95;">Your North Shore Sign Co order is complete</p>
            </div>
            <div style="padding:32px;">
                <p style="margin-bottom:16px;">Hi ${customerName}, your order status is now <strong>COMPLETED</strong>.</p>
                <p style="margin-bottom:16px;"><strong>Order #:</strong> ${orderNumber}</p>
                <p style="margin-bottom:16px;"><strong>Address:</strong> ${address}</p>
                <a href="${dashboardLink}" style="display:inline-block;background:#059669;color:#fff;text-decoration:none;padding:12px 18px;border-radius:6px;font-weight:600;">View in Dashboard</a>
            </div>
        </div>
${STANDARD_FOOTER_HTML}
    </div>
</body>
</html>`;

    return { subject: `Order ${orderNumber} completed`, html };
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Order Status Updated</title>
</head>
<body>
    <div style="max-width:600px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f3f4f6;padding:24px;">
        <div style="background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb;">
            <div style="background:linear-gradient(135deg,#2563eb 0%,#1e40af 100%);color:#fff;padding:32px;text-align:center;">
                <h1 style="margin:0;font-size:28px;">Order Status Updated</h1>
                <p style="margin-top:8px;opacity:0.95;">Your North Shore Sign Co order has a new status</p>
            </div>
            <div style="padding:32px;">
                <p style="margin-bottom:16px;">Hi ${customerName}, your order status is now <strong>${status}</strong>.</p>
                <p style="margin-bottom:16px;"><strong>Order #:</strong> ${orderNumber}</p>
                <p style="margin-bottom:16px;"><strong>Address:</strong> ${address}</p>
                <a href="${dashboardLink}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 18px;border-radius:6px;font-weight:600;">View in Dashboard</a>
            </div>
        </div>
${STANDARD_FOOTER_HTML}
    </div>
</body>
</html>`;

  return { subject: `Order ${orderNumber} status updated to ${status}`, html };
}

// Welcome email with direct login link
export function getWelcomeEmailWithMagicLink(
  firstName: string,
  email: string,
  tempPassword: string,
  loginLink: string,
  loginPageUrl?: string,
  _supportUrl?: string,
  _privacyUrl?: string,
  _termsUrl?: string
) {
  const finalLoginPageUrl = loginPageUrl || `${process.env.NEXT_PUBLIC_APP_URL || "https://app.northshoresignco.com"}/login`;
  
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to North Shore Sign Co</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
            background-color: #f3f4f6;
            color: #333;
        }
        
        .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: white;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
        
        .header {
            background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%);
            color: white;
            padding: 40px 30px;
            text-align: center;
        }
        
        .header h1 {
            font-size: 28px;
            font-weight: 700;
            margin-bottom: 8px;
        }
        
        .header p {
            font-size: 16px;
            opacity: 0.95;
        }
        
        .content {
            padding: 40px 30px;
        }
        
        .greeting {
            font-size: 16px;
            margin-bottom: 24px;
            line-height: 1.6;
        }
        
        .credentials-section {
            background-color: #f0f9ff;
            border: 2px solid #bfdbfe;
            border-radius: 6px;
            padding: 20px;
            margin: 24px 0;
        }
        
        .credentials-title {
            font-size: 14px;
            font-weight: 600;
            color: #1e40af;
            margin-bottom: 12px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        
        .credential-item {
            margin-bottom: 12px;
        }
        
        .credential-item:last-child {
            margin-bottom: 0;
        }
        
        .credential-label {
            font-size: 12px;
            color: #0c4a6e;
            font-weight: 600;
            text-transform: uppercase;
            margin-bottom: 4px;
        }
        
        .credential-value {
            font-size: 15px;
            color: #0f172a;
            font-family: 'Courier New', monospace;
            background-color: white;
            padding: 10px 12px;
            border-radius: 4px;
            word-break: break-all;
            font-weight: 500;
        }
        
        .warning {
            background-color: #fef3c7;
            border-left: 4px solid #f59e0b;
            padding: 12px 16px;
            margin: 20px 0;
            border-radius: 4px;
        }
        
        .warning-icon {
            font-size: 18px;
            margin-right: 8px;
        }
        
        .warning-text {
            font-size: 13px;
            color: #92400e;
            line-height: 1.5;
        }
        
        .cta-button {
            display: inline-block;
            width: 100%;
            padding: 14px 24px;
            margin: 24px 0;
            background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%);
            color: white;
            text-decoration: none;
            border-radius: 6px;
            font-size: 16px;
            font-weight: 600;
            text-align: center;
            transition: transform 0.2s, box-shadow 0.2s;
            box-shadow: 0 4px 6px rgba(37, 99, 235, 0.3);
        }
        
        .cta-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 12px rgba(37, 99, 235, 0.4);
        }
        
        .instructions {
            background-color: #f8fafc;
            padding: 16px;
            border-radius: 6px;
            margin: 20px 0;
        }
        
        .instructions h3 {
            font-size: 14px;
            font-weight: 600;
            color: #1e293b;
            margin-bottom: 8px;
        }
        
        .instructions ol {
            margin-left: 20px;
            font-size: 13px;
            color: #475569;
            line-height: 1.8;
        }
        
        .instructions li {
            margin-bottom: 8px;
        }
        
        .support-section {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e2e8f0;
        }
        
        .support-text {
            font-size: 13px;
            color: #64748b;
            line-height: 1.6;
        }
        
        .support-link {
            color: #2563eb;
            text-decoration: none;
        }
        
        .footer {
            background-color: #f1f5f9;
            padding: 24px 30px;
            text-align: center;
            border-top: 1px solid #e2e8f0;
        }
        
        .footer-text {
            font-size: 12px;
            color: #64748b;
            margin-bottom: 8px;
        }
        
        .footer-links {
            font-size: 11px;
            color: #94a3b8;
        }
        
        .footer-links a {
            color: #2563eb;
            text-decoration: none;
            margin: 0 8px;
        }
        
        @media (max-width: 600px) {
            .container {
                margin: 0;
                border-radius: 0;
            }
            
            .header {
                padding: 30px 20px;
            }
            
            .header h1 {
                font-size: 24px;
            }
            
            .content {
                padding: 24px 20px;
            }
            
            .credentials-section {
                padding: 16px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <!-- Header -->
        <div class="header">
            <h1>ðŸŽ‰ Welcome to North Shore Sign Co!</h1>
            <p>Your account is ready to use</p>
        </div>
        
        <!-- Content -->
        <div class="content">
            <div class="greeting">
                <p>Hi <strong>${firstName}</strong>,</p>
                <p style="margin-top: 12px;">Your account has been created and is ready to go! Click the button below to log in directly.</p>
            </div>
            
            <!-- Credentials -->
            <div class="credentials-section">
                <div class="credentials-title">Your Login Credentials</div>
                
                <div class="credential-item">
                    <div class="credential-label">Username / Email</div>
                    <div class="credential-value">${email}</div>
                </div>
                
                <div class="credential-item">
                    <div class="credential-label">Temporary Password</div>
                    <div class="credential-value">${tempPassword}</div>
                </div>
            </div>
            
            <!-- Warning -->
            <div class="warning">
                <div style="display: flex;">
                    <span class="warning-icon">âš ï¸</span>
                    <div class="warning-text">
                        <strong>Important:</strong> Please change your password immediately after your first login for security.
                    </div>
                </div>
            </div>
            
            <!-- Direct Login Button -->
            <a href="${loginLink}" class="cta-button">Log In Directly</a>
            
            <!-- Manual Login Link -->
            <div style="text-align: center; margin: 16px 0; font-size: 13px; color: #64748b;">
                <p>Or login manually at: <a href="${finalLoginPageUrl}" style="color: #2563eb; text-decoration: none; font-weight: 600;">${finalLoginPageUrl}</a></p>
            </div>
            
            <!-- Instructions -->
            <div class="instructions">
                <h3>Getting Started</h3>
                <ol>
                    <li>Click the "Log In Directly" button above (or use the manual login link)</li>
                    <li>Enter your email and temporary password</li>
                    <li>Change your password on first login</li>
                    <li>Start managing your account</li>
                </ol>
            </div>
            
            <!-- Support -->
            <div class="support-section">
                <div class="support-text">
                    <p><strong>Need help?</strong> If you have any questions or need assistance, feel free to <a href="mailto:support@northshoresignco.com" class="support-link">contact our support team</a>.</p>
                </div>
            </div>
        </div>
        
        <!-- Footer -->
        <div class="footer">
            <div class="footer-text">North Shore Sign Co · Seattle, WA · (206) 659-6323 · <a href="mailto:billing@northshoresignco.com">billing@northshoresignco.com</a></div>
            </div>
    </div>
</body>
</html>`;

  return {
    subject: "Welcome to North Shore Sign Co! ðŸŽ‰",
    html,
  };
}

// Transaction Coordinator Invitation Email
export function getTCInvitationEmail(
  agentName: string,
  tcName: string,
  tcEmail: string,
  signupLink: string,
  _supportUrl?: string,
  _privacyUrl?: string,
  _termsUrl?: string
) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Join Your Transaction Coordinator Team</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
            background-color: #f3f4f6;
            color: #333;
        }
        
        .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: white;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
        
        .header {
            background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%);
            color: white;
            padding: 40px 30px;
            text-align: center;
        }
        
        .header h1 {
            font-size: 28px;
            font-weight: 700;
            margin-bottom: 8px;
        }
        
        .header p {
            font-size: 16px;
            opacity: 0.95;
        }
        
        .content {
            padding: 40px 30px;
        }
        
        .greeting {
            font-size: 16px;
            margin-bottom: 24px;
            line-height: 1.6;
        }
        
        .info-box {
            background-color: #f3e8ff;
            border: 2px solid #ddd6fe;
            border-radius: 6px;
            padding: 20px;
            margin: 24px 0;
        }
        
        .info-label {
            font-size: 12px;
            color: #5b21b6;
            font-weight: 600;
            text-transform: uppercase;
            margin-bottom: 8px;
            letter-spacing: 0.5px;
        }
        
        .info-value {
            font-size: 16px;
            color: #2d1b4e;
            font-weight: 500;
            margin-bottom: 12px;
        }
        
        .info-value:last-child {
            margin-bottom: 0;
        }
        
        .highlight {
            background-color: #ede9fe;
            padding: 16px;
            border-radius: 6px;
            margin: 20px 0;
            border-left: 4px solid #7c3aed;
        }
        
        .highlight-text {
            font-size: 14px;
            color: #5b21b6;
            line-height: 1.6;
        }
        
        .cta-button {
            display: inline-block;
            width: 100%;
            padding: 14px 24px;
            margin: 24px 0;
            background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%);
            color: white;
            text-decoration: none;
            border-radius: 6px;
            font-size: 16px;
            font-weight: 600;
            text-align: center;
            transition: transform 0.2s, box-shadow 0.2s;
            box-shadow: 0 4px 6px rgba(124, 58, 237, 0.3);
        }
        
        .cta-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 12px rgba(124, 58, 237, 0.4);
        }
        
        .instructions {
            background-color: #f8fafc;
            padding: 16px;
            border-radius: 6px;
            margin: 20px 0;
        }
        
        .instructions h3 {
            font-size: 14px;
            font-weight: 600;
            color: #1e293b;
            margin-bottom: 8px;
        }
        
        .instructions ol {
            margin-left: 20px;
            font-size: 13px;
            color: #475569;
            line-height: 1.8;
        }
        
        .instructions li {
            margin-bottom: 8px;
        }
        
        .support-section {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e2e8f0;
        }
        
        .support-text {
            font-size: 13px;
            color: #64748b;
            line-height: 1.6;
        }
        
        .support-link {
            color: #7c3aed;
            text-decoration: none;
        }
        
        .footer {
            background-color: #f1f5f9;
            padding: 24px 30px;
            text-align: center;
            border-top: 1px solid #e2e8f0;
        }
        
        .footer-text {
            font-size: 12px;
            color: #64748b;
            margin-bottom: 8px;
        }
        
        .footer-links {
            font-size: 11px;
            color: #94a3b8;
        }
        
        .footer-links a {
            color: #7c3aed;
            text-decoration: none;
            margin: 0 8px;
        }
        
        @media (max-width: 600px) {
            .container {
                margin: 0;
                border-radius: 0;
            }
            
            .header {
                padding: 30px 20px;
            }
            
            .header h1 {
                font-size: 24px;
            }
            
            .content {
                padding: 24px 20px;
            }
            
            .info-box {
                padding: 16px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <!-- Header -->
        <div class="header">
            <h1>ðŸ“‹ You're Invited!</h1>
            <p>Your Transaction Coordinator invited you to North Shore Sign Co</p>
        </div>
        
        <!-- Content -->
        <div class="content">
            <div class="greeting">
                <p>Hi ${agentName},</p>
                <p style="margin-top: 12px;">${tcName} invited you to the North Shore Sign Co platform. Please complete your registration so your sign can be placed.</p>
            </div>
            
            <!-- TC Info -->
            <div class="info-box">
                <div class="info-label">Your Transaction Coordinator</div>
                <div class="info-value">${tcName}</div>
                
                <div class="info-label" style="margin-top: 12px;">Contact</div>
                <div class="info-value">${tcEmail}</div>
            </div>
            
            <!-- Highlight -->
            <div class="highlight">
                <div class="highlight-text">
                    Once you complete registration, your account is automatically linked with your Transaction Coordinator so order requests can move quickly.
                </div>
            </div>
            
            <!-- CTA Button -->
            <a href="${signupLink}" class="cta-button">Create Your Account</a>
            
            <!-- Instructions -->
            <div class="instructions">
                <h3>Getting Started</h3>
                <ol>
                    <li>Click "Create Your Account" above</li>
                    <li>Complete your registration details</li>
                    <li>Set your password and sign in</li>
                    <li>Submit your order so your sign can be placed</li>
                </ol>
            </div>
            
            <!-- Support -->
            <div class="support-section">
                <div class="support-text">
                    <p><strong>Questions?</strong> Contact your Transaction Coordinator directly at <a href="mailto:${tcEmail}" class="support-link">${tcEmail}</a> or reach out to our support team at <a href="mailto:support@northshoresignco.com" class="support-link">support@northshoresignco.com</a>.</p>
                </div>
            </div>
        </div>
        
        <!-- Footer -->
        <div class="footer">
            <div class="footer-text">North Shore Sign Co · Seattle, WA · (206) 659-6323 · <a href="mailto:billing@northshoresignco.com">billing@northshoresignco.com</a></div>
            </div>
    </div>
</body>
</html>`;

  return {
        subject: `${tcName} invited you to North Shore Sign Co - complete registration`,
    html,
  };
}

/**
 * Email sent to a TC invitee when a Realtor (or Admin) invites them to join
 * as a Transaction Coordinator via /api/tc/invite.
 */
export function getRealtorInvitesTCEmail(
  tcInviteeName: string,
  realtorName: string,
  realtorBrokerage: string | null | undefined,
  tcInviteeEmail: string,
  signupLink: string,
    supportUrl?: string,
    privacyUrl?: string,
    termsUrl?: string
) {
  const brokerageText = realtorBrokerage
    ? ` of <strong>${realtorBrokerage}</strong>`
    : "";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>You've Been Invited as a Transaction Coordinator</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; background: #f3f4f6; color: #1f2937; padding: 24px 12px; }
        .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 10px; overflow: hidden; border: 1px solid #e5e7eb; }
        .header { background: linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%); color: #ffffff; padding: 36px 28px; text-align: center; }
        .header h1 { font-size: 26px; font-weight: 700; margin-bottom: 6px; }
        .header p  { font-size: 14px; opacity: 0.92; }
        .content { padding: 28px 24px; line-height: 1.6; }
        .greeting { font-size: 15px; margin-bottom: 20px; }
        .card { background: #f5f3ff; border: 1.5px solid #ddd6fe; border-radius: 8px; padding: 16px; margin: 20px 0; }
        .card-row { margin-bottom: 10px; }
        .card-row:last-child { margin-bottom: 0; }
        .card-label { font-size: 11px; font-weight: 700; color: #7c3aed; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 3px; }
        .card-value { font-size: 15px; font-weight: 600; color: #2d1b4e; }
        .highlight { background: #faf5ff; border-left: 4px solid #7c3aed; border-radius: 4px; padding: 12px 16px; margin: 16px 0; font-size: 13px; color: #5b21b6; line-height: 1.6; }
        .cta { display: inline-block; width: 100%; text-align: center; background: linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%); color: #ffffff; text-decoration: none; font-weight: 700; font-size: 16px; border-radius: 8px; padding: 14px 24px; margin: 20px 0; box-shadow: 0 4px 8px rgba(124,58,237,0.3); }
        .link-box { background: #f5f3ff; border: 1px solid #ddd6fe; border-radius: 6px; padding: 12px 14px; margin: 12px 0; word-break: break-all; }
        .link-label { font-size: 11px; font-weight: 700; color: #7c3aed; text-transform: uppercase; letter-spacing: 0.4px; margin-bottom: 5px; }
        .link-text { font-size: 12px; color: #4f46e5; font-family: 'Courier New', monospace; }
        .expiry { background: #fef9c3; border-left: 4px solid #facc15; border-radius: 4px; padding: 10px 14px; margin: 14px 0; font-size: 13px; color: #854d0e; }
        .steps { background: #f8fafc; border-radius: 8px; padding: 14px 16px; margin: 14px 0; }
        .steps-title { font-size: 13px; font-weight: 700; color: #1e293b; margin-bottom: 8px; }
        .steps ol { margin-left: 18px; font-size: 13px; color: #475569; line-height: 1.8; }
        .steps li { margin-bottom: 4px; }
        .support { margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 13px; color: #6b7280; }
        .support a { color: #7c3aed; text-decoration: none; }
        .footer { background: #f1f5f9; padding: 20px 24px; text-align: center; border-top: 1px solid #e5e7eb; }
        .footer-text { font-size: 12px; color: #6b7280; margin-bottom: 6px; }
        .footer a { font-size: 11px; color: #7c3aed; text-decoration: none; margin: 0 6px; }
        @media (max-width: 600px) { .container { border-radius: 0; } .header, .content { padding: 22px 16px; } }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>ðŸ¤ You're Invited!</h1>
            <p>A realtor has invited you to be their Transaction Coordinator</p>
        </div>
        <div class="content">
            <div class="greeting">
                <p>Hi <strong>${tcInviteeName}</strong>,</p>
                <p style="margin-top: 10px;">
                    <strong>${realtorName}</strong>${brokerageText} has invited you to join North Shore Sign Co as their
                    Transaction Coordinator. Once you complete registration, you'll be automatically
                    linked and can start managing their sign orders.
                </p>
            </div>
            <div class="card">
                <div class="card-row">
                    <div class="card-label">Invited by</div>
                    <div class="card-value">${realtorName}</div>
                </div>
                ${realtorBrokerage ? `
                <div class="card-row">
                    <div class="card-label">Brokerage</div>
                    <div class="card-value">${realtorBrokerage}</div>
                </div>` : ""}
                <div class="card-row">
                    <div class="card-label">Your invite email</div>
                    <div class="card-value">${tcInviteeEmail}</div>
                </div>
            </div>
            <div class="highlight">
                After registration, your account is automatically linked to <strong>${realtorName}</strong>.
                You'll be able to place and manage orders on their behalf immediately.
            </div>
            <a href="${signupLink}" class="cta">Create Your TC Account</a>
            <div class="link-box">
                <div class="link-label">Or copy this link into your browser</div>
                <div class="link-text">${signupLink}</div>
            </div>
            <div class="expiry">
                â±ï¸ <strong>This invite expires in 48 hours.</strong> Ask ${realtorName} to resend if it expires.
            </div>
            <div class="steps">
                <div class="steps-title">How it works</div>
                <ol>
                    <li>Click <strong>Create Your TC Account</strong> above.</li>
                    <li>Fill in your name and set a password.</li>
                    <li>Your account is automatically linked to the inviting realtor.</li>
                    <li>Sign in and start managing their sign orders.</li>
                </ol>
            </div>
            <div class="support">
                Questions? Contact <a href="mailto:support@northshoresignco.com">support@northshoresignco.com</a>.
            </div>
        </div>
        <div class="footer">
            <div class="footer-text">North Shore Sign Co · Seattle, WA · (206) 659-6323 · <a href="mailto:billing@northshoresignco.com">billing@northshoresignco.com</a></div>
            <a href="${supportUrl || "#"}">Help Center</a>
            <a href="${privacyUrl || "#"}">Privacy Policy</a>
            <a href="${termsUrl || "#"}">Terms of Service</a>
        </div>
    </div>
</body>
</html>`;

  return {
    subject: `${realtorName} invited you to North Shore Sign Co as a Transaction Coordinator`,
    html,
  };
}

// Brokerage Invitation Email
export function getBrokerageInvitationEmail(
  agentName: string,
  brokerageName: string,
  brokerageEmail: string,
  signupLink: string,
        _supportUrl?: string,
        _privacyUrl?: string,
        _termsUrl?: string
) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Join Your Brokerage on North Shore Sign Co</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
            background-color: #f3f4f6;
            color: #333;
        }
        
        .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: white;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
        
        .header {
            background: linear-gradient(135deg, #059669 0%, #047857 100%);
            color: white;
            padding: 40px 30px;
            text-align: center;
        }
        
        .header h1 {
            font-size: 28px;
            font-weight: 700;
            margin-bottom: 8px;
        }
        
        .header p {
            font-size: 16px;
            opacity: 0.95;
        }
        
        .content {
            padding: 40px 30px;
        }
        
        .greeting {
            font-size: 16px;
            margin-bottom: 24px;
            line-height: 1.6;
        }
        
        .info-box {
            background-color: #d1fae5;
            border: 2px solid #a7f3d0;
            border-radius: 6px;
            padding: 20px;
            margin: 24px 0;
        }
        
        .info-label {
            font-size: 12px;
            color: #065f46;
            font-weight: 600;
            text-transform: uppercase;
            margin-bottom: 8px;
            letter-spacing: 0.5px;
        }
        
        .info-value {
            font-size: 16px;
            color: #064e3b;
            font-weight: 500;
            margin-bottom: 12px;
        }
        
        .info-value:last-child {
            margin-bottom: 0;
        }
        
        .highlight {
            background-color: #ecfdf5;
            padding: 16px;
            border-radius: 6px;
            margin: 20px 0;
            border-left: 4px solid #059669;
        }
        
        .highlight-text {
            font-size: 14px;
            color: #065f46;
            line-height: 1.6;
        }
        
        .benefits {
            background-color: #f0fdf4;
            padding: 16px;
            border-radius: 6px;
            margin: 20px 0;
        }
        
        .benefits-title {
            font-size: 14px;
            font-weight: 600;
            color: #15803d;
            margin-bottom: 12px;
        }
        
        .benefits-list {
            margin-left: 20px;
            font-size: 13px;
            color: #166534;
            line-height: 1.8;
        }
        
        .benefits-list li {
            margin-bottom: 6px;
        }
        
        .cta-button {
            display: inline-block;
            width: 100%;
            padding: 14px 24px;
            margin: 24px 0;
            background: linear-gradient(135deg, #059669 0%, #047857 100%);
            color: white;
            text-decoration: none;
            border-radius: 6px;
            font-size: 16px;
            font-weight: 600;
            text-align: center;
            transition: transform 0.2s, box-shadow 0.2s;
            box-shadow: 0 4px 6px rgba(5, 150, 105, 0.3);
        }
        
        .cta-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 12px rgba(5, 150, 105, 0.4);
        }
        
        .instructions {
            background-color: #f8fafc;
            padding: 16px;
            border-radius: 6px;
            margin: 20px 0;
        }
        
        .instructions h3 {
            font-size: 14px;
            font-weight: 600;
            color: #1e293b;
            margin-bottom: 8px;
        }
        
        .instructions ol {
            margin-left: 20px;
            font-size: 13px;
            color: #475569;
            line-height: 1.8;
        }
        
        .instructions li {
            margin-bottom: 8px;
        }
        
        .support-section {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e2e8f0;
        }
        
        .support-text {
            font-size: 13px;
            color: #64748b;
            line-height: 1.6;
        }
        
        .support-link {
            color: #059669;
            text-decoration: none;
        }
        
        .footer {
            background-color: #f1f5f9;
            padding: 24px 30px;
            text-align: center;
            border-top: 1px solid #e2e8f0;
        }
        
        .footer-text {
            font-size: 12px;
            color: #64748b;
            margin-bottom: 8px;
        }
        
        .footer-links {
            font-size: 11px;
            color: #94a3b8;
        }
        
        .footer-links a {
            color: #059669;
            text-decoration: none;
            margin: 0 8px;
        }
        
        @media (max-width: 600px) {
            .container {
                margin: 0;
                border-radius: 0;
            }
            
            .header {
                padding: 30px 20px;
            }
            
            .header h1 {
                font-size: 24px;
            }
            
            .content {
                padding: 24px 20px;
            }
            
            .info-box {
                padding: 16px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <!-- Header -->
        <div class="header">
            <h1>ðŸ¢ Welcome to ${brokerageName}!</h1>
            <p>Join your brokerage on North Shore Sign Co</p>
        </div>
        
        <!-- Content -->
        <div class="content">
            <div class="greeting">
                <p>Hi ${agentName},</p>
                <p style="margin-top: 12px;">You've been invited to join ${brokerageName} on North Shore Sign Co. Create your account below to access your brokerage's tools and manage your business.</p>
            </div>
            
            <!-- Brokerage Info -->
            <div class="info-box">
                <div class="info-label">Your Brokerage</div>
                <div class="info-value">${brokerageName}</div>
                
                <div class="info-label" style="margin-top: 12px;">Contact</div>
                <div class="info-value">${brokerageEmail}</div>
            </div>
            
            <!-- Highlight -->
            <div class="highlight">
                <div class="highlight-text">
                    âœ¨ Once you create your account, you'll be part of ${brokerageName}'s team on North Shore Sign Co with full access to collaboration tools and resources.
                </div>
            </div>
            
            <!-- Benefits -->
            <div class="benefits">
                <div class="benefits-title">What You'll Get Access To:</div>
                <ul class="benefits-list">
                    <li>ðŸ“Š Listing management and tracking</li>
                    <li>ðŸ‘¥ Team collaboration tools</li>
                    <li>ðŸ“§ Automated communications</li>
                    <li>ðŸ“± Mobile-friendly interface</li>
                    <li>ðŸ“ˆ Performance analytics</li>
                </ul>
            </div>
            
            <!-- CTA Button -->
            <a href="${signupLink}" class="cta-button">Create Your Account</a>
            
            <!-- Instructions -->
            <div class="instructions">
                <h3>Getting Started</h3>
                <ol>
                    <li>Click the "Create Your Account" button above</li>
                    <li>Enter your information (you'll be linked to ${brokerageName})</li>
                    <li>Set your password</li>
                    <li>Start managing your listings and team</li>
                </ol>
            </div>
            
            <!-- Support -->
            <div class="support-section">
                <div class="support-text">
                    <p><strong>Questions?</strong> Reach out to ${brokerageName} at <a href="mailto:${brokerageEmail}" class="support-link">${brokerageEmail}</a> or contact our support team at <a href="mailto:support@northshoresignco.com" class="support-link">support@northshoresignco.com</a>.</p>
                </div>
            </div>
        </div>
        
        <!-- Footer -->
        <div class="footer">
            <div class="footer-text">North Shore Sign Co · Seattle, WA · (206) 659-6323 · <a href="mailto:billing@northshoresignco.com">billing@northshoresignco.com</a></div>
            </div>
    </div>
</body>
</html>`;

  return {
    subject: `You're invited to join ${brokerageName} on North Shore Sign Co! ðŸ¢`,
    html,
  };
}

// Order confirmation email (for reference)
export function getOrderConfirmationEmail(
  realtorName: string,
  orderNumber: string,
  orderType: string,
  address: string,
  scheduledDate?: string
) {
  const scheduledDateStr = scheduledDate
    ? new Date(scheduledDate).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  const fields: AlertField[] = [
    { label: "Order #", value: escapeHtml(orderNumber) },
    { label: "Type", value: escapeHtml(orderType) },
    { label: "Address", value: escapeHtml(address) },
  ];

  if (scheduledDateStr) {
    fields.push({ label: "Scheduled", value: escapeHtml(scheduledDateStr) });
  }

  const html = buildAlertEmail({
    title: "Order Confirmed",
    subtitle: "Your order has been successfully placed",
    intro: `Hi ${escapeHtml(realtorName)}, your order has been successfully placed and we'll get started right away.`,
    fields,
    ctaLabel: "View Order in Dashboard",
        ctaLink: `${NORTH_SHORE_APP_URL}/dashboard/orders`,
    note: "You can manage this order anytime in your dashboard.",
    theme: ALERT_THEMES.success,
  });

  return {
    subject: `Order Confirmation - ${orderNumber}`,
    html,
  };
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
  const emailTemplate = getOrderConfirmationEmail(
    realtorName,
    orderNumber,
    orderDetails.type,
    orderDetails.address,
    orderDetails.scheduledDate
  );

  return sendEmail({
    to: email,
    subject: emailTemplate.subject,
    html: emailTemplate.html,
  });
}

// New Invoice Email
export function getNewInvoiceEmail(
  customerName: string,
  invoiceNumber: string,
  invoiceDate: string,
  dueDate: string,
  itemDescription: string,
  totalAmount: string,
  invoiceLink: string,
  _supportUrl?: string,
  _privacyUrl?: string,
  _termsUrl?: string
) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>New Invoice</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
            background-color: #f3f4f6;
            color: #333;
        }
        
        .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: white;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
        
        .header {
            background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%);
            color: white;
            padding: 40px 30px;
            text-align: center;
        }
        
        .header h1 {
            font-size: 28px;
            font-weight: 700;
            margin-bottom: 8px;
        }
        
        .header p {
            font-size: 16px;
            opacity: 0.95;
        }
        
        .content {
            padding: 40px 30px;
        }
        
        .greeting {
            font-size: 16px;
            margin-bottom: 24px;
            line-height: 1.6;
        }
        
        .invoice-box {
            background-color: #f0f9ff;
            border: 2px solid #bfdbfe;
            border-radius: 6px;
            padding: 20px;
            margin: 24px 0;
        }
        
        .invoice-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 12px;
            padding-bottom: 12px;
            border-bottom: 1px solid #dbeafe;
        }
        
        .invoice-row:last-child {
            border-bottom: none;
            margin-bottom: 0;
            padding-bottom: 0;
        }
        
        .invoice-label {
            font-size: 13px;
            color: #0c4a6e;
            font-weight: 600;
        }
        
        .invoice-value {
            font-size: 13px;
            color: #0f172a;
            font-weight: 500;
        }
        
        .invoice-total {
            background-color: #dbeafe;
            padding: 12px;
            border-radius: 4px;
            display: flex;
            justify-content: space-between;
            margin-top: 12px;
        }
        
        .invoice-total-label {
            font-size: 14px;
            font-weight: 700;
            color: #0c4a6e;
        }
        
        .invoice-total-value {
            font-size: 16px;
            font-weight: 700;
            color: #1e40af;
        }
        
        .highlight {
            background-color: #dbeafe;
            padding: 16px;
            border-radius: 6px;
            margin: 20px 0;
            border-left: 4px solid #2563eb;
        }
        
        .highlight-text {
            font-size: 14px;
            color: #0c4a6e;
            line-height: 1.6;
        }
        
        .cta-button {
            display: inline-block;
            width: 100%;
            padding: 14px 24px;
            margin: 24px 0;
            background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%);
            color: white;
            text-decoration: none;
            border-radius: 6px;
            font-size: 16px;
            font-weight: 600;
            text-align: center;
            transition: transform 0.2s, box-shadow 0.2s;
            box-shadow: 0 4px 6px rgba(37, 99, 235, 0.3);
        }
        
        .cta-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 12px rgba(37, 99, 235, 0.4);
        }
        
        .support-section {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e2e8f0;
        }
        
        .support-text {
            font-size: 13px;
            color: #64748b;
            line-height: 1.6;
        }
        
        .support-link {
            color: #2563eb;
            text-decoration: none;
        }
        
        .footer {
            background-color: #f1f5f9;
            padding: 24px 30px;
            text-align: center;
            border-top: 1px solid #e2e8f0;
        }
        
        .footer-text {
            font-size: 12px;
            color: #64748b;
            margin-bottom: 8px;
        }
        
        .footer-links {
            font-size: 11px;
            color: #94a3b8;
        }
        
        .footer-links a {
            color: #2563eb;
            text-decoration: none;
            margin: 0 8px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>ðŸ“‹ New Invoice</h1>
            <p>Your invoice is ready to view</p>
        </div>
        
        <div class="content">
            <div class="greeting">
                <p>Hi ${customerName},</p>
                <p style="margin-top: 12px;">We've created a new invoice for your recent order. Review the details below.</p>
            </div>
            
            <div class="invoice-box">
                <div class="invoice-row">
                    <span class="invoice-label">Invoice #</span>
                    <span class="invoice-value">${invoiceNumber}</span>
                </div>
                
                <div class="invoice-row">
                    <span class="invoice-label">Invoice Date</span>
                    <span class="invoice-value">${invoiceDate}</span>
                </div>
                
                <div class="invoice-row">
                    <span class="invoice-label">Due Date</span>
                    <span class="invoice-value">${dueDate}</span>
                </div>
                
                <div class="invoice-row">
                    <span class="invoice-label">Description</span>
                    <span class="invoice-value">${itemDescription}</span>
                </div>
                
                <div class="invoice-total">
                    <span class="invoice-total-label">Total Amount Due:</span>
                    <span class="invoice-total-value">${totalAmount}</span>
                </div>
            </div>
            
            <div class="highlight">
                <div class="highlight-text">
                    ðŸ’¡ Please review this invoice carefully. If you have any questions, contact us at <a href="mailto:billing@northshoresignco.com" style="color: #1e40af; font-weight: 600;">billing@northshoresignco.com</a>
                </div>
            </div>
            
            <a href="${invoiceLink}" class="cta-button">View Full Invoice</a>
            
            <div class="support-section">
                <div class="support-text">
                    <p><strong>Payment Questions?</strong> You can pay your invoice directly through our portal or contact our billing team for assistance.</p>
                </div>
            </div>
        </div>
        
        <div class="footer">
            <div class="footer-text">North Shore Sign Co · Seattle, WA · (206) 659-6323 · <a href="mailto:billing@northshoresignco.com">billing@northshoresignco.com</a></div>
            </div>
    </div>
</body>
</html>`;

  return {
    subject: "ðŸ“‹ New Invoice",
    html,
  };
}

// 811 Clearance Approved Email
export function get811ClearedEmail(
  customerName: string,
  propertyAddress: string,
  clearanceId: string,
  clearanceDate: string,
  orderLink: string,
  _supportUrl?: string,
  _privacyUrl?: string,
  _termsUrl?: string
) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>811 Clearance Approved</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
            background-color: #f3f4f6;
            color: #333;
        }
        
        .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: white;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
        
        .header {
            background: linear-gradient(135deg, #059669 0%, #047857 100%);
            color: white;
            padding: 40px 30px;
            text-align: center;
        }
        
        .header h1 {
            font-size: 28px;
            font-weight: 700;
            margin-bottom: 8px;
        }
        
        .header p {
            font-size: 16px;
            opacity: 0.95;
        }
        
        .content {
            padding: 40px 30px;
        }
        
        .greeting {
            font-size: 16px;
            margin-bottom: 24px;
            line-height: 1.6;
        }
        
        .success-box {
            background-color: #d1fae5;
            border: 2px solid #a7f3d0;
            border-radius: 6px;
            padding: 20px;
            margin: 24px 0;
        }
        
        .success-icon {
            font-size: 32px;
            text-align: center;
            margin-bottom: 12px;
        }
        
        .success-title {
            font-size: 16px;
            color: #065f46;
            font-weight: 700;
            text-align: center;
            margin-bottom: 8px;
        }
        
        .success-text {
            font-size: 14px;
            color: #047857;
            text-align: center;
            line-height: 1.6;
        }
        
        .detail-box {
            background-color: #f0fdf4;
            border: 1px solid #dcfce7;
            border-radius: 6px;
            padding: 16px;
            margin: 20px 0;
        }
        
        .detail-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 12px;
            padding-bottom: 12px;
            border-bottom: 1px solid #dcfce7;
        }
        
        .detail-row:last-child {
            border-bottom: none;
            margin-bottom: 0;
            padding-bottom: 0;
        }
        
        .detail-label {
            font-size: 13px;
            color: #166534;
            font-weight: 600;
        }
        
        .detail-value {
            font-size: 13px;
            color: #065f46;
            font-weight: 500;
        }
        
        .next-steps {
            background-color: #ecfdf5;
            padding: 16px;
            border-radius: 6px;
            margin: 20px 0;
            border-left: 4px solid #059669;
        }
        
        .next-steps-title {
            font-size: 14px;
            font-weight: 700;
            color: #047857;
            margin-bottom: 8px;
        }
        
        .next-steps-text {
            font-size: 13px;
            color: #065f46;
            line-height: 1.6;
        }
        
        .cta-button {
            display: inline-block;
            width: 100%;
            padding: 14px 24px;
            margin: 24px 0;
            background: linear-gradient(135deg, #059669 0%, #047857 100%);
            color: white;
            text-decoration: none;
            border-radius: 6px;
            font-size: 16px;
            font-weight: 600;
            text-align: center;
            transition: transform 0.2s, box-shadow 0.2s;
            box-shadow: 0 4px 6px rgba(5, 150, 105, 0.3);
        }
        
        .cta-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 12px rgba(5, 150, 105, 0.4);
        }
        
        .support-section {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e2e8f0;
        }
        
        .support-text {
            font-size: 13px;
            color: #64748b;
            line-height: 1.6;
        }
        
        .support-link {
            color: #059669;
            text-decoration: none;
        }
        
        .footer {
            background-color: #f1f5f9;
            padding: 24px 30px;
            text-align: center;
            border-top: 1px solid #e2e8f0;
        }
        
        .footer-text {
            font-size: 12px;
            color: #64748b;
            margin-bottom: 8px;
        }
        
        .footer-links {
            font-size: 11px;
            color: #94a3b8;
        }
        
        .footer-links a {
            color: #059669;
            text-decoration: none;
            margin: 0 8px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>âœ… 811 Clearance Approved</h1>
            <p>Your utility clearance has been granted</p>
        </div>
        
        <div class="content">
            <div class="greeting">
                <p>Hi ${customerName},</p>
                <p style="margin-top: 12px;">Great news! Your 811 (Dig Safe) clearance has been fully approved and you're cleared to proceed with installation.</p>
            </div>
            
            <div class="success-box">
                <div class="success-icon">âœ¨</div>
                <div class="success-title">Clearance Fully Approved</div>
                <div class="success-text">You are now approved for installation to begin on your property.</div>
            </div>
            
            <div class="detail-box">
                <div class="detail-row">
                    <span class="detail-label">Address</span>
                    <span class="detail-value">${propertyAddress}</span>
                </div>
                
                <div class="detail-row">
                    <span class="detail-label">Clearance ID</span>
                    <span class="detail-value">${clearanceId}</span>
                </div>
                
                <div class="detail-row">
                    <span class="detail-label">Clearance Date</span>
                    <span class="detail-value">${clearanceDate}</span>
                </div>
            </div>
            
            <div class="next-steps">
                <div class="next-steps-title">ðŸ“… What's Next?</div>
                <div class="next-steps-text">
                    Your installation crew will contact you within 24 hours to schedule a specific time for installation. Make sure someone is available at the property during the scheduled time.
                </div>
            </div>
            
            <a href="${orderLink}" class="cta-button">View Your Order</a>
            
            <div class="support-section">
                <div class="support-text">
                    <p><strong>Questions?</strong> If you need to reschedule or have any concerns, please <a href="mailto:support@northshoresignco.com" class="support-link">contact our support team</a>.</p>
                </div>
            </div>
        </div>
        
        <div class="footer">
            <div class="footer-text">North Shore Sign Co · Seattle, WA · (206) 659-6323 · <a href="mailto:billing@northshoresignco.com">billing@northshoresignco.com</a></div>
            </div>
    </div>
</body>
</html>`;

  return {
    subject: "âœ… 811 Clearance Approved",
    html,
  };
}

// Past Due Invoice Email
export function getPastDueInvoiceEmail(
  customerName: string,
  invoiceNumber: string,
  dueDate: string,
  daysOverdue: number,
  totalAmount: string,
  paymentLink: string,
  _supportUrl?: string,
  _privacyUrl?: string,
  _termsUrl?: string
) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Invoice Past Due</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
            background-color: #f3f4f6;
            color: #333;
        }
        
        .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: white;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
        
        .header {
            background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%);
            color: white;
            padding: 40px 30px;
            text-align: center;
        }
        
        .header h1 {
            font-size: 28px;
            font-weight: 700;
            margin-bottom: 8px;
        }
        
        .header p {
            font-size: 16px;
            opacity: 0.95;
        }
        
        .content {
            padding: 40px 30px;
        }
        
        .greeting {
            font-size: 16px;
            margin-bottom: 24px;
            line-height: 1.6;
        }
        
        .warning-box {
            background-color: #fee2e2;
            border: 2px solid #fecaca;
            border-radius: 6px;
            padding: 20px;
            margin: 24px 0;
        }
        
        .warning-title {
            font-size: 16px;
            color: #991b1b;
            font-weight: 700;
            margin-bottom: 8px;
        }
        
        .warning-text {
            font-size: 14px;
            color: #7f1d1d;
            line-height: 1.6;
        }
        
        .invoice-box {
            background-color: #fef2f2;
            border: 1px solid #fee2e2;
            border-radius: 6px;
            padding: 16px;
            margin: 20px 0;
        }
        
        .invoice-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 12px;
            padding-bottom: 12px;
            border-bottom: 1px solid #fee2e2;
        }
        
        .invoice-row:last-child {
            border-bottom: none;
            margin-bottom: 0;
            padding-bottom: 0;
        }
        
        .invoice-label {
            font-size: 13px;
            color: #991b1b;
            font-weight: 600;
        }
        
        .invoice-value {
            font-size: 13px;
            color: #7f1d1d;
            font-weight: 500;
        }
        
        .amount-due {
            background-color: #dc2626;
            color: white;
            padding: 14px;
            border-radius: 4px;
            display: flex;
            justify-content: space-between;
            margin-top: 12px;
        }
        
        .amount-due-label {
            font-size: 14px;
            font-weight: 700;
        }
        
        .amount-due-value {
            font-size: 16px;
            font-weight: 700;
        }
        
        .urgent-box {
            background-color: #ffe5e5;
            border-left: 4px solid #dc2626;
            padding: 16px;
            margin: 20px 0;
            border-radius: 4px;
        }
        
        .urgent-text {
            font-size: 13px;
            color: #991b1b;
            line-height: 1.6;
        }
        
        .cta-button {
            display: inline-block;
            width: 100%;
            padding: 14px 24px;
            margin: 24px 0;
            background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%);
            color: white;
            text-decoration: none;
            border-radius: 6px;
            font-size: 16px;
            font-weight: 600;
            text-align: center;
            transition: transform 0.2s, box-shadow 0.2s;
            box-shadow: 0 4px 6px rgba(220, 38, 38, 0.3);
        }
        
        .cta-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 12px rgba(220, 38, 38, 0.4);
        }
        
        .support-section {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e2e8f0;
        }
        
        .support-text {
            font-size: 13px;
            color: #64748b;
            line-height: 1.6;
        }
        
        .support-link {
            color: #dc2626;
            text-decoration: none;
        }
        
        .footer {
            background-color: #f1f5f9;
            padding: 24px 30px;
            text-align: center;
            border-top: 1px solid #e2e8f0;
        }
        
        .footer-text {
            font-size: 12px;
            color: #64748b;
            margin-bottom: 8px;
        }
        
        .footer-links {
            font-size: 11px;
            color: #94a3b8;
        }
        
        .footer-links a {
            color: #dc2626;
            text-decoration: none;
            margin: 0 8px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>âš ï¸ Invoice Past Due</h1>
            <p>Action required: Payment is overdue</p>
        </div>
        
        <div class="content">
            <div class="greeting">
                <p>Hi ${customerName},</p>
                <p style="margin-top: 12px;">We notice that your invoice ${invoiceNumber} is now ${daysOverdue} days overdue. Please submit payment as soon as possible.</p>
            </div>
            
            <div class="warning-box">
                <div class="warning-title">ðŸš¨ Immediate Action Required</div>
                <div class="warning-text">
                    Your payment is overdue. Please remit payment immediately to avoid service interruption or additional fees.
                </div>
            </div>
            
            <div class="invoice-box">
                <div class="invoice-row">
                    <span class="invoice-label">Invoice #</span>
                    <span class="invoice-value">${invoiceNumber}</span>
                </div>
                
                <div class="invoice-row">
                    <span class="invoice-label">Original Due Date</span>
                    <span class="invoice-value">${dueDate}</span>
                </div>
                
                <div class="invoice-row">
                    <span class="invoice-label">Days Overdue</span>
                    <span class="invoice-value">${daysOverdue}</span>
                </div>
                
                <div class="amount-due">
                    <span class="amount-due-label">Amount Due Now:</span>
                    <span class="amount-due-value">${totalAmount}</span>
                </div>
            </div>
            
            <div class="urgent-box">
                <div class="urgent-text">
                    <strong>Note:</strong> Continued non-payment may result in account suspension or legal action. Please contact us immediately to arrange payment or discuss payment options.
                </div>
            </div>
            
            <a href="${paymentLink}" class="cta-button">Pay Invoice Now</a>
            
            <div class="support-section">
                <div class="support-text">
                    <p><strong>Need to arrange payment?</strong> Please <a href="mailto:billing@northshoresignco.com" class="support-link">contact our billing department</a> right away to discuss your account.</p>
                </div>
            </div>
        </div>
        
        <div class="footer">
            <div class="footer-text">North Shore Sign Co · Seattle, WA · (206) 659-6323 · <a href="mailto:billing@northshoresignco.com">billing@northshoresignco.com</a></div>
            </div>
    </div>
</body>
</html>`;

  return {
    subject: "âš ï¸ Invoice Past Due - Immediate Action Required",
    html,
  };
}

export function getInvoiceReminderEmail(
    customerName: string,
    invoiceNumber: string,
    dueDate: string,
    daysOverdue: number,
    totalAmount: string,
    paymentLink: string,
    reminderCount: number,
    _supportUrl?: string,
    _privacyUrl?: string,
    _termsUrl?: string
) {
    const reminderConfig = [
        { title: "7-Day Invoice Reminder", subtitle: "Your invoice is 7 days overdue", accent: "#2563eb" },
        { title: "14-Day Invoice Reminder", subtitle: "Your invoice is 14 days overdue", accent: "#d97706" },
        { title: "30-Day Invoice Reminder", subtitle: "Your invoice is 30 days overdue", accent: "#dc2626" },
    ][Math.min(Math.max(reminderCount, 0), 2)];

    const html = buildAlertEmail({
        title: reminderConfig.title,
        subtitle: reminderConfig.subtitle,
        intro: `Hi ${escapeHtml(customerName)}, this is a friendly reminder that invoice ${escapeHtml(invoiceNumber)} is currently ${daysOverdue} days overdue.`,
        fields: [
            { label: "Invoice #", value: escapeHtml(invoiceNumber) },
            { label: "Due Date", value: escapeHtml(dueDate) },
            { label: "Days Overdue", value: String(daysOverdue) },
            { label: "Amount Due", value: escapeHtml(totalAmount) },
        ],
        ctaLabel: "Pay Invoice Now",
        ctaLink: paymentLink,
        note: "Please pay as soon as possible to keep your account in good standing.",
        theme: reminderCount >= 2 ? ALERT_THEMES.danger : reminderCount === 1 ? ALERT_THEMES.warning : ALERT_THEMES.info,
    });

    return {
        subject: reminderConfig.title,
        html,
    };
}

// Free Installation Credit Email
export function getFreeInstallCreditEmail(
  customerName: string,
  creditValue: string,
  expirationDate: string,
  creditCode: string,
  validity: string,
  orderLink: string,
  _supportUrl?: string,
  _privacyUrl?: string,
  _termsUrl?: string
) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Credit Added</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
            background-color: #f3f4f6;
            color: #333;
        }
        
        .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: white;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
        
        .header {
            background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
            color: white;
            padding: 40px 30px;
            text-align: center;
        }
        
        .header h1 {
            font-size: 28px;
            font-weight: 700;
            margin-bottom: 8px;
        }
        
        .header p {
            font-size: 16px;
            opacity: 0.95;
        }
        
        .content {
            padding: 40px 30px;
        }
        
        .greeting {
            font-size: 16px;
            margin-bottom: 24px;
            line-height: 1.6;
        }
        
        .bonus-box {
            background: linear-gradient(135deg, #fef3c7 0%, #fef08a 100%);
            border: 2px solid #fcd34d;
            border-radius: 6px;
            padding: 24px;
            margin: 24px 0;
            text-align: center;
        }
        
        .bonus-icon {
            font-size: 48px;
            margin-bottom: 12px;
        }
        
        .bonus-title {
            font-size: 18px;
            color: #92400e;
            font-weight: 700;
            margin-bottom: 8px;
        }
        
        .bonus-value {
            font-size: 24px;
            color: #b45309;
            font-weight: 700;
        }
        
        .detail-box {
            background-color: #fef3c7;
            border: 1px solid #fcd34d;
            border-radius: 6px;
            padding: 16px;
            margin: 20px 0;
        }
        
        .detail-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 12px;
            padding-bottom: 12px;
            border-bottom: 1px solid #fcd34d;
        }
        
        .detail-row:last-child {
            border-bottom: none;
            margin-bottom: 0;
            padding-bottom: 0;
        }
        
        .detail-label {
            font-size: 13px;
            color: #92400e;
            font-weight: 600;
        }
        
        .detail-value {
            font-size: 13px;
            color: #b45309;
            font-weight: 500;
        }
        
        .highlight {
            background-color: #fef9e7;
            padding: 16px;
            border-radius: 6px;
            margin: 20px 0;
            border-left: 4px solid #f59e0b;
        }
        
        .highlight-text {
            font-size: 14px;
            color: #92400e;
            line-height: 1.6;
        }
        
        .cta-button {
            display: inline-block;
            width: 100%;
            padding: 14px 24px;
            margin: 24px 0;
            background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
            color: white;
            text-decoration: none;
            border-radius: 6px;
            font-size: 16px;
            font-weight: 600;
            text-align: center;
            transition: transform 0.2s, box-shadow 0.2s;
            box-shadow: 0 4px 6px rgba(245, 158, 11, 0.3);
        }
        
        .cta-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 12px rgba(245, 158, 11, 0.4);
        }
        
        .terms {
            font-size: 12px;
            color: #92400e;
            background-color: #fef3c7;
            border: 1px solid #fcd34d;
            border-radius: 4px;
            padding: 12px;
            margin: 20px 0;
            line-height: 1.6;
        }
        
        .support-section {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e2e8f0;
        }
        
        .support-text {
            font-size: 13px;
            color: #64748b;
            line-height: 1.6;
        }
        
        .support-link {
            color: #f59e0b;
            text-decoration: none;
        }
        
        .footer {
            background-color: #f1f5f9;
            padding: 24px 30px;
            text-align: center;
            border-top: 1px solid #e2e8f0;
        }
        
        .footer-text {
            font-size: 12px;
            color: #64748b;
            margin-bottom: 8px;
        }
        
        .footer-links {
            font-size: 11px;
            color: #94a3b8;
        }
        
        .footer-links a {
            color: #f59e0b;
            text-decoration: none;
            margin: 0 8px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>ðŸŽ‰ Great News!</h1>
            <p>A credit has been added to your account</p>
        </div>
        
        <div class="content">
            <div class="greeting">
                <p>Hi ${customerName},</p>
                <p style="margin-top: 12px;">Excellent news! We've added a credit to your account. You can now use this towards future orders, either partially or in full.</p>
            </div>
            
            <div class="bonus-box">
                <div class="bonus-icon">ðŸŽ</div>
                <div class="bonus-title">Account Credit</div>
                <div class="bonus-value">${creditValue}</div>
            </div>
            
            <div class="detail-box">
                <div class="detail-row">
                    <span class="detail-label">Credit Amount</span>
                    <span class="detail-value">${creditValue}</span>
                </div>
                
                <div class="detail-row">
                    <span class="detail-label">Expires</span>
                    <span class="detail-value">${expirationDate}</span>
                </div>
                
                <div class="detail-row">
                    <span class="detail-label">Credit Code</span>
                    <span class="detail-value">${creditCode}</span>
                </div>
            </div>
            
            <div class="highlight">
                <div class="highlight-text">
                    ðŸ’¡ This credit can be applied to future orders. Enter the credit code during checkout or mention it when placing an order, and any unused balance remains available for later.
                </div>
            </div>
            
            <a href="${orderLink}" class="cta-button">Browse Orders</a>
            
            <div class="terms">
                <strong>Terms:</strong> This credit is valid for ${validity}. It cannot be transferred, refunded, or combined with other promotional offers.
            </div>
            
            <div class="support-section">
                <div class="support-text">
                    <p><strong>Questions?</strong> We're here to help! <a href="mailto:support@northshoresignco.com" class="support-link">Contact our team</a> to learn more about how to use your credit.</p>
                </div>
            </div>
        </div>
        
        <div class="footer">
            <div class="footer-text">North Shore Sign Co · Seattle, WA · (206) 659-6323 · <a href="mailto:billing@northshoresignco.com">billing@northshoresignco.com</a></div>
            </div>
    </div>
</body>
</html>`;

  return {
        subject: "ðŸŽ‰ Credit Added to Your Account!",
    html,
  };
}

// Post-Installation Complete Email
export function getPostInstalledEmail(
  customerName: string,
  orderNumber: string,
  installationAddress: string,
  completionDate: string,
  installationImageUrl: string,
  orderLink: string,
  reviewLink: string,
  _supportUrl?: string,
  _privacyUrl?: string,
  _termsUrl?: string
) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Installation Complete</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
            background-color: #f3f4f6;
            color: #333;
        }
        
        .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: white;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
        
        .header {
            background: linear-gradient(135deg, #059669 0%, #047857 100%);
            color: white;
            padding: 40px 30px;
            text-align: center;
        }
        
        .header h1 {
            font-size: 28px;
            font-weight: 700;
            margin-bottom: 8px;
        }
        
        .header p {
            font-size: 16px;
            opacity: 0.95;
        }
        
        .content {
            padding: 40px 30px;
        }
        
        .greeting {
            font-size: 16px;
            margin-bottom: 24px;
            line-height: 1.6;
        }
        
        .success-banner {
            background-color: #d1fae5;
            border: 2px solid #a7f3d0;
            border-radius: 6px;
            padding: 16px;
            margin: 24px 0;
            text-align: center;
        }
        
        .success-text {
            font-size: 14px;
            color: #047857;
            font-weight: 600;
        }
        
        .image-section {
            margin: 24px 0;
            text-align: center;
            background-color: #f0fdf4;
            padding: 20px;
            border-radius: 6px;
            border: 2px solid #d1fae5;
        }
        
        .image-label {
            font-size: 12px;
            color: #166534;
            font-weight: 600;
            text-transform: uppercase;
            margin-bottom: 12px;
            letter-spacing: 0.5px;
        }
        
        .installation-image {
            max-width: 100%;
            height: auto;
            border-radius: 4px;
            margin: 12px 0;
        }
        
        .detail-box {
            background-color: #ecfdf5;
            border: 1px solid #d1fae5;
            border-radius: 6px;
            padding: 16px;
            margin: 20px 0;
        }
        
        .detail-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 12px;
            padding-bottom: 12px;
            border-bottom: 1px solid #d1fae5;
        }
        
        .detail-row:last-child {
            border-bottom: none;
            margin-bottom: 0;
            padding-bottom: 0;
        }
        
        .detail-label {
            font-size: 13px;
            color: #065f46;
            font-weight: 600;
        }
        
        .detail-value {
            font-size: 13px;
            color: #047857;
            font-weight: 500;
        }
        
        .cta-button {
            display: inline-block;
            width: 100%;
            padding: 14px 24px;
            margin: 24px 0;
            background: linear-gradient(135deg, #059669 0%, #047857 100%);
            color: white;
            text-decoration: none;
            border-radius: 6px;
            font-size: 16px;
            font-weight: 600;
            text-align: center;
            transition: transform 0.2s, box-shadow 0.2s;
            box-shadow: 0 4px 6px rgba(5, 150, 105, 0.3);
        }
        
        .cta-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 12px rgba(5, 150, 105, 0.4);
        }
        
        .next-steps {
            background-color: #f0fdf4;
            padding: 16px;
            border-radius: 6px;
            margin: 20px 0;
        }
        
        .next-steps-title {
            font-size: 14px;
            font-weight: 700;
            color: #047857;
            margin-bottom: 8px;
        }
        
        .next-steps-list {
            margin-left: 20px;
            font-size: 13px;
            color: #065f46;
            line-height: 1.8;
        }
        
        .next-steps-list li {
            margin-bottom: 6px;
        }
        
        .rating-box {
            background-color: #fef3c7;
            border: 2px solid #fcd34d;
            border-radius: 6px;
            padding: 16px;
            margin: 20px 0;
            text-align: center;
        }
        
        .rating-text {
            font-size: 13px;
            color: #92400e;
            margin-bottom: 12px;
        }
        
        .rating-link {
            display: inline-block;
            padding: 8px 16px;
            background-color: #fcd34d;
            color: #92400e;
            text-decoration: none;
            border-radius: 4px;
            font-weight: 600;
            font-size: 12px;
        }
        
        .support-section {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e2e8f0;
        }
        
        .support-text {
            font-size: 13px;
            color: #64748b;
            line-height: 1.6;
        }
        
        .support-link {
            color: #059669;
            text-decoration: none;
        }
        
        .footer {
            background-color: #f1f5f9;
            padding: 24px 30px;
            text-align: center;
            border-top: 1px solid #e2e8f0;
        }
        
        .footer-text {
            font-size: 12px;
            color: #64748b;
            margin-bottom: 8px;
        }
        
        .footer-links {
            font-size: 11px;
            color: #94a3b8;
        }
        
        .footer-links a {
            color: #059669;
            text-decoration: none;
            margin: 0 8px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>âœ… Installation Complete!</h1>
            <p>Your sign is now installed and looking great</p>
        </div>
        
        <div class="content">
            <div class="greeting">
                <p>Hi ${customerName},</p>
                <p style="margin-top: 12px;">We're thrilled to let you know that your sign installation is now complete! Check out the photo below to see your new sign in action.</p>
            </div>
            
            <div class="success-banner">
                <div class="success-text">ðŸŽ‰ Installation Successfully Completed</div>
            </div>
            
            <div class="image-section">
                <div class="image-label">Your Installed Sign</div>
                <img src="${installationImageUrl}" alt="Installation Photo" class="installation-image" style="max-width: 100%; border-radius: 4px;">
            </div>
            
            <div class="detail-box">
                <div class="detail-row">
                    <span class="detail-label">Order #</span>
                    <span class="detail-value">${orderNumber}</span>
                </div>
                
                <div class="detail-row">
                    <span class="detail-label">Location</span>
                    <span class="detail-value">${installationAddress}</span>
                </div>
                
                <div class="detail-row">
                    <span class="detail-label">Completion Date</span>
                    <span class="detail-value">${completionDate}</span>
                </div>
            </div>
            
            <a href="${orderLink}" class="cta-button">View Full Order Details</a>
            
            <div class="next-steps">
                <div class="next-steps-title">ðŸ“‹ What's Next?</div>
                <ul class="next-steps-list">
                    <li><strong>Maintenance:</strong> Your sign will require periodic maintenance. We offer maintenance packages if interested.</li>
                    <li><strong>Support:</strong> If you notice any issues, contact us right away for support.</li>
                    <li><strong>Thank You:</strong> We appreciate your business and hope you love your new sign!</li>
                </ul>
            </div>
            
            <div class="rating-box">
                <div class="rating-text">How was your experience with us?</div>
                <a href="${reviewLink}" class="rating-link">Leave a Review â­</a>
            </div>
            
            <div class="support-section">
                <div class="support-text">
                    <p><strong>Need Maintenance or Support?</strong> We're here to help! <a href="mailto:support@northshoresignco.com" class="support-link">Contact our team</a> for any questions or future sign services.</p>
                </div>
            </div>
        </div>
        
        <div class="footer">
            <div class="footer-text">North Shore Sign Co · Seattle, WA · (206) 659-6323 · <a href="mailto:billing@northshoresignco.com">billing@northshoresignco.com</a></div>
            </div>
    </div>
</body>
</html>`;

  return {
    subject: "âœ… Your Installation is Complete!",
    html,
  };
}

type AlertField = {
    label: string;
    value: string;
};

type AlertTheme = {
    headerGradient: string;
    accentColor: string;
    softBackground: string;
    softBorder: string;
};

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function buildAlertEmail({
    title,
    subtitle,
    intro,
    fields,
    ctaLabel,
    ctaLink,
    note,
    listTitle,
    listItems,
    theme,
}: {
    title: string;
    subtitle: string;
    intro: string;
    fields: AlertField[];
    ctaLabel?: string;
    ctaLink?: string;
    note?: string;
    listTitle?: string;
    listItems?: string[];
    theme: AlertTheme;
}) {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
        <style>
                * {
                        margin: 0;
                        padding: 0;
                        box-sizing: border-box;
                }

                body {
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
                        background-color: #f3f4f6;
                        color: #333;
                }

                .container {
                        max-width: 600px;
                        margin: 0 auto;
                        background-color: white;
                        border-radius: 8px;
                        overflow: hidden;
                        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                }

                .header {
                        background: ${theme.headerGradient};
                        color: white;
                        padding: 36px 28px;
                        text-align: center;
                }

                .header h1 {
                        font-size: 26px;
                        font-weight: 700;
                        margin-bottom: 8px;
                }

                .header p {
                        font-size: 15px;
                        opacity: 0.95;
                }

                .content {
                        padding: 32px 28px;
                }

                .intro {
                        font-size: 15px;
                        line-height: 1.7;
                        margin-bottom: 20px;
                        color: #334155;
                }

                .detail-box {
                        background: ${theme.softBackground};
                        border: 1px solid ${theme.softBorder};
                        border-radius: 8px;
                        padding: 16px;
                        margin: 18px 0;
                }

                .detail-row {
                        display: flex;
                        justify-content: space-between;
                        gap: 12px;
                        margin-bottom: 10px;
                        padding-bottom: 10px;
                        border-bottom: 1px solid ${theme.softBorder};
                }

                .detail-row:last-child {
                        margin-bottom: 0;
                        padding-bottom: 0;
                        border-bottom: none;
                }

                .detail-label {
                        font-size: 12px;
                        font-weight: 700;
                        text-transform: uppercase;
                        letter-spacing: 0.4px;
                        color: ${theme.accentColor};
                }

                .detail-value {
                        font-size: 13px;
                        text-align: right;
                        line-height: 1.4;
                        color: #334155;
                        word-break: break-word;
                }

                .list-box {
                        margin: 18px 0;
                        background-color: #f8fafc;
                        border-radius: 8px;
                        padding: 14px 16px;
                        border-left: 4px solid ${theme.accentColor};
                }

                .list-title {
                        font-size: 13px;
                        font-weight: 700;
                        margin-bottom: 8px;
                        color: #0f172a;
                }

                .list-box ul {
                        margin-left: 18px;
                        color: #475569;
                        font-size: 13px;
                        line-height: 1.7;
                }

                .cta-button {
                        display: inline-block;
                        width: 100%;
                        padding: 13px 20px;
                        margin: 16px 0;
                        background: ${theme.headerGradient};
                        color: white;
                        text-decoration: none;
                        border-radius: 6px;
                        font-size: 15px;
                        font-weight: 600;
                        text-align: center;
                }

                .note {
                        margin-top: 12px;
                        padding: 12px;
                        border-radius: 6px;
                        background-color: #fffbeb;
                        border: 1px solid #fde68a;
                        color: #92400e;
                        font-size: 12px;
                        line-height: 1.6;
                }

                .footer {
                        background-color: #f1f5f9;
                        padding: 18px 24px;
                        text-align: center;
                        border-top: 1px solid #e2e8f0;
                        font-size: 12px;
                        color: #64748b;
                }
        </style>
</head>
<body>
        <div class="container">
                <div class="header">
                        <h1>${title}</h1>
                        <p>${subtitle}</p>
                </div>

                <div class="content">
                        <p class="intro">${intro}</p>

                        <div class="detail-box">
                                ${fields
                                    .map(
                                        (field) => `<div class="detail-row"><span class="detail-label">${field.label}</span><span class="detail-value">${field.value}</span></div>`
                                    )
                                    .join("")}
                        </div>

                        ${
                            listItems && listItems.length > 0
                                ? `<div class="list-box"><div class="list-title">${listTitle || "Details"}</div><ul>${listItems.map((item) => `<li>${item}</li>`).join("")}</ul></div>`
                                : ""
                        }

                        ${ctaLink && ctaLabel ? `<a href="${ctaLink}" class="cta-button">${ctaLabel}</a>` : ""}

                        ${note ? `<div class="note">${note}</div>` : ""}
                </div>

                <div class="footer">
                        Â© 2026 North Shore Sign Co. Automated system alert.
                </div>
        </div>
</body>
</html>`;

    return html;
}

const ALERT_THEMES = {
    warning: {
        headerGradient: "linear-gradient(135deg, #d97706 0%, #b45309 100%)",
        accentColor: "#b45309",
        softBackground: "#fffbeb",
        softBorder: "#fde68a",
    },
    danger: {
        headerGradient: "linear-gradient(135deg, #dc2626 0%, #991b1b 100%)",
        accentColor: "#991b1b",
        softBackground: "#fef2f2",
        softBorder: "#fecaca",
    },
    info: {
        headerGradient: "linear-gradient(135deg, #2563eb 0%, #1e40af 100%)",
        accentColor: "#1d4ed8",
        softBackground: "#eff6ff",
        softBorder: "#bfdbfe",
    },
    success: {
        headerGradient: "linear-gradient(135deg, #059669 0%, #047857 100%)",
        accentColor: "#047857",
        softBackground: "#ecfdf5",
        softBorder: "#a7f3d0",
    },
} as const;

export function get811NeedsReviewAlertEmail(
    ticketNumber: string,
    fromEmail: string,
    emailSubject: string,
    parsedAddress: string,
    reviewLink: string
) {
    return {
        subject: `811 Ticket Needs Review: ${ticketNumber}`,
        html: buildAlertEmail({
            title: "811 Manual Review Needed",
            subtitle: "Address extraction confidence is low",
            intro: "A new 811 ticket was created but needs manual review before any automated hold decisions are finalized.",
            fields: [
                { label: "Ticket", value: escapeHtml(ticketNumber) },
                { label: "From", value: escapeHtml(fromEmail) },
                { label: "Subject", value: escapeHtml(emailSubject) },
                { label: "Parsed Address", value: escapeHtml(parsedAddress) },
            ],
            ctaLabel: "Review 811 Ticket",
            ctaLink: reviewLink,
            note: "No orders were placed on hold automatically for this message.",
            theme: ALERT_THEMES.warning,
        }),
    };
}

export function get811TicketCreatedAlertEmail(
    ticketNumber: string,
    address: string,
    workStartDate: string,
    fromEmail: string,
    status: string,
    matchedOrders: Array<{ orderNumber: string; address: string }>,
    ticketLink: string
) {
    return {
        subject: `811 Ticket Created: ${ticketNumber} (${matchedOrders.length} orders held)`,
        html: buildAlertEmail({
            title: "811 Ticket Created",
            subtitle: "Matching process complete",
            intro: "An inbound 811 ticket was processed and matching orders have been evaluated for hold status.",
            fields: [
                { label: "Ticket", value: escapeHtml(ticketNumber) },
                { label: "Address", value: escapeHtml(address) },
                { label: "Work Start", value: escapeHtml(workStartDate) },
                { label: "From", value: escapeHtml(fromEmail) },
                { label: "Status", value: escapeHtml(status) },
            ],
            listTitle: `Matched Orders (${matchedOrders.length})`,
            listItems: matchedOrders.map((order) => `${escapeHtml(order.orderNumber)} - ${escapeHtml(order.address)}`),
            ctaLabel: "View Ticket Details",
            ctaLink: ticketLink,
            note: matchedOrders.length > 0 ? "Matched orders were moved to ON_HOLD." : "No matching orders were found.",
            theme: ALERT_THEMES.info,
        }),
    };
}

export function get811HoldReleasedEmail(
    orderNumber: string,
    ticketNumber: string,
    adminNotes?: string
) {
    return {
        subject: `Order ${orderNumber} - 811 Hold Released`,
        html: buildAlertEmail({
            title: "811 Hold Released",
            subtitle: "Your order is back in the schedule queue",
            intro: "The 811 hold tied to your order has been cleared and your order has been returned to SCHEDULED.",
            fields: [
                { label: "Order", value: escapeHtml(orderNumber) },
                { label: "Ticket", value: escapeHtml(ticketNumber) },
                { label: "Order Status", value: "SCHEDULED" },
            ],
            note: adminNotes ? `Admin notes: ${escapeHtml(adminNotes)}` : undefined,
            theme: ALERT_THEMES.success,
        }),
    };
}

export function get811TicketClearedAdminEmail(
    ticketNumber: string,
    orderNumbers: string[],
    adminNotes?: string
) {
    return {
        subject: `811 Ticket Cleared: ${ticketNumber}`,
        html: buildAlertEmail({
            title: "811 Ticket Cleared",
            subtitle: "Held orders were released",
            intro: "An administrator cleared this 811 ticket and related orders were released back into scheduling.",
            fields: [
                { label: "Ticket", value: escapeHtml(ticketNumber) },
                { label: "Orders Released", value: String(orderNumbers.length) },
            ],
            listTitle: "Order Numbers",
            listItems: orderNumbers.map((orderNumber) => escapeHtml(orderNumber)),
            note: adminNotes ? `Admin notes: ${escapeHtml(adminNotes)}` : undefined,
            theme: ALERT_THEMES.success,
        }),
    };
}

export function get811TicketDismissedAdminEmail(
    ticketNumber: string,
    adminNotes?: string
) {
    return {
        subject: `811 Ticket Dismissed: ${ticketNumber}`,
        html: buildAlertEmail({
            title: "811 Ticket Dismissed",
            subtitle: "Marked as false positive",
            intro: "This 811 ticket was dismissed by an administrator. Any existing order holds remain in place unless manually changed.",
            fields: [{ label: "Ticket", value: escapeHtml(ticketNumber) }],
            note: adminNotes ? `Reason: ${escapeHtml(adminNotes)}` : "No dismissal reason was provided.",
            theme: ALERT_THEMES.warning,
        }),
    };
}

export function get811ManualTicketCreatedAlertEmail(
  ticketNumber: string,
  fromEmail: string,
  emailSubject: string,
  parsedAddress: string,
  reviewLink: string
) {
  return {
    subject: `811 Manual Ticket: ${ticketNumber}`,
    html: buildAlertEmail({
      title: "811 Ticket Created",
      subtitle: "Manual creation by admin",
      intro: "An administrator manually created a new 811 ticket. Please review and process as needed.",
      fields: [
        { label: "Ticket", value: escapeHtml(ticketNumber) },
        { label: "From", value: escapeHtml(fromEmail) },
        { label: "Subject", value: escapeHtml(emailSubject) },
        { label: "Parsed Address", value: escapeHtml(parsedAddress) },
      ],
      ctaLabel: "Review Ticket",
      ctaLink: reviewLink,
      note: "This ticket was created manually and needs processing.",
      theme: ALERT_THEMES.info,
    }),
  };
}

export function getSignReportAlertEmail(
    reportType: string,
    signNumber: string,
    description: string,
    reportedBy: string,
    newStatus: string,
    signLink: string
) {
    return {
        subject: `Sign Report: ${reportType} - ${signNumber}`,
        html: buildAlertEmail({
            title: "Sign Report Submitted",
            subtitle: "A sign issue was reported",
            intro: "A user reported an issue for a sign that may need immediate attention.",
            fields: [
                { label: "Sign Number", value: escapeHtml(signNumber) },
                { label: "Report Type", value: escapeHtml(reportType) },
                { label: "Reported By", value: escapeHtml(reportedBy) },
                { label: "Updated Status", value: escapeHtml(newStatus) },
            ],
            ctaLabel: "View Sign Details",
            ctaLink: signLink,
            note: `Description: ${escapeHtml(description)}`,
            theme: ALERT_THEMES.danger,
        }),
    };
}

export function getReorderRequestAlertEmail(
    requestType: string,
    requestedBy: string,
    quantity: number,
    itemOrType: string,
    printerName?: string,
    notes?: string
) {
    const fields: AlertField[] = [
        { label: "Request Type", value: escapeHtml(requestType) },
        { label: "Requested By", value: escapeHtml(requestedBy) },
        { label: "Quantity", value: String(quantity) },
        { label: "Item", value: escapeHtml(itemOrType) },
    ];

    if (printerName) {
        fields.push({ label: "Printer", value: escapeHtml(printerName) });
    }

    return {
        subject: `${requestType}: ${quantity} requested by ${requestedBy}`,
        html: buildAlertEmail({
            title: "Reorder Request Received",
            subtitle: "Inventory/sign fulfillment needed",
            intro: "A reorder request was submitted and is ready for admin processing.",
            fields,
            note: notes ? `Notes: ${escapeHtml(notes)}` : undefined,
            theme: ALERT_THEMES.info,
        }),
    };
}

export function getFieldJobIssueAlertEmail(
    fieldTechName: string,
    orderNumber: string,
    address: string,
    issue: string,
    orderStatus: string
) {
    return {
        subject: `Field Tech Issue Flagged - Order ${orderNumber}`,
        html: buildAlertEmail({
            title: "Field Job Issue Flagged",
            subtitle: "Immediate admin review recommended",
            intro: "A field technician reported an issue while working an assigned job.",
            fields: [
                { label: "Field Tech", value: escapeHtml(fieldTechName) },
                { label: "Order", value: escapeHtml(orderNumber) },
                { label: "Address", value: escapeHtml(address) },
                { label: "Status", value: escapeHtml(orderStatus) },
            ],
            note: `Issue details: ${escapeHtml(issue).replace(/\n/g, "<br>")}`,
            theme: ALERT_THEMES.warning,
        }),
    };
}

export function getLowInventoryAlertEmail(
    signType: string,
    availableCount: number,
    threshold: number
) {
    return {
        subject: `[LOW INVENTORY ALERT] ${signType} Signs Below Threshold`,
        html: buildAlertEmail({
            title: "Low Inventory Alert",
            subtitle: "Sign stock is below threshold",
            intro: "Inventory levels need replenishment to avoid assignment delays.",
            fields: [
                { label: "Sign Type", value: escapeHtml(signType) },
                { label: "Available", value: String(availableCount) },
                { label: "Threshold", value: String(threshold) },
            ],
            note: "Order additional stock for this sign type.",
            theme: ALERT_THEMES.danger,
        }),
    };
}



