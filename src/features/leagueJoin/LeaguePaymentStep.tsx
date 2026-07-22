import { useEffect, useMemo, useReducer, useState } from "react";
import { CreditCard } from "lucide-react";
import { CardElement, Elements, useElements, useStripe } from "@stripe/react-stripe-js";
import {
  loadStripe,
  type PaymentRequest as StripePaymentRequest,
  type PaymentRequestPaymentMethodEvent,
} from "@stripe/stripe-js";

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
  if (!Number.isFinite(cents)) return "$0";
  const dollars = cents / 100;
  // Match the browse/detail formatters: whole dollars as-is, otherwise 2 decimals
  // (so $59.99 isn't rounded up to $60).
  return `$${Number.isInteger(dollars) ? dollars : dollars.toFixed(2)}`;
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

  const amountCents = Math.max(0, Math.round(Number(league.cost_cents ?? 0)));
  const [applePayRequest, setApplePayRequest] = useState<StripePaymentRequest | null>(null);
  const [isApplePayReady, setIsApplePayReady] = useState(false);

  // Probe Apple Pay availability for this amount. Only wallets the device actually
  // supports (Safari + a card in Wallet, on a Stripe-verified domain) flip this on.
  useEffect(() => {
    if (!stripe || !amountCents) {
      setApplePayRequest(null);
      setIsApplePayReady(false);
      return;
    }
    let cancelled = false;
    const request = stripe.paymentRequest({
      country: "US",
      currency: "usd",
      total: { label: league.name || "League entry", amount: amountCents },
      requestPayerName: true,
      requestPayerEmail: true,
    });
    request
      .canMakePayment()
      .then((canPay) => {
        if (cancelled) return;
        setApplePayRequest(canPay?.applePay ? request : null);
        setIsApplePayReady(Boolean(canPay?.applePay));
      })
      .catch(() => {
        if (cancelled) return;
        setApplePayRequest(null);
        setIsApplePayReady(false);
      });
    return () => {
      cancelled = true;
    };
  }, [stripe, amountCents, league.name]);

  // Shared authorize→complete tail: once a payment intent is authorized (manual
  // capture → requires_capture), confirm enrollment. Used by both card and Apple Pay.
  const completeEnrollment = async (
    authorizedIntent: { id: string; status: string },
    attemptId: string,
  ) => {
    dispatch({
      type: "authorized",
      attemptId,
      paymentIntentId: authorizedIntent.id,
    });

    const response = await completeLeagueEnrollment({
      leagueId: league.id,
      attemptId,
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
  };

  const handlePayError = (error: unknown) => {
    const code = (error as { data?: { error?: string } })?.data?.error;
    if (code === "league_full_not_charged") {
      // Show the amber "you weren't charged" state in-modal; the host's onLeagueFull runs
      // when the user taps Back to browse (no immediate close).
      dispatch({ type: "league_full_not_charged" });
      return;
    }

    dispatch({
      type: "payment_failed",
      message: getErrorMessage(error),
    });
  };

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

      await completeEnrollment(authorizedIntent, paymentIntent.attempt_id);
    } catch (error) {
      handlePayError(error);
    }
  };

  // Apple Pay express checkout — same authorize-then-complete (manual capture) flow as
  // the card path, but the payment method comes from the Apple Pay sheet. Only reachable
  // when the device reports Apple Pay is available (see the effect above).
  const payWithApplePay = async () => {
    if (!stripe || !applePayRequest) {
      dispatch({ type: "payment_failed", message: "Apple Pay is not ready yet." });
      return;
    }

    dispatch({ type: "authorize_started" });

    try {
      const paymentIntent = await createLeaguePaymentIntent({
        leagueId: league.id,
        idempotencyKey: makeIdempotencyKey(league.id),
        token,
      });

      const event = await new Promise<PaymentRequestPaymentMethodEvent>((resolve, reject) => {
        const onPaymentMethod = (ev: PaymentRequestPaymentMethodEvent) => {
          applePayRequest.off("cancel", onCancel);
          resolve(ev);
        };
        const onCancel = () => {
          applePayRequest.off("paymentmethod", onPaymentMethod);
          reject(new Error("__apple_pay_cancelled__"));
        };
        applePayRequest.once("paymentmethod", onPaymentMethod);
        applePayRequest.once("cancel", onCancel);
        try {
          applePayRequest.show();
        } catch (err) {
          applePayRequest.off("paymentmethod", onPaymentMethod);
          applePayRequest.off("cancel", onCancel);
          reject(err);
        }
      });

      const { error, paymentIntent: authorizedIntent } = await stripe.confirmCardPayment(
        paymentIntent.client_secret,
        { payment_method: event.paymentMethod.id },
        { handleActions: false },
      );

      if (error) {
        event.complete("fail");
        throw new Error(error.message || "Payment authorization failed.");
      }
      event.complete("success");

      if (!authorizedIntent || authorizedIntent.status !== "requires_capture") {
        throw new Error("Payment was not authorized for capture.");
      }

      await completeEnrollment(authorizedIntent, paymentIntent.attempt_id);
    } catch (error) {
      if ((error as { message?: string })?.message === "__apple_pay_cancelled__") {
        // User dismissed the Apple Pay sheet — quietly return to the form.
        dispatch({ type: "reset" });
        return;
      }
      handlePayError(error);
    }
  };

  return (
    <section className="league-join-step" aria-labelledby="league-payment-title">
      <div className="league-join-step__header">
        <CreditCard size={20} />
        <div>
          <h2 id="league-payment-title">Pay {formatCost(league)} to lock your spot</h2>
          <p>{league.name} · {formatCost(league)}</p>
        </div>
      </div>

      {state.step === "browse" ? (
        <div className="ljr-full-state" role="alert">
          <span className="ljr-full-state__ic" aria-hidden="true">⚠️</span>
          <p className="ljr-full-state__title">The league filled before your payment completed</p>
          <p className="ljr-full-state__body">
            You haven&apos;t been charged — the hold was released. New seasons open all the time; browse
            other leagues that still have room.
          </p>
          <button type="button" className="league-join-sheet__primary" onClick={onLeagueFull}>
            Back to browse
          </button>
        </div>
      ) : (
        <>
          {isApplePayReady ? (
            <>
              {/* No text children — the native Apple Pay button draws its own
                  logo; a stray glyph here would paint over it. Fallback label is
                  a CSS ::before, shown only where the native button is unsupported. */}
              <button
                type="button"
                className="league-join-applepay"
                disabled={busy}
                onClick={() => void payWithApplePay()}
                aria-label={`Pay ${formatCost(league)} with Apple Pay`}
              />
              <div className="league-join-or"><span>or pay with card</span></div>
            </>
          ) : null}

          {savedMethods.length > 0 ? (
            <div className="league-join-payment-methods" role="radiogroup" aria-label="Payment method">
              {savedMethods.map((method) => {
                const exp =
                  method.card?.exp_month && method.card?.exp_year
                    ? `Expires ${String(method.card.exp_month).padStart(2, "0")}/${String(method.card.exp_year).slice(-2)}`
                    : null;
                return (
                  <label key={method.id} className={selectedMethodId === method.id ? "is-selected" : undefined}>
                    <input
                      type="radio"
                      name="league-payment-method"
                      checked={selectedMethodId === method.id}
                      onChange={() => setSelectedMethodId(method.id)}
                    />
                    <span>{method.card?.brand || "Card"} ····{method.card?.last4 || "----"}</span>
                    {exp ? <span className="league-join-payment-methods__exp">{exp}</span> : null}
                  </label>
                );
              })}
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

          <div className="ljr-hold-note">
            <span className="ljr-hold-note__ic" aria-hidden="true">🛡</span>
            <span>
              We place a hold now and only charge you once your spot is confirmed. If the league fills
              first, the hold is released — you pay nothing.
            </span>
          </div>

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
        </>
      )}
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
