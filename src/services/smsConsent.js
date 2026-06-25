export const SMS_DISCLOSURE_VERSION = "v1";

export const SMS_DISCLOSURE_TEXT =
  "I agree to receive SMS messages from The Tennis Plan about match confirmations, reminders, invites, and account updates. Message and data rates may apply. Reply STOP to opt out.";

export const buildSmsConsentPayload = (method = "signup_checkbox") => ({
  granted: true,
  disclosureVersion: SMS_DISCLOSURE_VERSION,
  disclosureText: SMS_DISCLOSURE_TEXT,
  method,
});

export const withSmsConsent = (payload, granted, method = "signup_checkbox") => {
  if (!granted) {
    return payload;
  }

  return {
    ...payload,
    smsConsent: buildSmsConsentPayload(method),
  };
};
