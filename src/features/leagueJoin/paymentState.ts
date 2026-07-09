export type LeagueJoinStep = "browse" | "review" | "agreement" | "payment" | "success";
export type LeagueJoinPaymentStatus =
  | "idle"
  | "authorizing"
  | "completing"
  | "complete"
  | "error";

export interface LeagueJoinPaymentState {
  step: LeagueJoinStep;
  status: LeagueJoinPaymentStatus;
  attemptId: string | null;
  paymentIntentId: string | null;
  membershipId: number | string | null;
  seeded: boolean;
  startingRating: number | string | null;
  error: string | null;
}

export type LeagueJoinPaymentAction =
  | { type: "authorize_started" }
  | { type: "authorized"; attemptId: string; paymentIntentId: string }
  | {
      type: "completed";
      membershipId: number | string | null;
      seeded?: boolean;
      startingRating?: number | string | null;
    }
  | { type: "payment_failed"; message: string }
  | { type: "league_full_not_charged" }
  | { type: "reset" };

export const initialLeagueJoinPaymentState: LeagueJoinPaymentState = {
  step: "payment",
  status: "idle",
  attemptId: null,
  paymentIntentId: null,
  membershipId: null,
  seeded: false,
  startingRating: null,
  error: null,
};

export const getAgreementNudges = ({
  signedName,
  agreed,
}: {
  signedName: string;
  agreed: boolean;
}) => ({
  signedName: signedName.trim().length === 0,
  agreed: !agreed,
});

export const getJoinSuccessCopy = ({
  seeded,
  startingRating,
}: {
  seeded: boolean;
  startingRating?: number | string | null;
}) => {
  if (seeded && startingRating != null) {
    return `You're in. Your starting rating is ${startingRating}.`;
  }

  return "You're in. We'll keep using your existing rating for this league.";
};

export const leagueJoinPaymentReducer = (
  state: LeagueJoinPaymentState,
  action: LeagueJoinPaymentAction,
): LeagueJoinPaymentState => {
  switch (action.type) {
    case "authorize_started":
      return {
        ...state,
        step: "payment",
        status: "authorizing",
        error: null,
      };
    case "authorized":
      return {
        ...state,
        status: "completing",
        attemptId: action.attemptId,
        paymentIntentId: action.paymentIntentId,
        error: null,
      };
    case "completed":
      return {
        ...state,
        step: "success",
        status: "complete",
        membershipId: action.membershipId,
        seeded: Boolean(action.seeded),
        startingRating: action.startingRating ?? null,
        error: null,
      };
    case "payment_failed":
      return {
        ...state,
        step: "payment",
        status: "error",
        error: action.message,
      };
    case "league_full_not_charged":
      return {
        ...initialLeagueJoinPaymentState,
        step: "browse",
        status: "error",
        error: "This league just filled - you were not charged.",
      };
    case "reset":
      return initialLeagueJoinPaymentState;
    default:
      return state;
  }
};
