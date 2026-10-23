export type CoachProfilePaymentChoice = "credits" | "card" | "wallet" | "pay-on-court";

export type CoachProfilePaymentOption = {
  value: CoachProfilePaymentChoice;
  enabled: boolean;
};

const readBooleanFlag = (value: unknown): boolean => value === true || value === "true" || value === 1 || value === "1";
const readOptionalBooleanFlag = (value: unknown): boolean | undefined => {
  if (value === undefined || value === null) return undefined;
  return readBooleanFlag(value);
};
const readString = (value: unknown): string | undefined => (typeof value === "string" ? value.trim() : undefined);

export const resolveCoachAllowsPayOnCourt = (profile: unknown): boolean => {
  if (!profile || typeof profile !== "object") return false;
  const record = profile as Record<string, unknown>;
  if (readBooleanFlag(record.allow_pay_on_court) || readBooleanFlag(record.allowPayOnCourt)) {
    return true;
  }
  const payment = record.payment;
  if (payment && typeof payment === "object") {
    const paymentRecord = payment as Record<string, unknown>;
    return readBooleanFlag(paymentRecord.allow_pay_on_court) || readBooleanFlag(paymentRecord.allowPayOnCourt);
  }
  return false;
};

export const resolveCoachCanAcceptCards = (profile: unknown): boolean => {
  if (!profile || typeof profile !== "object") return true;
  const record = profile as Record<string, unknown>;
  const payment = record.payment;
  const paymentRecord = payment && typeof payment === "object" ? (payment as Record<string, unknown>) : undefined;
  const stripeAccountId =
    readString(record.stripe_account_id) ??
    readString(record.stripeAccountId) ??
    readString(paymentRecord?.stripe_account_id) ??
    readString(paymentRecord?.stripeAccountId);
  const chargesEnabled =
    readOptionalBooleanFlag(record.charges_enabled) ??
    readOptionalBooleanFlag(record.chargesEnabled) ??
    readOptionalBooleanFlag(paymentRecord?.charges_enabled) ??
    readOptionalBooleanFlag(paymentRecord?.chargesEnabled);

  if (stripeAccountId === undefined && chargesEnabled === undefined) return true;
  return Boolean(stripeAccountId) && chargesEnabled === true;
};

export const getCoachProfilePaymentOptions = ({
  availableCredits,
  applePayReady,
  coachAllowsPayOnCourt,
  coachCanAcceptCards = true,
}: {
  availableCredits: number;
  applePayReady: boolean;
  coachAllowsPayOnCourt: boolean;
  coachCanAcceptCards?: boolean;
}): CoachProfilePaymentOption[] => [
  { value: "credits", enabled: availableCredits > 0 },
  { value: "pay-on-court", enabled: coachAllowsPayOnCourt },
  { value: "wallet", enabled: applePayReady && coachCanAcceptCards },
  { value: "card", enabled: coachCanAcceptCards },
];

export const getDefaultCoachProfilePaymentChoice = (
  coachAllowsPayOnCourt: boolean,
  coachCanAcceptCards = true,
): CoachProfilePaymentChoice => {
  if (coachAllowsPayOnCourt) return "pay-on-court";
  return coachCanAcceptCards ? "card" : "credits";
};
