import { FormEvent, useState } from "react";
import { CardElement, useElements, useStripe } from "@stripe/react-stripe-js";
import type { StripeCardElement, StripeCardElementChangeEvent } from "@stripe/stripe-js";
import { Loader2 } from "lucide-react";

import { getStoredAuthToken } from "../../services/authToken";

interface AddCardFormProps {
  clientSecret: string;
  onCardAdded: (paymentMethodId?: string) => void | Promise<void>;
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

      const savedPaymentMethodId =
        typeof result.setupIntent.payment_method === "string" ? result.setupIntent.payment_method : undefined;

      setCardholderName("");
      setStatusTone("success");
      setStatusMessage("Card saved successfully.");
      setCardError(null);
      setCardComplete(false);
      cardElement.clear();
      await onCardAdded(savedPaymentMethodId);
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
          Preparing Stripe secure fields...
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
        {submitting ? "Saving..." : "Save card"}
      </button>
    </form>
  );
};

export default AddCardForm;
