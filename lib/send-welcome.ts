import { sendEmail, getWelcomeEmailWithMagicLink } from "@/lib/email";
import { generateLoginToken } from "@/lib/magic-login";

/**
 * Send welcome email with direct login link
 * Usage: Call this when creating a new user account
 */
export async function sendWelcomeEmailWithMagicLink(
  userId: string,
  firstName: string,
  email: string,
  tempPassword: string,
  options?: {
    appUrl?: string;
    supportUrl?: string;
    privacyUrl?: string;
    termsUrl?: string;
  }
) {
  try {
    const appUrl = options?.appUrl || process.env.NEXT_PUBLIC_APP_URL || "https://app.northshoresignco.com";
    
    // Generate magic login token
    const loginToken = await generateLoginToken(userId);
    const loginLink = `${appUrl}/api/auth/magic-login?token=${loginToken}&redirect=/dashboard`;

    // Send email
    const emailTemplate = getWelcomeEmailWithMagicLink(
      firstName,
      email,
      tempPassword,
      loginLink,
      options?.supportUrl,
      options?.privacyUrl,
      options?.termsUrl
    );

    await sendEmail({
      to: email,
      subject: emailTemplate.subject,
      html: emailTemplate.html,
    });

    console.log(`Welcome email sent to ${email} with magic login link`);
    return { success: true, loginLink };
  } catch (error) {
    console.error("Failed to send welcome email:", error);
    throw error;
  }
}

/**
 * Example usage in your lead conversion endpoint:
 * 
 * import { sendWelcomeEmailWithMagicLink } from "@/lib/send-welcome";
 * 
 * // After creating the user:
 * const newUser = await prisma.user.create({
 *   data: {
 *     firstName,
 *     lastName,
 *     email,
 *     passwordHash: hashedPassword,
 *     role,
 *   },
 * });
 * 
 * // Send welcome email with direct login link
 * await sendWelcomeEmailWithMagicLink(
 *   newUser.id,
 *   firstName,
 *   email,
 *   tempPassword,
 *   { appUrl: process.env.NEXT_PUBLIC_APP_URL }
 * );
 */
