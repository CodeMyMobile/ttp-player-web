import { useMemo, useReducer, useState } from "react";
import { CreditCard } from "lucide-react";
import { CardElement, Elements, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";

import {
  completeLeagueEnrollment,
  createLeaguePaymentIntent,
  type League,
  type LeagueEnrollmentResponse,
} from "../../api/leagues";
import type { PlayerStripePaymentMethod } from "../../api/playerStripe";
import {
  initialLeagueJoinPaymentState,
  leagueJoinPaymentReducer,
} from "./paymentState";

const stripePublishableKey =
  import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_STRIPE_PUBLIC_KEY ||
  import.meta.env.REACT_APP_STRIPE_PUBLISHABLE_KEY ||
  "";

const stripePromise = stripePublishableKey ? loadStripe(stripePublishableKey) : null;

export interface LeaguePaymentStepProps {
  league: League;
  token: string;
  agreement: {
    signedName: string;
    rulesVersion: string;
  };
  savedMethods?: PlayerStripePaymentMethod[];
  onBack: () => void;
  onSuccess: (response: LeagueEnrollmentResponse) => void;
  onLeagueFull: () => void;
}

const formatCost = (league: League) => {
  const cents = Number(league.cost_cents ?? 0);
  return Number.isFinite(cents) ? `$${(cents / 100).toFixed(0)}` : "$0";
};

const makeIdempotencyKey = (leagueId: number | string) =>
  `league-${leagueId}-${Date.now()}-${Math.random().toString(36).slice(2)}`;

const getErrorMessage = (error: unknown) => {
  const data = (error as { data?: { error?: string; detail?: string }; message?: string })?.data;
  return data?.detail || data?.error || (error as { message?: string })?.message || "Payment failed.";
};

const LeaguePaymentInner = ({
  league,
  token,
  agreement,
  savedMethods = [],
  onBack,
  onSuccess,
  onLeagueFull,
}: LeaguePaymentStepProps) => {
  const stripe = useStripe();
  const elements = useElements();
  const [state, dispatch] = useReducer(leagueJoinPaymentReducer, initialLeagueJoinPaymentState);
  const defaultMethod = useMemo(
    () => savedMethods.find((method) => method.is_default || method.default) ?? savedMethods[0],
    [savedMethods],
  );
  const [selectedMethodId, setSelectedMethodId] = useState(defaultMethod?.id ?? "new-card");
  const [cardReady, setCardReady] = useState(false);
  const isNewCard = selectedMethodId === "new-card";
  const busy = state.status === "authorizing" || state.status === "completing";

  const pay = async () => {
    if (!stripe || (isNewCard && !elements)) {
      dispatch({ type: "payment_failed", message: "Stripe is not ready yet." });
      return;
    }

    dispatch({ type: "authorize_started" });

    try {
      const paymentIntent = await createLeaguePaymentIntent({
        leagueId: league.id,
        idempotencyKey: makeIdempotencyKey(league.id),
        token,
      });

      const paymentMethod = isNewCard
        ? { card: elements?.getElement(CardElement) }
        : selectedMethodId;

      const confirmation = await stripe.confirmCardPayment(paymentIntent.client_secret, {
        payment_method: paymentMethod,
      });

      if (confirmation.error) {
        throw new Error(confirmation.error.message || "Payment authorization failed.");
      }

      const authorizedIntent = confirmation.paymentIntent;
      if (!authorizedIntent || authorizedIntent.status !== "requires_capture") {
        throw new Error("Payment was not authorized for capture.");
      }

      dispatch({
        type: "authorized",
        attemptId: paymentIntent.attempt_id,
        paymentIntentId: authorizedIntent.id,
      });

      const response = await completeLeagueEnrollment({
        leagueId: league.id,
        attemptId: paymentIntent.attempt_id,
        paymentIntentId: authorizedIntent.id,
        paymentIntentStatus: authorizedIntent.status,
        signedName: agreement.signedName,
        rulesVersion: agreement.rulesVersion,
        token,
      });

      dispatch({
        type: "completed",
        membershipId: response.membership?.id ?? null,
        seeded: Boolean(response.seeding?.seeded),
        startingRating: response.seeding?.starting_rating ?? null,
      });
      onSuccess(response);
    } catch (error) {
      const code = (error as { data?: { error?: string } })?.data?.error;
      if (code === "league_full_not_charged") {
        dispatch({ type: "league_full_not_charged" });
        onLeagueFull();
        return;
      }

      dispatch({
        type: "payment_failed",
        message: getErrorMessage(error),
      });
    }
  };

  return (
    <section className="league-join-step" aria-labelledby="league-payment-title">
      <div className="league-join-step__header">
        <CreditCard size={20} />
        <div>
          <p className="league-join-sheet__eyebrow">Step 2 of 2</p>
          <h2 id="league-payment-title">Payment</h2>
          <p>{league.name} · {formatCost(league)}</p>
        </div>
      </div>

      {savedMethods.length > 0 ? (
        <div className="league-join-payment-methods" role="radiogroup" aria-label="Payment method">
          {savedMethods.map((method) => (
            <label key={method.id} className={selectedMethodId === method.id ? "is-selected" : undefined}>
              <input
                type="radio"
                name="league-payment-method"
                checked={selectedMethodId === method.id}
                onChange={() => setSelectedMethodId(method.id)}
              />
              <span>{method.card?.brand || "Card"} ending {method.card?.last4 || "----"}</span>
            </label>
          ))}
          <label className={isNewCard ? "is-selected" : undefined}>
            <input
              type="radio"
              name="league-payment-method"
              checked={isNewCard}
              onChange={() => setSelectedMethodId("new-card")}
            />
            <span>Add credit or debit card</span>
          </label>
        </div>
      ) : null}

      {isNewCard ? (
        <div className="league-join-card-element">
          <CardElement onReady={() => setCardReady(true)} />
        </div>
      ) : null}

      {state.error ? (
        <p className="league-join-sheet__status league-join-sheet__status--error">
          {state.error}
        </p>
      ) : null}

      <div className="league-join-sheet__actions">
        <button type="button" className="league-join-sheet__secondary" disabled={busy} onClick={onBack}>
          Back
        </button>
        <button
          type="button"
          className="league-join-sheet__primary"
          disabled={busy || !stripe || (isNewCard && !cardReady)}
          onClick={() => void pay()}
        >
          {busy ? "Processing..." : `Pay ${formatCost(league)}`}
        </button>
      </div>
    </section>
  );
};

const LeaguePaymentStep = (props: LeaguePaymentStepProps) => {
  if (!stripePromise) {
    return (
      <section className="league-join-step">
        <p className="league-join-sheet__status league-join-sheet__status--error">
          Stripe is not configured.
        </p>
      </section>
    );
  }

  return (
    <Elements stripe={stripePromise} options={{ appearance: { theme: "stripe" } }}>
      <LeaguePaymentInner {...props} />
    </Elements>
  );
};

export default LeaguePaymentStep;
