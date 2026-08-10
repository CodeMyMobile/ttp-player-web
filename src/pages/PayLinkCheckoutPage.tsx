import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Elements, ExpressCheckoutElement, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe, type StripeElementsOptions } from "@stripe/stripe-js";
import { AlertCircle, CheckCircle2, Loader2, Phone, ShieldCheck } from "lucide-react";
import { useParams } from "react-router-dom";

import {
  buildVendorTelHref,
  createRestringingPayLinkCheckout,
  formatPayLinkMoney,
  formatVendorHours,
  getItemSpecs,
  getRestringingPayLink,
  isPayLinkDemoMode,
  shouldShowAccountPrompt,
  type RestringingPayLinkCheckout,
  type RestringingPayLinkSummary,
} from "../api/restringingPayLinks";
import { useAuth } from "../context/AuthContext";
import { useAuthDrawer } from "../context/AuthDrawerContext";
import { getStoredAuthToken } from "../services/authToken";

import "./PayLinkCheckoutPage.css";

const stripePublishableKey =
  import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ??
  import.meta.env.VITE_STRIPE_PUBLISHABLEKEY ??
  "";

const demoSummary = (hasAccount: boolean): RestringingPayLinkSummary => ({
  order: {
    id: 1043,
    customer_first_name: "Ahmed",
    masked_phone: "•• 91 18",
    payment_status: "unpaid",
    fulfillment_status: "pending",
    subtotal_cents: 2999,
    tax_cents: 0,
    total_cents: 2999,
    items: [{
      id: 7,
      racket_make_model: "Yonex Ezone 98",
      service_tier_name: "Restringing Only",
      string_description: "Own string: Yonex Poly Tour Pro 1.25",
      gauge: "17",
      tension_lbs_mains: 52,
      tension_lbs_crosses: 52,
      advice_requested: false,
      unit_price_cents: 2999,
    }],
  },
  vendor: {
    name: "The Tennis Garage",
    address: "12 Rue des Courts, Guerande",
    phone: "+33240112233",
    hours: "Mon-Sat | 9:00 AM - 7:00 PM",
  },
  account_link: hasAccount
    ? { eligible: true, status: "login_available" }
    : { eligible: false, status: "hidden" },
});

const useDemoMode = () => {
  const search = typeof window === "undefined" ? "" : window.location.search;
  return isPayLinkDemoMode(search);
};

interface PayLinkPaymentFormProps {
  checkout: RestringingPayLinkCheckout;
  summary: RestringingPayLinkSummary;
  onPaid: () => void;
}

const DemoPayLinkPaymentForm = ({ summary, onPaid }: Omit<PayLinkPaymentFormProps, "checkout">) => (
  <form className="pay-link-payment" onSubmit={(event) => {
    event.preventDefault();
    onPaid();
  }}>
    <div className="pay-link-wallets">
      <button type="button" className="pay-link-wallet pay-link-wallet--apple" onClick={onPaid}>
        Apple Pay
      </button>
      <button type="button" className="pay-link-wallet pay-link-wallet--google" onClick={onPaid}>
        G Pay
      </button>
    </div>
    <div className="pay-link-or"><span>or pay by card</span></div>
    <div className="pay-link-stripe">
      <div className="pay-link-stripe-demo">
        <div>Card number</div>
        <div className="pay-link-stripe-demo__grid">
          <span>MM / YY</span>
          <span>CVC</span>
        </div>
      </div>
    </div>
    <button type="submit" className="pay-link-btn pay-link-btn--primary pay-link-btn--block">
      Pay {formatPayLinkMoney(summary.order.total_cents)}
    </button>
    <p className="pay-link-fineprint">
      Powered by Stripe. Free cancellation until your racket is dropped off.
    </p>
  </form>
);

const PayLinkPaymentForm = ({ checkout, summary, onPaid }: PayLinkPaymentFormProps) => {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const confirmPayment = useCallback(async () => {
    if (!stripe || !elements) {
      setMessage("Secure payment fields are still loading.");
      return;
    }

    setSubmitting(true);
    setMessage(null);
    try {
      const submitResult = await elements.submit();
      if (submitResult.error) {
        setMessage(submitResult.error.message || "Check your payment details and try again.");
        return;
      }

      const result = await stripe.confirmPayment({
        elements,
        clientSecret: checkout.client_secret,
        confirmParams: {
          return_url: window.location.href,
        },
        redirect: "if_required",
      });

      if (result.error) {
        setMessage(result.error.message || "Payment could not be confirmed.");
        return;
      }

      onPaid();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Payment could not be confirmed.");
    } finally {
      setSubmitting(false);
    }
  }, [checkout.client_secret, elements, onPaid, stripe]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void confirmPayment();
  };

  return (
    <form className="pay-link-payment" onSubmit={handleSubmit}>
      <div className="pay-link-wallets">
        <ExpressCheckoutElement
          onConfirm={() => void confirmPayment()}
          options={{
            paymentMethods: {
              applePay: "auto",
              googlePay: "auto",
              link: "auto",
              amazonPay: "never",
            },
          }}
        />
      </div>
      <div className="pay-link-or"><span>or pay by card</span></div>
      <div className="pay-link-stripe">
        <PaymentElement
          options={{
            paymentMethodOrder: ["link", "card"],
            wallets: {
              applePay: "never",
              googlePay: "never",
            },
            fields: {
              billingDetails: {
                email: "auto",
              },
            },
          }}
        />
      </div>
      {message ? <p className="pay-link-status pay-link-status--error" role="alert">{message}</p> : null}
      <button
        type="submit"
        className="pay-link-btn pay-link-btn--primary pay-link-btn--block"
        disabled={submitting || !stripe || !elements}
      >
        {submitting ? "Paying..." : `Pay ${formatPayLinkMoney(summary.order.total_cents)}`}
      </button>
      <p className="pay-link-fineprint">
        Powered by Stripe. Free cancellation until your racket is dropped off.
      </p>
    </form>
  );
};

interface PayLinkCheckoutPageProps {
  token?: string;
}

const PayLinkCheckoutPage = ({ token: tokenProp }: PayLinkCheckoutPageProps) => {
  const params = useParams();
  const token = tokenProp || params.token || "";
  const demoMode = useDemoMode();
  const { isAuthenticated } = useAuth();
  const { openAuth } = useAuthDrawer();
  const [hasDemoAccount, setHasDemoAccount] = useState(true);
  const [guest, setGuest] = useState(false);
  const [summary, setSummary] = useState<RestringingPayLinkSummary | null>(() =>
    demoMode ? demoSummary(true) : null,
  );
  const [checkout, setCheckout] = useState<RestringingPayLinkCheckout | null>(null);
  const [paid, setPaid] = useState(false);
  const [loading, setLoading] = useState(!demoMode);
  const [error, setError] = useState<string | null>(null);

  const loadSummary = useCallback(async () => {
    if (!token) {
      setError("Payment link is missing.");
      setLoading(false);
      return;
    }

    if (demoMode) {
      setSummary(demoSummary(hasDemoAccount));
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const authToken = getStoredAuthToken({ preferScheme: "token" });
      setSummary(await getRestringingPayLink(token, authToken));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment link could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [demoMode, hasDemoAccount, token]);

  const loadCheckout = useCallback(async () => {
    if (!token || demoMode || paid) return;
    try {
      const authToken = getStoredAuthToken({ preferScheme: "token" });
      setCheckout(await createRestringingPayLinkCheckout(token, authToken));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Secure checkout could not be prepared.");
    }
  }, [demoMode, paid, token]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary, isAuthenticated]);

  useEffect(() => {
    void loadCheckout();
  }, [loadCheckout]);

  const stripePromise = useMemo(() => {
    if (!stripePublishableKey || !checkout?.client_secret || demoMode) return null;
    return loadStripe(
      stripePublishableKey,
      checkout.stripe_account_id ? { stripeAccount: checkout.stripe_account_id } : undefined,
    );
  }, [checkout?.client_secret, checkout?.stripe_account_id, demoMode]);

  const elementsOptions = useMemo<StripeElementsOptions | undefined>(() => {
    if (!checkout?.client_secret) return undefined;
    return {
      clientSecret: checkout.client_secret,
      appearance: {
        theme: "stripe",
        variables: {
          fontFamily: "Inter, system-ui, sans-serif",
          colorPrimary: "#7c3aed",
          borderRadius: "12px",
        },
      },
    };
  }, [checkout?.client_secret]);

  const accountVisible = summary && shouldShowAccountPrompt(summary.account_link) && !guest && !paid;
  const accountLinked = summary?.account_link.status === "linked";
  const vendorTel = buildVendorTelHref(summary?.vendor.phone);
  const vendorHoursText = formatVendorHours(summary?.vendor.hours ?? null);
  const firstItem = summary?.order.items[0];

  const renderOrderSummary = () => {
    if (!summary) return null;

    return (
      <section className="pay-link-card pay-link-panel">
        <div className="pay-link-pills">
          <span className="pay-link-pill pay-link-pill--amber">Awaiting payment</span>
          <span className="pay-link-order-id">#{summary.order.id}</span>
        </div>
        <div className="pay-link-vendor">
          <div className="pay-link-vendor__mark">🎾</div>
          <div className="pay-link-vendor__body">
            <div className="pay-link-vendor__name">{summary.vendor.name}</div>
            {summary.vendor.address ? <div className="pay-link-muted">📍 {summary.vendor.address}</div> : null}
            {vendorHoursText ? <div className="pay-link-muted">🕘 {vendorHoursText}</div> : null}
          </div>
          {vendorTel ? (
            <a className="pay-link-btn pay-link-btn--white pay-link-btn--sm" href={vendorTel}>
              <Phone size={15} aria-hidden /> Call
            </a>
          ) : null}
        </div>
        <div className="pay-link-items">
          {summary.order.items.map((item) => (
            <div className="pay-link-item" key={item.id}>
              <div className="pay-link-item__line">
                <div>
                  <div className="pay-link-item__name">{item.service_tier_name || "Racket service"}</div>
                  <div className="pay-link-muted">{item.racket_make_model || "Racket"} · {item.string_description || "String to confirm"}</div>
                </div>
                <strong>{formatPayLinkMoney(item.unit_price_cents)}</strong>
              </div>
              <div className="pay-link-specs">
                {getItemSpecs(item).map((spec) => (
                  <div className={`pay-link-spec${spec.pending ? " pay-link-spec--pending" : ""}`} key={spec.label}>
                    <span>{spec.label}</span>
                    <strong>{spec.value}</strong>
                    <small>{spec.sublabel || "\u00A0"}</small>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="pay-link-total">
          <span>Total</span>
          <strong>{formatPayLinkMoney(summary.order.total_cents)}</strong>
        </div>
      </section>
    );
  };

  const renderPayment = () => {
    if (!summary || paid) return null;
    if (!demoMode && !stripePublishableKey) {
      return (
        <section className="pay-link-card pay-link-panel pay-link-alert" role="alert">
          <AlertCircle size={18} aria-hidden />
          Stripe publishable key is missing.
        </section>
      );
    }
    if (!demoMode && (!checkout || !stripePromise || !elementsOptions)) {
      return (
        <section className="pay-link-card pay-link-panel pay-link-loading">
          <Loader2 className="pay-link-spin" size={18} aria-hidden />
          Preparing secure payment...
        </section>
      );
    }

    return (
      <section className="pay-link-card pay-link-panel">
        <h2>Payment</h2>
        {demoMode ? (
          <DemoPayLinkPaymentForm
            summary={summary}
            onPaid={() => setPaid(true)}
          />
        ) : (
          <Elements stripe={stripePromise} options={elementsOptions}>
            <PayLinkPaymentForm
              checkout={checkout as RestringingPayLinkCheckout}
              summary={summary}
              onPaid={() => setPaid(true)}
            />
          </Elements>
        )}
      </section>
    );
  };

  return (
    <div className="pay-link-page">
      <header className="pay-link-header">
        <div className="pay-link-brand">
          <div className="pay-link-brand__mark">🎾</div>
          <div className="pay-link-brand__name">The Tennis <span>Plan</span></div>
        </div>
        <span className="pay-link-pill pay-link-pill--gray"><ShieldCheck size={14} aria-hidden /> Secure checkout</span>
      </header>

      <main className="pay-link-wrap">
        {loading ? (
          <section className="pay-link-card pay-link-panel pay-link-loading">
            <Loader2 className="pay-link-spin" size={18} aria-hidden />
            Loading payment link...
          </section>
        ) : error && !summary ? (
          <section className="pay-link-card pay-link-panel pay-link-alert" role="alert">
            <AlertCircle size={18} aria-hidden />
            {error}
          </section>
        ) : summary ? (
          paid ? (
            <>
              <section className="pay-link-card pay-link-panel pay-link-success">
                <CheckCircle2 size={42} aria-hidden />
                <h1>Payment confirmed</h1>
                <p>Order #{summary.order.id} · {formatPayLinkMoney(summary.order.total_cents)} · receipt sent by email.</p>
                {accountLinked ? <span className="pay-link-pill pay-link-pill--green">Saved to your profile</span> : null}
              </section>
              <section className="pay-link-card pay-link-panel">
                <h2>What happens next</h2>
                <div className="pay-link-steps">
                  <div className="pay-link-step"><span>1</span><div><strong>Drop off your racket</strong><p>{[summary.vendor.address, vendorHoursText].filter(Boolean).join(" · ")}</p></div></div>
                  <div className="pay-link-step"><span>2</span><div><strong>We string it</strong><p>{firstItem?.advice_requested ? "Gauge and tension will be agreed at drop-off." : `${firstItem?.tension_lbs_mains ?? "TBD"} lbs · gauge ${firstItem?.gauge ?? "TBD"}`}</p></div></div>
                  <div className="pay-link-step"><span>3</span><div><strong>We text you when ready</strong><p>SMS to {summary.order.masked_phone || "your phone"}</p></div></div>
                </div>
                {vendorTel ? <a className="pay-link-btn pay-link-btn--white pay-link-btn--sm" href={vendorTel}><Phone size={15} aria-hidden /> Call {summary.vendor.name}</a> : null}
              </section>
            </>
          ) : (
            <>
              <div className="pay-link-greeting">
                <h1>Hi {summary.order.customer_first_name} 👋</h1>
                <p>Review your racket service from {summary.vendor.name} and pay below.</p>
              </div>
              {renderOrderSummary()}
              {accountVisible ? (
                <section className="pay-link-card pay-link-panel pay-link-account">
                  <div className="pay-link-account__icon">💜</div>
                  <div>
                    <h2>Log in & save to your profile</h2>
                    <p>Track status and keep this string setup in your history.</p>
                    <div className="pay-link-actions">
                      <button
                        type="button"
                        className="pay-link-btn pay-link-btn--primary pay-link-btn--sm"
                        onClick={() => openAuth({
                          mode: "signin",
                          reason: "Log in to save this order to your Tennis Plan profile.",
                          onSuccess: () => void loadSummary(),
                        })}
                      >
                        Log in & save
                      </button>
                      <button type="button" className="pay-link-btn pay-link-btn--white pay-link-btn--sm" onClick={() => setGuest(true)}>
                        Continue as guest
                      </button>
                    </div>
                  </div>
                </section>
              ) : null}
              {accountLinked ? (
                <section className="pay-link-card pay-link-panel pay-link-linked">
                  <span className="pay-link-pill pay-link-pill--green">Saved to your profile</span>
                  <span>Live status will appear in your account.</span>
                </section>
              ) : null}
              {error ? (
                <section className="pay-link-card pay-link-panel pay-link-alert" role="alert">
                  <AlertCircle size={18} aria-hidden />
                  {error}
                </section>
              ) : null}
              {renderPayment()}
              {demoMode ? (
                <div className="pay-link-demo">
                  <span>Prototype:</span>
                  <button type="button" className={hasDemoAccount ? "is-on" : ""} onClick={() => setHasDemoAccount(true)}>Has TP account</button>
                  <button type="button" className={!hasDemoAccount ? "is-on" : ""} onClick={() => setHasDemoAccount(false)}>No account</button>
                </div>
              ) : null}
            </>
          )
        ) : null}
      </main>
    </div>
  );
};

export default PayLinkCheckoutPage;
