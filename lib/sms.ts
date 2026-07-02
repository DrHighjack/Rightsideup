import twilio from "twilio";

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const apiKey = process.env.TWILIO_API_KEY;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

// Initialize Twilio client
// Use API Key authentication if available, otherwise fall back to Account SID
const client =
  apiKey && authToken && accountSid
    ? twilio(apiKey, authToken, { accountSid })
    : accountSid && authToken
    ? twilio(accountSid, authToken)
    : null;

export interface SMSOptions {
  to: string;
  message: string;
}

export async function sendSMS(options: SMSOptions) {
  try {
    if (!client || !fromPhoneNumber) {
      throw new Error(
        "Twilio credentials not configured. Please set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER in .env.local"
      );
    }

    const { to, message } = options;

    const result = await client.messages.create({
      body: message,
      from: fromPhoneNumber,
      to,
    });

    console.log(`SMS sent to ${to}: ${result.sid}`);
    return { success: true, sid: result.sid };
  } catch (error) {
    console.error("Twilio SMS error:", error);
    throw error;
  }
}

// Password reset SMS template
export function getPasswordResetSMS(
  firstName: string,
  resetLink: string
): string {
  return `Hi ${firstName}, reset your password here: ${resetLink} (expires in 24h)`;
}

// Welcome SMS template
export function getWelcomeSMS(firstName: string, appUrl: string): string {
  return `Welcome to North Shore Sign Co, ${firstName}! Login here: ${appUrl}/login - Change your temp password immediately.`;
}

// Generic notification SMS
export function getNotificationSMS(message: string): string {
  return message;
}

// Two-factor authentication SMS
export function get2FASMS(code: string): string {
  return `Your North Shore Sign Co verification code is: ${code}. Do not share this code.`;
}
