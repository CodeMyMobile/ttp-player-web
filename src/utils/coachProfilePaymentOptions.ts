export type CoachProfilePaymentChoice = "credits" | "card" | "wallet" | "pay-on-court";

export type CoachProfilePaymentOption = {
  value: CoachProfilePaymentChoice;
  enabled: boolean;
};

const readBooleanFlag = (value: unknown): boolean => value === true || value === "true" || value === 1 || value === "1";

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

export const getCoachProfilePaymentOptions = ({
  availableCredits,
  applePayReady,
  coachAllowsPayOnCourt,
}: {
  availableCredits: number;
  applePayReady: boolean;
  coachAllowsPayOnCourt: boolean;
}): CoachProfilePaymentOption[] => [
  { value: "credits", enabled: availableCredits > 0 },
  { value: "pay-on-court", enabled: coachAllowsPayOnCourt },
  { value: "wallet", enabled: applePayReady },
  { value: "card", enabled: true },
];

export const getDefaultCoachProfilePaymentChoice = (coachAllowsPayOnCourt: boolean): CoachProfilePaymentChoice =>
  coachAllowsPayOnCourt ? "pay-on-court" : "card";
