// Single source of truth for the SMS-consent disclosure.
//
// ⚠️ PLACEHOLDER COPY — not final. Final wording comes from legal + the SMS provider
// (A2P 10DLC registration has specific requirements). Change SMS_DISCLOSURE_TEXT and bump
// SMS_DISCLOSURE_VERSION here, in ONE place — every consent record and the checkbox label
// shown to the user both read from these constants, so what the user agreed to always
// matches what we persist.
//
// Keep the required consent strictly TRANSACTIONAL (match invites, lesson reminders,
// account updates). Do NOT add marketing/promotional language to this required disclosure —
// that would make the required opt-in legally problematic. Marketing texts, if ever wanted,
// need a SEPARATE optional opt-in.
export const SMS_DISCLOSURE_VERSION = "v2";

export const SMS_DISCLOSURE_TEXT =
  "I agree to receive account & match texts from The Tennis Plan — match invites, lesson " +
  "reminders, and account updates. Msg frequency varies; msg & data rates may apply. " +
  "Reply STOP to opt out, HELP for help.";

// The consent record we persist. Includes the boolean, the exact disclosure version + text
// the user saw, the capture method, and the timestamp — so the agreement is auditable.
export const buildSmsConsentPayload = (method = "signup_checkbox") => ({
  granted: true,
  disclosureVersion: SMS_DISCLOSURE_VERSION,
  disclosureText: SMS_DISCLOSURE_TEXT,
  method,
  grantedAt: new Date().toISOString(),
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

export const resolveSmsConsentGranted = (record) => {
  if (!record || typeof record !== "object") return false;

  if (record.smsConsentGranted === true || record.sms_consent_granted === true) {
    return true;
  }

  const consent = record.smsConsent || record.sms_consent || record.sms_consent_record;
  return Boolean(consent && typeof consent === "object" && consent.granted === true);
};
