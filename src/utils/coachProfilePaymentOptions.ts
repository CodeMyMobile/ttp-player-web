export type CoachProfilePaymentChoice = "credits" | "card" | "wallet" | "pay-on-court";

export type CoachProfilePaymentOption = {
  value: CoachProfilePaymentChoice;
  enabled: boolean;
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
