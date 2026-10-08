export const SMS_CONSENT_TAG = "SMS_OPT_IN";
export const SMS_CONSENT_VERSION = "2026-10-07";
export const SMS_PRIVACY_SHARING_DISCLOSURE = "Mobile information will not be shared with third parties or affiliates for marketing or promotional purposes. All the above categories exclude text messaging originator opt-in data and consent; this information will not be shared with any third parties.";
export const SMS_PRIVACY_PROCESSOR_DISCLOSURE = "Our SMS delivery provider may process mobile numbers and message delivery details solely to transmit the messages you request and may not use that information for its own marketing or promotional purposes.";
export const SMS_CONSENT_DISCLOSURE = "I agree to receive automated transactional text messages from North Shore Sign Co at the phone number provided about my orders, installation and removal scheduling, and account service updates. Message frequency varies. Message and data rates may apply. Reply STOP to opt out or HELP for help. Consent is optional and is not a condition of purchase.";
export const LISTING_SMS_CONSENT_DISCLOSURE = "I agree to receive transactional text messages from North Shore Sign Co about this property's listing status and my requested updates at the phone number provided. Message frequency varies. Message and data rates may apply. Reply STOP to opt out or HELP for help. Consent is not a condition of purchase.";

export function buildListingSmsConsentMessage(phone: string) {
  return JSON.stringify({
    smsConsent: {
      phone,
      consentedAt: new Date().toISOString(),
      source: "smart-sign-listing-update-request",
      disclosureVersion: SMS_CONSENT_VERSION,
      disclosure: LISTING_SMS_CONSENT_DISCLOSURE,
    },
  });
}

export function buildSmsConsentData(phone: string | undefined, optedIn: boolean) {
  if (!optedIn || !phone) return {};
  return {
    tags: [SMS_CONSENT_TAG],
    activityLogs: {
      create: {
        action: "USER_UPDATED" as const,
        entityType: "SMSConsent",
        entityId: phone,
        description: "Customer opted in to transactional SMS notifications during registration.",
        metadata: {
          phone,
          consentedAt: new Date().toISOString(),
          source: "/register",
          disclosureVersion: SMS_CONSENT_VERSION,
          disclosure: SMS_CONSENT_DISCLOSURE,
        },
      },
    },
  };
}