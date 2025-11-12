import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { CardElement, Elements, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import type { StripeCardElement, StripeCardElementChangeEvent } from "@stripe/stripe-js";
import { AlertCircle, CreditCard, Loader2, Plus, ShieldCheck, Wallet } from "lucide-react";

import MainLayout from "../components/MainLayout";
import {
  detachPlayerPaymentMethod,
  getPlayerStripePaymentMethods,
  getPlayerStripeSetupIntent,
  setPlayerDefaultPaymentMethod,
  type PlayerStripePaymentMethod,
  type PlayerStripePaymentMethodListResponse,
} from "../api/playerStripe";
import { getStoredAuthToken } from "../services/authToken";

import "./PlayerSettingsPages.css";

type NormalizedPaymentMethod = {
  id: string;
  brand: string;
  last4: string;
  expMonth?: number;
  expYear?: number;
  isDefault: boolean;
};

const stripePublishableKey =
  import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ??
  import.meta.env.VITE_STRIPE_PUBLISHABLEKEY ??
  "";

const stripePromise = stripePublishableKey ? loadStripe(stripePublishableKey) : null;

const getBrandClassName = (brand: string) => {
  const key = brand.toLowerCase();
  if (key === "visa") return "payment-card__brand payment-card__brand--visa";
  if (key === "amex" || key === "american express") return "payment-card__brand payment-card__brand--amex";
  if (key === "mastercard") return "payment-card__brand payment-card__brand--mastercard";
  if (key === "discover") return "payment-card__brand payment-card__brand--discover";
  return "payment-card__brand payment-card__brand--default";
};

const formatExpiry = (month?: number, year?: number) => {
  if (!month || !year) return "Unknown";
  const monthString = month < 10 ? `0${month}` : `${month}`;
  const yearString = `${year}`.slice(-2);
  return `${monthString}/${yearString}`;
};

const normalizeBrand = (brand?: string) => {
  if (!brand) return "Card";
  const normalized = brand.trim();
  if (!normalized) return "Card";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

const resolveDefaultId = (payload: PlayerStripePaymentMethodListResponse | PlayerStripePaymentMethod[] | null | undefined) => {
  if (!payload || Array.isArray(payload)) {
    return undefined;
  }
  return (
    payload.default_payment_method_id ||
    payload.default_payment_method ||
    (typeof payload["defaultPaymentMethodId"] === "string" ? (payload as Record<string, string>)["defaultPaymentMethodId"] : undefined)
  );
};

const extractPaymentMethods = (
  payload: PlayerStripePaymentMethodListResponse | PlayerStripePaymentMethod[] | null | undefined,
): PlayerStripePaymentMethod[] => {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.payment_methods)) return payload.payment_methods;
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.results)) return payload.results;
  if (Array.isArray((payload as { paymentMethods?: PlayerStripePaymentMethod[] }).paymentMethods)) {
    return (payload as { paymentMethods?: PlayerStripePaymentMethod[] }).paymentMethods ?? [];
  }
  return [];
};

const toNormalizedPaymentMethod = (method: PlayerStripePaymentMethod, defaultId?: string): NormalizedPaymentMethod => {
  const card = method.card ?? (method as unknown as { card: PlayerStripePaymentMethod["card"] }).card;
  const expMonth = card?.exp_month ?? (method as unknown as { exp_month?: number }).exp_month;
  const expYear = card?.exp_year ?? (method as unknown as { exp_year?: number }).exp_year;
  const last4 = card?.last4 ?? (method as unknown as { last4?: string }).last4 ?? "";
  const brand = normalizeBrand(card?.brand ?? (method as unknown as { brand?: string }).brand);
  const isDefaultExplicit = Boolean(method.is_default ?? method.default ?? method.default_for_currency);
  const isDefault = isDefaultExplicit || (defaultId ? method.id === defaultId : false);

  return {
    id: method.id,
    brand,
    last4,
    expMonth,
    expYear,
    isDefault,
  };
};

const PaymentMethodsPage = () => {
  const [methods, setMethods] = useState<NormalizedPaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [setupIntentClientSecret, setSetupIntentClientSecret] = useState<string | null>(null);
  const [setupIntentLoading, setSetupIntentLoading] = useState(false);
  const [setupIntentError, setSetupIntentError] = useState<string | null>(null);
  const stripeEnabled = Boolean(stripePromise);

  const fetchPaymentMethods = useCallback(async () => {
    const authToken = getStoredAuthToken({ preferScheme: "token" });
    if (!authToken) {
      setError("You need to be signed in to manage payment methods.");
      setMethods([]);
      setLoading(false);
      return;
    }

    setError(null);
    setRefreshing(true);
    try {
      const payload = await getPlayerStripePaymentMethods(authToken as string);
      const defaultId = resolveDefaultId(payload);
      const normalized = extractPaymentMethods(payload).map((method) => toNormalizedPaymentMethod(method, defaultId));
      setMethods(normalized);
      setActionError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to load payment methods.";
      setError(message);
      setMethods([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const refreshSetupIntent = useCallback(async () => {
    if (!stripeEnabled) {
      setSetupIntentClientSecret(null);
      setSetupIntentError(null);
      setSetupIntentLoading(false);
      return;
    }

    const authToken = getStoredAuthToken({ preferScheme: "token" });
    if (!authToken) {
      setSetupIntentClientSecret(null);
      setSetupIntentError("You need to be signed in to add a payment method.");
      setSetupIntentLoading(false);
      return;
    }

    setSetupIntentLoading(true);
    setSetupIntentError(null);
    setSetupIntentClientSecret(null);

    try {
      const { client_secret: clientSecret } = await getPlayerStripeSetupIntent(authToken as string);
      if (!clientSecret) {
        throw new Error("Missing Stripe setup intent. Please try again.");
      }
      setSetupIntentClientSecret(clientSecret);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to start a secure card session.";
      setSetupIntentClientSecret(null);
      setSetupIntentError(message);
    } finally {
      setSetupIntentLoading(false);
    }
  }, [stripeEnabled]);

  useEffect(() => {
    void fetchPaymentMethods();
  }, [fetchPaymentMethods]);

  useEffect(() => {
    if (!stripeEnabled) {
      return;
    }
    void refreshSetupIntent();
  }, [refreshSetupIntent, stripeEnabled]);

  const defaultMethod = useMemo(() => methods.find((method) => method.isDefault) ?? null, [methods]);

  const handleCardAdded = useCallback(async () => {
    await fetchPaymentMethods();
    await refreshSetupIntent();
  }, [fetchPaymentMethods, refreshSetupIntent]);

  const handleSetDefault = useCallback(
    async (id: string) => {
      const authToken = getStoredAuthToken({ preferScheme: "token" });
      if (!authToken) {
        setActionError("Missing player session. Please sign in again.");
        return;
      }

      setPendingActionId(id);
      setActionError(null);
      try {
        await setPlayerDefaultPaymentMethod(authToken as string, id);
        await fetchPaymentMethods();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to update default payment method.";
        setActionError(message);
      } finally {
        setPendingActionId(null);
      }
    },
    [fetchPaymentMethods],
  );

  const handleRemove = useCallback(
    async (id: string) => {
      const authToken = getStoredAuthToken({ preferScheme: "token" });
      if (!authToken) {
        setActionError("Missing player session. Please sign in again.");
        return;
      }

      setPendingActionId(id);
      setActionError(null);
      try {
        await detachPlayerPaymentMethod(authToken as string, id);
        await fetchPaymentMethods();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to remove payment method.";
        setActionError(message);
      } finally {
        setPendingActionId(null);
      }
    },
    [fetchPaymentMethods],
  );

  const renderPaymentMethods = () => {
    if (loading) {
      return (
        <div className="payment-methods__empty" role="status" aria-live="polite">
          <Loader2 className="payment-methods__icon payment-methods__icon--spinner" aria-hidden />
          <h2 className="settings-card__title">Loading payment methods…</h2>
          <p className="settings-card__subtitle">We&apos;re securely retrieving your saved cards.</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="payment-methods__empty" role="alert">
          <AlertCircle className="payment-methods__icon payment-methods__icon--error" aria-hidden />
          <h2 className="settings-card__title">Unable to load payment methods</h2>
          <p className="settings-card__subtitle">{error}</p>
          <button type="button" className="payment-methods__cta" onClick={() => void fetchPaymentMethods()} disabled={refreshing}>
            {refreshing ? <Loader2 className="payment-methods__icon payment-methods__icon--spinner" aria-hidden /> : <Plus size={16} aria-hidden />}
            Try again
          </button>
        </div>
      );
    }

    if (methods.length === 0) {
      return (
        <div className="payment-methods__empty">
          <CreditCard className="payment-methods__icon" aria-hidden="true" />
          <h2 className="settings-card__title">No saved payment methods</h2>
          <p className="settings-card__subtitle">
            Add a card to book courts and reserve coaching sessions faster.
          </p>
        </div>
      );
    }

    return (
      <div className="payment-methods__list">
        {methods.map((method) => (
          <article key={method.id} className="payment-card">
            <div className={getBrandClassName(method.brand)}>
              <span>{method.brand}</span>
              <span>•••• {method.last4}</span>
            </div>
            <div className="payment-card__meta">
              <span>Expires {formatExpiry(method.expMonth, method.expYear)}</span>
              <div className="payment-card__actions">
                <button
                  type="button"
                  onClick={() => void handleSetDefault(method.id)}
                  className={`payment-card__button ${
                    method.isDefault ? "payment-card__button--default" : "payment-card__button--set-default"
                  }`}
                  disabled={method.isDefault || pendingActionId === method.id}
                >
                  {method.isDefault ? "Default" : pendingActionId === method.id ? "Saving…" : "Set default"}
                </button>
                <button
                  type="button"
                  onClick={() => void handleRemove(method.id)}
                  className="payment-card__button payment-card__button--remove"
                  disabled={pendingActionId === method.id}
                >
                  {pendingActionId === method.id ? "Removing…" : "Remove"}
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    );
  };

  return (
    <MainLayout>
      <div className="settings-page">
        <div className="settings-page__inner">
          <header className="settings-hero settings-hero--billing">
            <span className="settings-hero__badge">
              <Wallet size={16} aria-hidden="true" />
              Billing center
            </span>
            <h1 className="settings-hero__title">Payment methods</h1>
            <p className="settings-hero__subtitle">
              Securely manage the cards you use for lessons, match fees, and marketplace purchases.
            </p>
          </header>

          {defaultMethod ? (
            <div className="payment-default-card">
              <span className="payment-default-card__label">Default card</span>
              <p className="payment-default-card__brand">
                {defaultMethod.brand} ending in {defaultMethod.last4}
              </p>
              <p className="payment-default-card__meta">Expires {formatExpiry(defaultMethod.expMonth, defaultMethod.expYear)}</p>
              <span className="payment-default-card__security">
                <ShieldCheck size={14} aria-hidden="true" />
                Encrypted payments
              </span>
            </div>
          ) : null}

          {actionError ? (
            <div className="payment-methods__alert" role="alert">
              <AlertCircle aria-hidden />
              <span>{actionError}</span>
            </div>
          ) : null}

          <section className="settings-section">
            <div className="billing-grid">
              <div className="payment-methods">{renderPaymentMethods()}</div>

              <aside className="settings-card">
                <h2 className="settings-card__title">Add a payment method</h2>
                <p className="settings-card__subtitle">
                  We support major credit and debit cards. You can safely store more than one method.
                </p>
                {stripeEnabled ? (
                  setupIntentError ? (
                    <div className="payment-form__status payment-form__status--error payment-form__status--stacked" role="alert">
                      <span>{setupIntentError}</span>
                      <button
                        type="button"
                        className="payment-methods__cta"
                        onClick={() => void refreshSetupIntent()}
                        disabled={setupIntentLoading}
                      >
                        {setupIntentLoading ? (
                          <>
                            <Loader2 className="payment-form__spinner" aria-hidden />
                            Retrying…
                          </>
                        ) : (
                          <>
                            <Plus size={16} aria-hidden />
                            Try again
                          </>
                        )}
                      </button>
                    </div>
                  ) : setupIntentLoading && !setupIntentClientSecret ? (
                    <div className="payment-form__status payment-form__status--inline" role="status">
                      <Loader2 className="payment-form__spinner" aria-hidden />
                      Preparing secure payment form…
                    </div>
                  ) : setupIntentClientSecret ? (
                    <Elements
                      stripe={stripePromise}
                      options={{ appearance: { theme: "stripe" } }}
                      key={setupIntentClientSecret}
                    >
                      <AddCardForm clientSecret={setupIntentClientSecret} onCardAdded={handleCardAdded} />
                    </Elements>
                  ) : null
                ) : (
                  <div className="payment-form__status payment-form__status--error" role="alert">
                    <AlertCircle aria-hidden />
                    <span>
                      Stripe isn&apos;t configured. Set <code>VITE_STRIPE_PUBLISHABLE_KEY</code> in your environment to enable card
                      payments.
                    </span>
                  </div>
                )}
                <p className="payment-form__note">
                  We use encrypted vault storage and never share your payment details with other players or coaches.
                </p>
              </aside>
            </div>
          </section>
        </div>
      </div>
    </MainLayout>
  );
};

interface AddCardFormProps {
  clientSecret: string;
  onCardAdded: () => void | Promise<void>;
}

const AddCardForm = ({ clientSecret, onCardAdded }: AddCardFormProps) => {
  const stripe = useStripe();
  const elements = useElements();
  const [cardholderName, setCardholderName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<"success" | "error" | null>(null);
  const [cardError, setCardError] = useState<string | null>(null);
  const [cardElementLoaded, setCardElementLoaded] = useState(false);
  const [cardComplete, setCardComplete] = useState(false);

  const handleCardChange = (event: StripeCardElementChangeEvent) => {
    setCardComplete(event.complete);
    if (event.error) {
      setCardError(event.error.message ?? "Invalid card details. Check and try again.");
    } else {
      setCardError(null);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!stripe || !elements) {
      setStatusTone("error");
      setStatusMessage("Stripe is still loading. Please try again.");
      return;
    }

    if (!cardElementLoaded) {
      setStatusTone("error");
      setStatusMessage("Stripe secure fields are still preparing. Please try again.");
      return;
    }

    if (!cardComplete) {
      setCardError("Enter your card details to continue.");
      return;
    }

    if (!clientSecret) {
      setStatusTone("error");
      setStatusMessage("Missing Stripe session. Please refresh the page and try again.");
      return;
    }

    const authToken = getStoredAuthToken({ preferScheme: "token" });
    if (!authToken) {
      setStatusTone("error");
      setStatusMessage("You need to be signed in to add a payment method.");
      return;
    }

    const cardElement = elements?.getElement(CardElement) as StripeCardElement | null;
    if (!cardElement) {
      setStatusTone("error");
      setStatusMessage("Secure card fields are unavailable. Please reload and try again.");
      return;
    }

    setSubmitting(true);
    setStatusMessage(null);
    setStatusTone(null);
    setCardError(null);

    try {
      const result = await stripe.confirmCardSetup(clientSecret, {
        payment_method: {
          card: cardElement,
          billing_details: cardholderName
            ? {
                name: cardholderName,
              }
            : undefined,
        },
      });

      if (result.error) {
        if (result.error.message) {
          setCardError(result.error.message);
        }
        throw new Error(result.error.message ?? "Unable to save your card. Please try again.");
      }

      if (!result.setupIntent || result.setupIntent.status !== "succeeded") {
        throw new Error("Unable to verify your card with Stripe. Please try again.");
      }

      setCardholderName("");
      setStatusTone("success");
      setStatusMessage("Card saved successfully.");
      setCardError(null);
      setCardComplete(false);
      cardElement.clear();
      await onCardAdded();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to save your card.";
      setStatusTone("error");
      setStatusMessage(message);
    } finally {
      setSubmitting(false);
    }
  };

  const stripeFieldClassName = cardError
    ? "payment-form__stripe payment-form__stripe--invalid"
    : "payment-form__stripe";

  return (
    <form className="payment-form" onSubmit={handleSubmit}>
      <div className="payment-form__field">
        <label className="payment-form__label" htmlFor="cardholder-name">
          Name on card
        </label>
        <input
          id="cardholder-name"
          type="text"
          placeholder="Alex Player"
          autoComplete="cc-name"
          className="payment-form__input"
          value={cardholderName}
          onChange={(event) => setCardholderName(event.target.value)}
          disabled={submitting}
        />
      </div>
      <div className="payment-form__field">
        <label className="payment-form__label" htmlFor="card-element">
          Card details
        </label>
        <div className={stripeFieldClassName} id="card-element">
          <CardElement
            className="payment-form__element"
            onReady={() => setCardElementLoaded(true)}
            onChange={handleCardChange}
            options={{
              style: {
                base: {
                  fontSize: "16px",
                  color: "#1f2937",
                  "::placeholder": {
                    color: "#9ca3af",
                  },
                },
                invalid: {
                  color: "#dc2626",
                },
              },
            }}
          />
        </div>
      </div>
      {cardError ? (
        <p className="payment-form__status payment-form__status--error" role="alert">
          {cardError}
        </p>
      ) : null}
      {!cardElementLoaded ? (
        <p className="payment-form__status payment-form__status--inline" role="status">
          <Loader2 className="payment-form__spinner" aria-hidden />
          Preparing Stripe secure fields…
        </p>
      ) : null}
      {statusMessage ? (
        <p
          className={`payment-form__status${statusTone ? ` payment-form__status--${statusTone}` : ""}`}
          role={statusTone === "error" ? "alert" : "status"}
        >
          {statusMessage}
        </p>
      ) : null}
      <button
        type="submit"
        className="payment-form__submit"
        disabled={submitting || !stripe || !cardElementLoaded || !cardComplete}
      >
        {submitting ? "Saving…" : "Save card"}
      </button>
    </form>
  );
};

export default PaymentMethodsPage;
