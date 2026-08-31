import { useCallback, useEffect, useMemo, useState } from "react";
import { Elements, ExpressCheckoutElement, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  CreditCard,
  MapPin,
  MessageCircle,
  Minus,
  Phone,
  Plus,
  RefreshCw,
  Star,
} from "lucide-react";
import AppNav from "../components/AppNav.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useAuthDrawer } from "../context/AuthDrawerContext.jsx";
import {
  buildCheckoutItems,
  catalogGaugesForString,
  categoryLabel,
  defaultGaugeForString,
  formatMoneyCents,
  lbsToKg,
  normalizePaymentMethods,
  orderStatusLabel,
  paymentStatusLabel,
  recommendStringCategory,
  isPresetCompositionTier,
  serviceCompositionLabel,
  vendorImageSrc,
} from "./playerFlow.js";
import {
  googleMapsUriForVendor,
  googleReviewInitial,
  googleReviewsForVendor,
  hasGoogleSummary,
} from "./googleReviews.js";
import {
  cancelOrder,
  captureVendorLead,
  createCheckoutOrder,
  getVendorProfile,
  listMyOrders,
  listSavedPaymentMethods,
  listServiceTiers,
  listVendorStrings,
  listVendors,
} from "./restringingService.js";
import { findVendorBySlug, vendorProfilePath } from "./vendorProfileRoutes.js";

const stripePublishableKey =
  import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ??
  import.meta.env.VITE_STRIPE_PUBLISHABLEKEY ??
  "";
const stripePromise = stripePublishableKey ? loadStripe(stripePublishableKey) : null;

const WIZARD_QUESTIONS = [
  { key: "arm", label: "Arm/elbow/shoulder discomfort?", options: ["Yes", "Sometimes", "No"] },
  { key: "breaks", label: "How often do you break strings?", options: ["Rarely", "Every couple of months", "Monthly+"] },
  { key: "priority", label: "What matters most?", options: ["Spin & control", "Power & comfort", "Reliable & affordable"] },
  { key: "budget", label: "Premium or standard?", options: ["Best performance", "Good value"] },
];

const defaultTiers = [
  { id: 1, name: "Restringing Only", price_cents: 2999, string_category: null },
  { id: 2, name: "Restringing + Synthetic Gut", price_cents: 3999, string_category: "syn_gut" },
  { id: 3, name: "Restringing + Standard Multifilament", price_cents: 4499, string_category: "std_multi" },
  { id: 4, name: "Restringing + Premium Multifilament", price_cents: 4999, string_category: "prem_multi" },
  { id: 5, name: "Restringing + Standard Polyester", price_cents: 4499, string_category: "std_poly" },
  { id: 6, name: "Restringing + Premium Polyester", price_cents: 4999, string_category: "prem_poly" },
  { id: 7, name: "Restring + Poly / Multi Hybrid", price_cents: 4999, string_category: null, string_composition: "poly_multi_hybrid" },
  { id: 8, name: "Restring + Natural Gut Hybrid", price_cents: 6999, string_category: null, string_composition: "natural_gut_hybrid" },
  { id: 9, name: "Restring + Natural Gut", price_cents: 8999, string_category: null, string_composition: "natural_gut" },
];

const tierSub = (tier) => isPresetCompositionTier(tier) ? serviceCompositionLabel(tier.string_composition) : ({
  syn_gut: "Reliable all-rounder",
  std_multi: "Comfort and power",
  prem_multi: "Top comfort and feel",
  std_poly: "Spin and durability",
  prem_poly: "Tour-level control",
}[tier?.string_category] || "You supply the string");

const clean = (value) => String(value || "").trim();
const isOwnTier = (tier) => tier && tier.string_category === null && !isPresetCompositionTier(tier);

function Field({ label, children }) {
  return (
    <label className="rsg-field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function TileButton({ active, children, ...props }) {
  return (
    <button type="button" className={`rsg-tile ${active ? "is-active" : ""}`} {...props}>
      {children}
    </button>
  );
}

function GoogleLogo() {
  return (
    <span className="rsg-google-logo" aria-label="Google">
      <b>G</b><i>o</i><u>o</u><b>g</b><i>l</i><s>e</s>
    </span>
  );
}

function VendorRatingLink({ vendor }) {
  if (!hasGoogleSummary(vendor)) return null;
  return (
    <button
      type="button"
      className="rsg-rating-link"
      onClick={() => document.getElementById("reviews")?.scrollIntoView({ behavior: "smooth" })}
    >
      <span className="rsg-rating-stars">★ {Number(vendor.google.rating).toFixed(1)}</span>
      <span>{Number(vendor.google.user_ratings_total)} Google reviews</span>
    </button>
  );
}

function GoogleReviewsBlock({ vendor }) {
  const reviews = googleReviewsForVendor(vendor);
  const mapsUri = googleMapsUriForVendor(vendor);
  if (!reviews.length && !mapsUri) return null;

  if (!reviews.length) {
    return (
      <section className="rsg-card rsg-reviews-card" id="reviews">
        <div className="rsg-reviews-foot">
          <GoogleLogo />
          <span>Reviews from Google</span>
          <a className="rsg-google-link" href={mapsUri} target="_blank" rel="noreferrer">See all ↗</a>
        </div>
      </section>
    );
  }

  return (
    <section className="rsg-card rsg-reviews-card" id="reviews">
      <div className="rsg-reviews-head">
        <h2>Reviews</h2>
        {hasGoogleSummary(vendor) ? (
          <div className="rsg-reviews-score">
            <span className="rsg-rating-stars">★ {Number(vendor.google.rating).toFixed(1)}</span>
            <span>{Number(vendor.google.user_ratings_total)} on Google</span>
          </div>
        ) : null}
      </div>
      <div className="rsg-reviews-list">
        {reviews.map((review, index) => {
          const stars = review.rating;
          return (
            <article className="rsg-google-review" key={`${review.authorName}-${index}`}>
              {review.authorPhotoUri ? (
                <img className="rsg-review-avatar" src={review.authorPhotoUri} alt="" />
              ) : (
                <span className="rsg-review-avatar">{googleReviewInitial(review)}</span>
              )}
              <div className="rsg-review-body">
                <div className="rsg-review-top">
                  <strong>{review.authorName}</strong>
                  {review.relativeTimeDescription ? <span>{review.relativeTimeDescription}</span> : null}
                </div>
                <div className="rsg-review-stars">
                  {"★".repeat(stars)}<span>{"★".repeat(5 - stars)}</span>
                </div>
                {review.text ? <p>{review.text}</p> : null}
                {review.googleMapsUri ? (
                  <a className="rsg-google-link" href={review.googleMapsUri} target="_blank" rel="noreferrer">View on Google ↗</a>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
      <div className="rsg-reviews-foot">
        <GoogleLogo />
        <span>Reviews from Google</span>
        {mapsUri ? <a className="rsg-google-link" href={mapsUri} target="_blank" rel="noreferrer">See all ↗</a> : null}
      </div>
    </section>
  );
}

function StripePaymentForm({ clientSecret, totalLabel, onPaid, disabled }) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [paymentElementReady, setPaymentElementReady] = useState(false);

  const confirm = useCallback(async () => {
    if (!stripe || !elements || submitting || disabled) return;
    if (!paymentElementReady) {
      setError("Secure payment fields are still loading.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const submitResult = await elements.submit();
      if (submitResult.error) {
        setError(submitResult.error.message || "Check your payment details and try again.");
        return;
      }

      const result = await stripe.confirmPayment({
        elements,
        clientSecret,
        redirect: "if_required",
        confirmParams: {
          return_url: `${window.location.origin}${window.location.pathname}${window.location.search}#/restring`,
        },
      });
      if (result.error) {
        setError(result.error.message || "Payment could not be completed.");
        return;
      }
      onPaid();
    } catch (err) {
      setError(err?.message || "Payment could not be completed.");
    } finally {
      setSubmitting(false);
    }
  }, [clientSecret, disabled, elements, onPaid, paymentElementReady, stripe, submitting]);

  return (
    <div className="rsg-payment">
      <ExpressCheckoutElement onConfirm={() => void confirm()} />
      <PaymentElement options={{ layout: "tabs" }} onReady={() => setPaymentElementReady(true)} />
      {error ? <p className="rsg-error">{error}</p> : null}
      <button type="button" className="rsg-primary" disabled={!stripe || !paymentElementReady || submitting || disabled} onClick={confirm}>
        {submitting ? "Processing..." : `Pay ${totalLabel}`}
      </button>
    </div>
  );
}

export default function RestringingPlayerFlow({ vendorSlug: directVendorSlug = "" }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { vendorSlug: routeVendorSlug = "" } = useParams();
  const activeVendorSlug = clean(directVendorSlug || routeVendorSlug);
  const { isAuthenticated, loading: authLoading, logout } = useAuth();
  const authDrawer = useAuthDrawer();
  const [screen, setScreen] = useState("home");
  const [history, setHistory] = useState([]);
  const [tiers, setTiers] = useState(defaultTiers);
  const [vendors, setVendors] = useState([]);
  const [allVendors, setAllVendors] = useState([]);
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [catalog, setCatalog] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [locationText, setLocationText] = useState("");
  const [leadEmail, setLeadEmail] = useState("");
  const [leadSent, setLeadSent] = useState(false);
  const [wizardIndex, setWizardIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [recommendation, setRecommendation] = useState(null);
  const [tierId, setTierId] = useState(null);
  const [stringId, setStringId] = useState("");
  const [otherString, setOtherString] = useState("");
  const [ownString, setOwnString] = useState("");
  const [gauge, setGauge] = useState("16");
  const [tension, setTension] = useState(54);
  const [splitTension, setSplitTension] = useState(false);
  const [crosses, setCrosses] = useState(52);
  const [adviceRequested, setAdviceRequested] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [setupMode, setSetupMode] = useState("");
  const [racketMakeModel, setRacketMakeModel] = useState("");
  const [orderNotes, setOrderNotes] = useState("");
  const [perRacketItems, setPerRacketItems] = useState([]);
  const [checkoutResult, setCheckoutResult] = useState(null);
  const [confirmedOrder, setConfirmedOrder] = useState(null);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState("");
  const [paymentChoice, setPaymentChoice] = useState("new");
  const [paymentMethodsLoading, setPaymentMethodsLoading] = useState(false);

  const tier = useMemo(() => tiers.find((item) => Number(item.id) === Number(tierId)) || null, [tierId, tiers]);
  const selectedString = useMemo(
    () => catalog.find((item) => Number(item.id) === Number(stringId)) || null,
    [catalog, stringId],
  );
  const selectedGaugeOptions = useMemo(
    () => catalogGaugesForString(selectedString),
    [selectedString],
  );
  const needsOtherString = Boolean(tier && !isOwnTier(tier) && !isPresetCompositionTier(tier) && (stringId === "other" || catalog.length === 0));
  const totalCents = (Number(tier?.price_cents || 0) * quantity);
  const totalLabel = formatMoneyCents(totalCents);

  const go = useCallback((next) => {
    setHistory((items) => [...items, screen]);
    setScreen(next);
    setError("");
  }, [screen]);

  const back = useCallback(() => {
    if (screen === "wizard" && wizardIndex > 0) {
      setWizardIndex((index) => index - 1);
      return;
    }
    setHistory((items) => {
      const next = [...items];
      const previous = next.pop() || "home";
      setScreen(previous);
      return next;
    });
  }, [screen, wizardIndex]);

  const refreshOrders = useCallback(async () => {
    if (!isAuthenticated) {
      setOrders([]);
      return;
    }
    try {
      setOrders(await listMyOrders());
    } catch {
      setOrders([]);
    }
  }, [isAuthenticated]);

  const refreshPaymentMethods = useCallback(async () => {
    if (!isAuthenticated) {
      setPaymentMethods([]);
      setSelectedPaymentMethodId("");
      setPaymentChoice("new");
      return;
    }
    setPaymentMethodsLoading(true);
    try {
      const rows = normalizePaymentMethods(await listSavedPaymentMethods());
      setPaymentMethods(rows);
      const defaultMethod = rows.find((method) => method.isDefault) || rows[0] || null;
      setSelectedPaymentMethodId(defaultMethod?.id || "");
      setPaymentChoice(defaultMethod ? "saved" : "new");
    } catch {
      setPaymentMethods([]);
      setSelectedPaymentMethodId("");
      setPaymentChoice("new");
    } finally {
      setPaymentMethodsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const [tierRows, vendorRows] = await Promise.all([
          listServiceTiers().catch(() => defaultTiers),
          listVendors().catch(() => []),
        ]);
        if (cancelled) return;
        setTiers(tierRows.length ? tierRows : defaultTiers);
        setVendors(vendorRows);
        setAllVendors(vendorRows);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    void refreshOrders();
  }, [refreshOrders]);

  useEffect(() => {
    const params = new URLSearchParams(location.search || "");
    if (params.get("screen") === "orders") {
      setScreen("orders");
      setHistory((items) => (items.length ? items : ["home"]));
      void refreshOrders();
    }
  }, [location.search, refreshOrders]);

  useEffect(() => {
    void refreshPaymentMethods();
  }, [refreshPaymentMethods]);

  useEffect(() => {
    if (!activeVendorSlug || loading) return undefined;
    const vendor = findVendorBySlug(allVendors.length ? allVendors : vendors, activeVendorSlug);
    if (!vendor) {
      setScreen("vendor");
      setHistory((items) => (items.length ? items : ["home"]));
      return undefined;
    }

    let cancelled = false;
    setBusy(true);
    getVendorProfile(vendor.id)
      .then((profile) => {
        if (cancelled) return;
        setSelectedVendor(profile || vendor);
        setScreen("profile");
        setHistory((items) => (items.length ? items : ["vendor"]));
      })
      .catch(() => {
        if (cancelled) return;
        setSelectedVendor(vendor);
        setScreen("profile");
        setHistory((items) => (items.length ? items : ["vendor"]));
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeVendorSlug, allVendors, loading, vendors]);

  useEffect(() => {
    if (!tier || !selectedVendor) return;
    if (isPresetCompositionTier(tier)) {
      setCatalog([]);
      setStringId("");
      setGauge("");
      return undefined;
    }
    let cancelled = false;
    listVendorStrings({ vendorId: selectedVendor.id, serviceTierId: tier.id })
      .then((data) => {
        if (cancelled) return;
        const rows = data.catalog || [];
        setCatalog(rows);
        setStringId(rows[0]?.id ? String(rows[0].id) : "other");
        setGauge(defaultGaugeForString(rows[0] || null));
      })
      .catch(() => {
        if (!cancelled) setCatalog([]);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedVendor, tier]);

  useEffect(() => {
    if (adviceRequested || isPresetCompositionTier(tier)) return;
    setGauge((current) => (
      selectedGaugeOptions.includes(current)
        ? current
        : defaultGaugeForString(selectedString)
    ));
  }, [adviceRequested, selectedGaugeOptions, selectedString, tier]);

  useEffect(() => {
    if (quantity < 2) setSetupMode("");
    if (quantity >= 2 && setupMode === "different") {
      setPerRacketItems((items) => Array.from({ length: quantity }, (_, index) => items[index] || {
        racketMakeModel,
        note: "",
        stringId: stringId || selectedString?.id || "",
        customStringText: otherString,
        ownStringText: ownString,
        gauge,
        tensionMains: tension,
        tensionCrosses: splitTension ? crosses : tension,
      }));
    }
  }, [crosses, gauge, otherString, ownString, quantity, racketMakeModel, selectedString?.id, setupMode, splitTension, stringId, tension]);

  const selectWizardAnswer = (question, value) => {
    const nextAnswers = { ...answers, [question.key]: value };
    setAnswers(nextAnswers);
    if (wizardIndex + 1 < WIZARD_QUESTIONS.length) {
      setWizardIndex((index) => index + 1);
      return;
    }
    const result = recommendStringCategory(nextAnswers);
    setRecommendation(result);
    const recommendedTier = tiers.find((item) => item.string_category === result.category);
    setTierId(recommendedTier?.id || null);
    setTension(result.tensionLbs);
    setCrosses(Math.max(40, result.tensionLbs - 2));
    go("recommendation");
  };

  const useGeo = () => {
    if (!navigator.geolocation) return;
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const rows = await listVendors({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
          setVendors(rows);
          setLocationText("Current location");
        } finally {
          setBusy(false);
        }
      },
      () => setBusy(false),
      { timeout: 8000 },
    );
  };

  const showAllStringers = async () => {
    setBusy(true);
    setError("");
    try {
      const rows = allVendors.length ? allVendors : await listVendors();
      setAllVendors(rows);
      setVendors(rows);
    } catch (err) {
      setError(err?.data?.detail || "Could not load all stringers.");
    } finally {
      setBusy(false);
    }
  };

  const chooseVendor = async (vendor) => {
    setBusy(true);
    try {
      const profile = await getVendorProfile(vendor.id).catch(() => vendor);
      setSelectedVendor(profile || vendor);
      go("config");
    } finally {
      setBusy(false);
    }
  };

  const openVendorProfile = async (vendor) => {
    setBusy(true);
    try {
      setSelectedVendor(await getVendorProfile(vendor.id));
      navigate(vendorProfilePath(vendor));
      go("profile");
    } finally {
      setBusy(false);
    }
  };

  const validateConfig = () => {
    if (!tier) return false;
    if (isPresetCompositionTier(tier)) return true;
    if (adviceRequested && !isOwnTier(tier)) return true;
    if (isOwnTier(tier)) return Boolean(clean(ownString));
    if (needsOtherString) return Boolean(clean(otherString));
    return Boolean(stringId || catalog[0]?.id);
  };

  const validateRackets = () => {
    if (quantity >= 2 && !setupMode) return false;
    if (setupMode === "different" && !adviceRequested) {
      return perRacketItems.length === quantity && perRacketItems.every((item) =>
        clean(item.racketMakeModel) &&
        (!isOwnTier(tier) || clean(item.ownStringText || ownString)) &&
        Number(item.tensionMains) >= 40 &&
        Number(item.tensionMains) <= 70
      );
    }
    return Boolean(clean(racketMakeModel));
  };

  const buildItems = () => buildCheckoutItems({
    serviceTierId: tier.id,
    selectedStringId: adviceRequested || isPresetCompositionTier(tier) ? null : needsOtherString ? null : stringId || catalog[0]?.id || null,
    customStringText: adviceRequested || isPresetCompositionTier(tier) ? null : needsOtherString ? otherString : null,
    ownStringText: isPresetCompositionTier(tier) ? null : isOwnTier(tier) ? ownString : null,
    gauge: isPresetCompositionTier(tier) ? null : gauge,
    tensionMains: tension,
    tensionCrosses: splitTension ? crosses : tension,
    adviceRequested,
    racketMakeModel,
    orderNotes,
    quantity,
    setupMode,
    perRacketItems: isPresetCompositionTier(tier)
      ? perRacketItems.map((item) => ({ ...item, stringId: null, customStringText: null, ownStringText: null, gauge: null }))
      : perRacketItems,
  });

  const startCheckout = async (paymentMethodId = null) => {
    if (!isAuthenticated) {
      authDrawer.openAuth({
        mode: "signup",
        reason: "Create an account to track your restringing order and get SMS pickup updates.",
        onSuccess: () => void refreshOrders(),
      });
      return;
    }
    if (!selectedVendor || !tier || busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await createCheckoutOrder({
        vendorId: selectedVendor.id,
        items: buildItems(),
        paymentMethodId,
      });
      setCheckoutResult(result);
      setConfirmedOrder(result.order);
      return result;
    } catch (err) {
      if (err?.status === 401 || err?.status === 403) {
        logout?.();
        authDrawer.openAuth({
          mode: "signin",
          reason: "Your session expired. Sign in again to finish checkout.",
          onSuccess: () => void refreshOrders(),
        });
        return;
      }
      setError(err?.data?.detail || err.message || "Checkout failed.");
      return null;
    } finally {
      setBusy(false);
    }
  };

  const payWithSavedMethod = async () => {
    if (!selectedPaymentMethodId) {
      setError("Choose a saved payment method first.");
      return;
    }
    if (!stripePromise) {
      setError("Stripe is not configured. Set VITE_STRIPE_PUBLISHABLE_KEY.");
      return;
    }
    const result = await startCheckout(selectedPaymentMethodId);
    if (!result?.client_secret) return;
    setBusy(true);
    setError("");
    try {
      const stripe = await stripePromise;
      if (!stripe) throw new Error("Stripe is not ready.");
      const confirmation = await stripe.confirmCardPayment(result.client_secret, {
        payment_method: selectedPaymentMethodId,
      });
      if (confirmation.error) {
        setError(confirmation.error.message || "Payment could not be completed.");
        return;
      }
      setConfirmedOrder(result.order);
      await refreshOrders();
      go("confirmation");
    } catch (err) {
      setError(err?.message || "Payment could not be completed.");
    } finally {
      setBusy(false);
    }
  };

  const submitLead = async () => {
    if (!clean(locationText)) {
      setError("Enter your area first.");
      return;
    }
    setBusy(true);
    try {
      await captureVendorLead({ area: locationText, email: leadEmail });
      setLeadSent(true);
    } catch (err) {
      setError(err?.data?.detail || "Could not save your area.");
    } finally {
      setBusy(false);
    }
  };

  const orderStringLine = (item) => {
    if (item.item_type === "custom") {
      return `${item.label || "Custom item"} x ${item.item_qty || 1} · ${formatMoneyCents(Number(item.unit_price_cents || 0) * Number(item.item_qty || 1))}`;
    }
    if (item.advice_requested) return "Specs decided at drop-off";
    const stringName = item.string_name
      ? `${item.string_brand || ""} ${item.string_name}`.trim()
      : item.custom_string_text || item.own_string_text || "String";
    return `${stringName} · gauge ${item.gauge || "-"} · ${item.tension_lbs_mains || "-"}${item.tension_lbs_crosses && item.tension_lbs_crosses !== item.tension_lbs_mains ? `/${item.tension_lbs_crosses}` : ""} lbs`;
  };

  const selectedStringName = selectedString
    ? `${selectedString.brand || ""} ${selectedString.name || ""}`.trim()
    : stringId === "other"
      ? otherString
      : ownString;

  return (
    <div className="dashboard-page restring-page">
      <AppNav />
      <main className="rsg-shell">
        {screen !== "home" ? (
          <button type="button" className="rsg-back" onClick={back}>
            <ChevronLeft size={18} /> Back
          </button>
        ) : null}

        {error ? <div className="rsg-alert">{error}</div> : null}
        {loading || authLoading ? <div className="rsg-card">Loading restringing options...</div> : null}

        {!loading && screen === "home" ? (
          <>
            <section className="rsg-hero">
              <h1>Restring my racket</h1>
              <p>Fresh strings, from a stringer near you.</p>
            </section>
            <button type="button" className="rsg-choice" onClick={() => go("tier")}>
              <span className="rsg-emoji">🎯</span>
              <span><b>I know what I want</b><small>Pick a service and string.</small></span>
              <ArrowRight size={20} />
            </button>
            <button type="button" className="rsg-choice rsg-choice-hot" onClick={() => { setWizardIndex(0); setAnswers({}); go("wizard"); }}>
              <span className="rsg-emoji">💡</span>
              <span><b>Help me choose a string</b><small>4 quick questions.</small></span>
              <ArrowRight size={20} />
            </button>
            {orders.length ? (
              <button type="button" className="rsg-choice" onClick={() => go("orders")}>
                <span className="rsg-emoji">📋</span>
                <span><b>My orders ({orders.length})</b><small>Track status and cancel before drop-off.</small></span>
                <ArrowRight size={20} />
              </button>
            ) : null}
          </>
        ) : null}

        {screen === "wizard" ? (
          <section className="rsg-card">
            <div className="rsg-progress"><span style={{ width: `${(wizardIndex / WIZARD_QUESTIONS.length) * 100}%` }} /></div>
            <h2>{WIZARD_QUESTIONS[wizardIndex].label}</h2>
            <div className="rsg-stack">
              {WIZARD_QUESTIONS[wizardIndex].options.map((option) => (
                <button key={option} type="button" className="rsg-option" onClick={() => selectWizardAnswer(WIZARD_QUESTIONS[wizardIndex], option)}>
                  {option}<ArrowRight size={18} />
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {screen === "recommendation" && recommendation ? (
          <>
            <section className="rsg-card rsg-reco">
              <span className="rsg-pill">Recommended</span>
              <h1>{recommendation.categoryLabel}</h1>
              <p>{recommendation.rationale}</p>
              <div className="rsg-tiles">
                <div className="rsg-stat"><span>Tension</span><b>{recommendation.tensionLbs}</b><small>lbs</small></div>
                <div className="rsg-stat"><span>Category</span><b>{categoryLabel(recommendation.category)}</b><small>editable</small></div>
              </div>
            </section>
            <button type="button" className="rsg-primary" onClick={() => go("vendor")}>Find my stringer</button>
            <button type="button" className="rsg-secondary" onClick={() => go("tier")}>See all services instead</button>
          </>
        ) : null}

        {screen === "tier" ? (
          <>
            <section className="rsg-hero compact"><h1>Choose your service</h1><p>All tiers include professional restringing.</p></section>
            <div className="rsg-stack">
              {tiers.map((item) => (
                <button key={item.id} type="button" className={`rsg-tier ${Number(tierId) === Number(item.id) ? "is-active" : ""}`} onClick={() => setTierId(item.id)}>
                  <span><b>{item.name}</b><small>{tierSub(item)}</small></span>
                  <strong>{formatMoneyCents(item.price_cents)}</strong>
                </button>
              ))}
            </div>
            <button type="button" className="rsg-primary" disabled={!tier} onClick={() => go("vendor")}>Continue</button>
          </>
        ) : null}

        {screen === "vendor" ? (
          <>
            <section className="rsg-hero compact">
              <h1>Your local stringer</h1>
              <div className="rsg-loc">
                <input value={locationText} onChange={(event) => setLocationText(event.target.value)} placeholder="Enter city or area" />
                <button type="button" onClick={useGeo} disabled={busy}><MapPin size={16} /> Use location</button>
              </div>
            </section>
            {vendors.length === 0 ? (
              <section className="rsg-card">
                <h2>No stringer in range yet</h2>
                <p>Leave your area and we’ll use it to recruit local stringers.</p>
                <Field label="Area"><input value={locationText} onChange={(event) => setLocationText(event.target.value)} placeholder="Pasadena, CA" /></Field>
                <Field label="Email optional"><input value={leadEmail} onChange={(event) => setLeadEmail(event.target.value)} placeholder="you@example.com" /></Field>
                <button type="button" className="rsg-primary" disabled={busy || leadSent} onClick={submitLead}>{leadSent ? "Saved" : "Notify me"}</button>
                <button type="button" className="rsg-secondary" disabled={busy} onClick={showAllStringers}>Show all stringers</button>
              </section>
            ) : (
              <div className="rsg-stack">
                {vendors.map((vendor) => (
                  <section key={vendor.id} className="rsg-card">
                    <div className="rsg-vendor">
                      <div className="rsg-vendor-details">
                        <div className="rsg-vendor-img">
                          {vendorImageSrc(vendor) ? <img src={vendorImageSrc(vendor)} alt={`${vendor.name} storefront`} /> : "🎾"}
                        </div>
                        <div><h2>{vendor.name}</h2><p><Star size={15} /> New</p><p><MapPin size={15} /> {vendor.address || "Address pending"} {vendor.distance_miles ? `· ${Number(vendor.distance_miles).toFixed(1)} mi` : ""}</p></div>
                      </div>
                      <span className="rsg-pill">{vendor.turnaround_days || 3} day turnaround</span>
                    </div>
                    <div className="rsg-actions">
                      <button type="button" className="rsg-primary" onClick={() => chooseVendor(vendor)}>Order here</button>
                      {vendor.phone_href ? <a className="rsg-icon-btn" href={vendor.phone_href}><Phone size={18} /></a> : null}
                      {vendor.sms_href ? <a className="rsg-icon-btn" href={vendor.sms_href}><MessageCircle size={18} /></a> : null}
                    </div>
                    <Link
                      className="rsg-link"
                      to={vendorProfilePath(vendor)}
                      onClick={(event) => {
                        event.preventDefault();
                        void openVendorProfile(vendor);
                      }}
                    >
                      View full profile
                    </Link>
                  </section>
                ))}
              </div>
            )}
          </>
        ) : null}

        {screen === "profile" && selectedVendor ? (
          <>
            <section className="rsg-card rsg-profile">
              <div className="rsg-profile-img">{selectedVendor.image_url ? <img src={selectedVendor.image_url} alt="" /> : "🎾"}</div>
              <h1>{selectedVendor.name}</h1>
              <VendorRatingLink vendor={selectedVendor} />
              <p>{selectedVendor.description || "Professional restringing, setup advice, and quick local pickup."}</p>
              <p><MapPin size={15} /> {selectedVendor.address}</p>
              <button type="button" className="rsg-primary" onClick={() => go("config")}>Order here</button>
            </section>
            <section className="rsg-card">
              <h2>Strings in stock</h2>
              <p>{catalog.length ? catalog.map((item) => `${item.brand} ${item.name}`).slice(0, 8).join(", ") : "Catalog loads after service selection."}</p>
            </section>
            <GoogleReviewsBlock vendor={selectedVendor} />
          </>
        ) : null}

        {screen === "config" && tier ? (
          <section className="rsg-card">
            <h1>Your string setup</h1>
            <p>{tier.name} at {selectedVendor?.name}</p>
            {isPresetCompositionTier(tier) ? (
              <p>Included strings: {serviceCompositionLabel(tier.string_composition)}. Your stringer will choose the matching setup.</p>
            ) : isOwnTier(tier) ? (
              <Field label="String you are bringing"><input value={ownString} onChange={(event) => setOwnString(event.target.value)} placeholder="Luxilon ALU Power 16L" /></Field>
            ) : (
              <>
                <span className="rsg-label">String</span>
                <div className="rsg-chips">
                  {catalog.map((item) => (
                    <button key={item.id} type="button" className={String(stringId || catalog[0]?.id) === String(item.id) ? "is-active" : ""} onClick={() => { setStringId(String(item.id)); setGauge(defaultGaugeForString(item)); }}>
                      {item.brand} {item.name}
                    </button>
                  ))}
                  <button type="button" className={needsOtherString ? "is-active" : ""} onClick={() => setStringId("other")}>Other...</button>
                </div>
                {needsOtherString ? <Field label="Describe the string"><input value={otherString} onChange={(event) => setOtherString(event.target.value)} placeholder="Brand and model" /><small>Required for Other. Subject to availability; your stringer confirms at drop-off.</small></Field> : null}
              </>
            )}
            {!isPresetCompositionTier(tier) ? (
              <>
                <span className="rsg-label">Gauge</span>
                <div className="rsg-tiles">
                  {selectedGaugeOptions.map((item) => <TileButton key={item} active={gauge === item && !adviceRequested} disabled={adviceRequested} onClick={() => setGauge(item)}><small>gauge</small><b>{item}</b></TileButton>)}
                </div>
              </>
            ) : null}
            <span className="rsg-label">{splitTension ? "Tension - mains" : "Tension"}</span>
            <div className="rsg-stepper">
              <button type="button" disabled={adviceRequested} onClick={() => setTension((value) => Math.max(40, value - 1))}><Minus size={16} /></button>
              <div><b>{adviceRequested ? "-" : tension}</b><small>{adviceRequested ? "" : `${lbsToKg(tension)} kg`}</small></div>
              <button type="button" disabled={adviceRequested} onClick={() => setTension((value) => Math.min(70, value + 1))}><Plus size={16} /></button>
            </div>
            {splitTension && !adviceRequested ? (
              <>
                <span className="rsg-label">Tension - crosses</span>
                <div className="rsg-stepper">
                  <button type="button" onClick={() => setCrosses((value) => Math.max(40, value - 1))}><Minus size={16} /></button>
                  <div><b>{crosses}</b><small>{lbsToKg(crosses)} kg</small></div>
                  <button type="button" onClick={() => setCrosses((value) => Math.min(70, value + 1))}><Plus size={16} /></button>
                </div>
              </>
            ) : null}
            <label className="rsg-check"><input type="checkbox" checked={splitTension} disabled={adviceRequested} onChange={(event) => { setSplitTension(event.target.checked); if (event.target.checked) setCrosses(Math.max(40, tension - 2)); }} /> Different mains / crosses tension</label>
            <label className="rsg-check"><input type="checkbox" checked={adviceRequested} onChange={(event) => setAdviceRequested(event.target.checked)} /> Not sure? Ask your stringer's advice at drop-off</label>
            <button type="button" className="rsg-primary" disabled={!validateConfig()} onClick={() => go("rackets")}>Continue</button>
          </section>
        ) : null}

        {screen === "rackets" && tier ? (
          <section className="rsg-card">
            <h1>Your racket{quantity > 1 ? "s" : ""}</h1>
            <span className="rsg-label">How many rackets?</span>
            <div className="rsg-tiles">
              {[1, 2, 3, 4].map((count) => <TileButton key={count} active={quantity === count} onClick={() => setQuantity(count)}><small>rackets</small><b>{count}</b></TileButton>)}
            </div>
            {quantity >= 2 ? (
              <>
                <span className="rsg-label">Setup</span>
                <div className="rsg-chips">
                  <button type="button" className={setupMode === "same" ? "is-active" : ""} onClick={() => setSetupMode("same")}>Same setup for all</button>
                  <button type="button" className={setupMode === "different" ? "is-active" : ""} onClick={() => setSetupMode("different")}>Different per racket</button>
                </div>
              </>
            ) : null}
            {setupMode === "different" && !adviceRequested ? (
              <div className="rsg-stack">
                {perRacketItems.map((item, index) => (
                  <div className="rsg-racket" key={index}>
                    <h3>Racket {index + 1}</h3>
                    <Field label="Make & model"><input value={item.racketMakeModel || ""} onChange={(event) => setPerRacketItems((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, racketMakeModel: event.target.value } : row))} /></Field>
                    <Field label="Tell them apart"><input value={item.note || ""} onChange={(event) => setPerRacketItems((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, note: event.target.value } : row))} /></Field>
                    <Field label="Tension lbs"><input type="number" min="40" max="70" value={item.tensionMains || ""} onChange={(event) => setPerRacketItems((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, tensionMains: Number(event.target.value), tensionCrosses: Number(event.target.value) } : row))} /></Field>
                  </div>
                ))}
              </div>
            ) : (
              <Field label="Make & model"><input value={racketMakeModel} onChange={(event) => setRacketMakeModel(event.target.value)} placeholder="Babolat Pure Aero 2023" /></Field>
            )}
            <Field label="Notes for your stringer"><input value={orderNotes} onChange={(event) => setOrderNotes(event.target.value)} placeholder="Logo stencil, loose grip..." /></Field>
            <button type="button" className="rsg-primary" disabled={!validateRackets()} onClick={() => go("checkout")}>Review & pay</button>
          </section>
        ) : null}

        {screen === "checkout" && tier ? (
          <>
            <section className="rsg-card">
              <h1>Checkout</h1>
              <div className="rsg-summary">
                <b>{tier.name} · x{quantity}</b>
                <span>{adviceRequested ? "Specs decided at drop-off" : `${isPresetCompositionTier(tier) ? serviceCompositionLabel(tier.string_composition) : `${selectedStringName || "String"} · gauge ${gauge}`} · ${splitTension ? `${tension}/${crosses}` : tension} lbs`}</span>
                <span>{selectedVendor?.name} · {selectedVendor?.address}</span>
                {orderNotes ? <span>{orderNotes}</span> : null}
                <strong>{totalLabel}</strong>
              </div>
            </section>
            {!isAuthenticated ? (
              <section className="rsg-card">
                <h2>Create an account to track your order</h2>
                <p>Checkout is the only login wall. You’ll get status tracking and SMS pickup updates.</p>
                <button type="button" className="rsg-primary" onClick={startCheckout}>Sign up / log in</button>
              </section>
            ) : (
              <section className="rsg-card">
                {!checkoutResult ? (
                  <>
                    {paymentMethodsLoading ? <p>Loading saved payment methods...</p> : null}
                    {paymentMethods.length ? (
                      <>
                        <span className="rsg-label">Payment method</span>
                        <div className="rsg-pay-methods">
                          {paymentMethods.map((method) => (
                            <button
                              key={method.id}
                              type="button"
                              className={`rsg-pay-method ${paymentChoice === "saved" && selectedPaymentMethodId === method.id ? "is-active" : ""}`}
                              onClick={() => { setPaymentChoice("saved"); setSelectedPaymentMethodId(method.id); }}
                            >
                              <CreditCard size={18} />
                              <span><b>{method.brand.toUpperCase()} {method.last4 ? `•••• ${method.last4}` : ""}</b><small>{method.isDefault ? "Default card" : "Saved card"}{method.expMonth && method.expYear ? ` · exp ${method.expMonth}/${method.expYear}` : ""}</small></span>
                            </button>
                          ))}
                          <button
                            type="button"
                            className={`rsg-pay-method ${paymentChoice === "new" ? "is-active" : ""}`}
                            onClick={() => setPaymentChoice("new")}
                          >
                            <Plus size={18} />
                            <span><b>Use a new card</b><small>Apple Pay, Google Pay, Link, or card</small></span>
                          </button>
                        </div>
                      </>
                    ) : null}
                    {paymentChoice === "saved" && paymentMethods.length ? (
                      <button type="button" className="rsg-primary" disabled={busy || !selectedPaymentMethodId} onClick={payWithSavedMethod}>
                        {busy ? "Processing..." : `Pay ${totalLabel}`}
                      </button>
                    ) : (
                      <button type="button" className="rsg-primary" disabled={busy} onClick={() => void startCheckout()}>
                        {busy ? "Preparing payment..." : "Continue to payment"}
                      </button>
                    )}
                  </>
                ) : stripePromise && checkoutResult.client_secret ? (
                  <Elements stripe={stripePromise} options={{ clientSecret: checkoutResult.client_secret, appearance: { theme: "stripe" } }}>
                    <StripePaymentForm clientSecret={checkoutResult.client_secret} totalLabel={totalLabel} disabled={busy} onPaid={() => { setConfirmedOrder(checkoutResult.order); void refreshOrders(); go("confirmation"); }} />
                  </Elements>
                ) : (
                  <p className="rsg-error">Stripe is not configured. Set VITE_STRIPE_PUBLISHABLE_KEY.</p>
                )}
                <p className="rsg-fine">Free cancellation until your racket is dropped off.</p>
              </section>
            )}
          </>
        ) : null}

        {screen === "confirmation" ? (
          <>
            <section className="rsg-card rsg-done">
              <CheckCircle2 size={42} />
              <h1>Order confirmed</h1>
              <p>#{confirmedOrder?.id} · {totalLabel} · {selectedVendor?.name}</p>
              <span className="rsg-pill">Saved to your profile</span>
            </section>
            <section className="rsg-card">
              <h2>What happens next</h2>
              <div className="rsg-steps">
                <p><b>1</b> Drop off at {selectedVendor?.address}. Hours: {selectedVendor?.hours ? JSON.stringify(selectedVendor.hours) : "vendor hours"}</p>
                <p><b>2</b> {selectedVendor?.name} strings it {adviceRequested ? "with specs agreed at drop-off" : "with your selected specs"}.</p>
                <p><b>3</b> We text you when it is ready.</p>
              </div>
            </section>
            <button type="button" className="rsg-secondary" onClick={() => { void refreshOrders(); go("orders"); }}>View my orders</button>
          </>
        ) : null}

        {screen === "orders" ? (
          <>
            <section className="rsg-hero compact"><h1>My orders</h1><p>Live status on your restrings.</p></section>
            <button type="button" className="rsg-secondary" onClick={refreshOrders}><RefreshCw size={16} /> Refresh</button>
            <div className="rsg-stack">
              {orders.map((order) => (
                <section className="rsg-card" key={order.id}>
                  <div className="rsg-order-head">
                    <b>#{order.id}</b>
                    <span className="rsg-status-pill"><small>Order</small>{orderStatusLabel(order.fulfillment_status || order.status)}</span>
                    <span className="rsg-status-pill rsg-status-pill--payment"><small>Payment</small>{paymentStatusLabel(order.payment_status)}</span>
                  </div>
                  {(order.items || []).map((item) => (
                    <p key={item.id}>
                      {item.item_type === "custom" ? "Item" : item.racket_make_model}: {orderStringLine(item)}
                    </p>
                  ))}
                  <p>{order.vendor_name} · {formatMoneyCents(order.total_cents)}</p>
                  {Number(order.discount_amount_cents || 0) > 0 ? (
                    <p>{order.discount_label || "Discount"} -{formatMoneyCents(order.discount_amount_cents)}</p>
                  ) : null}
                  {order.fulfillment_status === "pending" ? (
                    <>
                      <button type="button" className="rsg-secondary" onClick={async () => { await cancelOrder(order.id); await refreshOrders(); }}>Cancel order (full refund)</button>
                      <p className="rsg-fine">Free cancellation until your racket is dropped off.</p>
                    </>
                  ) : null}
                </section>
              ))}
              {!orders.length ? <section className="rsg-card">No restringing orders yet.</section> : null}
            </div>
          </>
        ) : null}
      </main>
      <style>{`
        .restring-page{background:#f4f5f7;min-height:100vh}
        .rsg-shell{max-width:760px;margin:0 auto;padding:18px 16px 96px;color:#111827;font-family:Inter,system-ui,sans-serif}
        .rsg-back,.rsg-secondary,.rsg-icon-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;border:1px solid #e5e7eb;background:white;color:#111827;border-radius:14px;padding:12px 14px;font-weight:800;box-shadow:0 1px 2px rgba(17,24,39,.05)}
        .rsg-back{margin-bottom:14px}
        .rsg-hero{padding:14px 2px 18px}.rsg-hero.compact{padding-top:4px}.rsg-hero h1,.rsg-card h1{font-size:34px;line-height:1.05;font-weight:900;margin:0 0 6px}.rsg-hero p,.rsg-card p{color:#6b7280;margin:4px 0}
        .rsg-card,.rsg-choice,.rsg-tier{background:white;border:1px solid #edf0f4;border-radius:20px;box-shadow:0 1px 2px rgba(17,24,39,.05),0 10px 28px rgba(17,24,39,.06);padding:18px;margin-bottom:14px}
        .rsg-choice,.rsg-tier{width:100%;display:flex;align-items:center;justify-content:space-between;text-align:left}.rsg-choice b,.rsg-tier b{display:block;font-size:18px}.rsg-choice small,.rsg-tier small{display:block;color:#6b7280}.rsg-choice-hot{border-color:#dac7ff;background:#faf7ff}.rsg-emoji{font-size:30px;margin-right:10px}
        .rsg-primary{width:100%;display:inline-flex;align-items:center;justify-content:center;gap:8px;border:0;border-radius:15px;padding:14px 16px;background:linear-gradient(135deg,#7c3aed,#a855f7);color:white;font-weight:900;box-shadow:0 10px 24px rgba(124,58,237,.22);margin-top:12px}.rsg-primary:disabled,.rsg-secondary:disabled{opacity:.55}
        .rsg-stack{display:grid;gap:12px}.rsg-option{display:flex;align-items:center;justify-content:space-between;border:1px solid #e5e7eb;background:#fff;border-radius:14px;padding:14px 15px;font-weight:800}.rsg-progress{height:8px;border-radius:999px;background:#ede9fe;margin-bottom:16px;overflow:hidden}.rsg-progress span{display:block;height:100%;background:#7c3aed}
        .rsg-tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(96px,1fr));gap:10px;margin:10px 0}.rsg-tile,.rsg-stat{min-height:78px;border:1px solid #e5e7eb;background:#fff;border-radius:16px;padding:12px;text-align:center}.rsg-tile.is-active,.rsg-tier.is-active{border-color:#7c3aed;background:#f5f0ff}.rsg-tile b,.rsg-stat b{display:block;font-size:22px}.rsg-tile small,.rsg-stat span,.rsg-stat small{display:block;color:#6b7280;font-size:12px}
        .rsg-pill{display:inline-flex;align-items:center;border-radius:999px;background:#ede9fe;color:#6d28d9;padding:6px 10px;font-weight:900;font-size:12px}.rsg-field,.rsg-label{display:block;margin-top:14px;font-weight:900}.rsg-field span{display:block;margin-bottom:6px}.rsg-field input,.rsg-loc input{width:100%;border:1px solid #e5e7eb;border-radius:14px;padding:13px 12px}.rsg-field small{display:block;color:#6b7280;margin-top:5px}
        .rsg-chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}.rsg-chips button{border:1px solid #e5e7eb;background:#fff;border-radius:999px;padding:10px 13px;font-weight:800}.rsg-chips button.is-active{border-color:#7c3aed;background:#ede9fe;color:#6d28d9}
        .rsg-stepper{display:flex;align-items:center;justify-content:center;gap:12px;margin:8px 0}.rsg-stepper button{width:42px;height:42px;border-radius:999px;border:1px solid #e5e7eb;background:white}.rsg-stepper div{min-width:92px;text-align:center;border:1px solid #e5e7eb;border-radius:16px;padding:8px}.rsg-stepper b{display:block;font-size:24px}.rsg-stepper small{display:block;color:#6b7280}
        .rsg-check{display:flex;gap:9px;align-items:center;margin-top:12px;font-weight:800}.rsg-actions,.rsg-loc{display:flex;gap:8px;align-items:center}.rsg-actions .rsg-primary{margin-top:0;flex:1}.rsg-link{border:0;background:transparent;color:#6d28d9;font-weight:900;margin-top:10px}.rsg-vendor{display:flex;justify-content:space-between;gap:12px}.rsg-vendor-details{display:flex;align-items:flex-start;gap:12px;min-width:0}.rsg-vendor-img{width:64px;height:64px;flex:0 0 64px;border-radius:14px;background:linear-gradient(135deg,#ede9fe,#dcfce7);display:flex;align-items:center;justify-content:center;font-size:26px;overflow:hidden}.rsg-vendor-img img{width:100%;height:100%;object-fit:cover}.rsg-vendor p{display:flex;align-items:center;gap:5px}
        .rsg-profile-img{height:170px;border-radius:18px;background:linear-gradient(135deg,#ede9fe,#dcfce7);display:flex;align-items:center;justify-content:center;font-size:56px;overflow:hidden}.rsg-profile-img img{width:100%;height:100%;object-fit:cover}.rsg-rating-link{display:inline-flex;align-items:baseline;gap:8px;border:0;background:none;padding:0;margin:4px 0;color:#6d28d9;font-weight:800;text-decoration:underline}.rsg-rating-stars{font-weight:900;color:#b8860b}.rsg-reviews-card h2{margin:0}.rsg-reviews-head{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:4px}.rsg-reviews-score{display:flex;align-items:baseline;gap:8px;color:#6b7280;font-size:13px;font-weight:700}.rsg-reviews-list{display:flex;flex-direction:column}.rsg-google-review{display:flex;gap:12px;padding:14px 0;border-bottom:1px solid #f1f2f4}.rsg-google-review:last-child{border-bottom:none}.rsg-review-avatar{width:36px;height:36px;border-radius:999px;background:#ede9fe;color:#6d28d9;font-weight:900;font-size:15px;display:flex;align-items:center;justify-content:center;object-fit:cover;flex-shrink:0}.rsg-review-body{flex:1;min-width:0}.rsg-review-top{display:flex;align-items:baseline;justify-content:space-between;gap:10px}.rsg-review-top strong{font-size:14px}.rsg-review-top span{color:#6b7280;font-size:12.5px}.rsg-review-stars{color:#e0a800;font-size:13px;letter-spacing:1px;margin:1px 0 4px}.rsg-review-stars span{color:#e1e3e8}.rsg-review-body p{font-size:13.5px;color:#374151}.rsg-google-link{font-size:12.5px;font-weight:800;color:#6d28d9;text-decoration:none;margin-top:4px;display:inline-block}.rsg-reviews-foot{display:flex;align-items:center;gap:8px;border-top:1px solid #f1f2f4;padding-top:12px;margin-top:2px;color:#6b7280;font-size:12.5px}.rsg-reviews-foot .rsg-google-link{margin-left:auto;margin-top:0}.rsg-google-logo{font-weight:900;font-size:14px;letter-spacing:0}.rsg-google-logo b{color:#4285f4}.rsg-google-logo i{color:#ea4335;font-style:normal}.rsg-google-logo u{color:#fbbc05;text-decoration:none}.rsg-google-logo i:nth-of-type(2){color:#34a853}.rsg-google-logo s{color:#ea4335;text-decoration:none}
        .rsg-racket{border:1px solid #eef2f7;border-radius:16px;padding:12px}.rsg-summary{display:grid;gap:6px}.rsg-summary span{color:#6b7280}.rsg-summary strong{font-size:24px}.rsg-payment{display:grid;gap:12px}.rsg-pay-methods{display:grid;gap:9px;margin-top:8px}.rsg-pay-method{width:100%;display:flex;align-items:center;gap:10px;text-align:left;border:1px solid #e5e7eb;background:#fff;border-radius:15px;padding:12px}.rsg-pay-method.is-active{border-color:#7c3aed;background:#f5f0ff}.rsg-pay-method span{display:grid;gap:2px}.rsg-pay-method small{color:#6b7280}.rsg-fine{font-size:12px!important;text-align:center}.rsg-alert,.rsg-error{background:#fef2f2;color:#b91c1c;border:1px solid #fecaca;border-radius:14px;padding:12px;margin-bottom:12px}.rsg-done{text-align:center}.rsg-done svg{color:#059669;margin:auto}.rsg-steps p{display:flex;gap:10px}.rsg-steps b{display:inline-flex;width:26px;height:26px;border-radius:999px;align-items:center;justify-content:center;background:#ede9fe;color:#6d28d9}.rsg-order-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:10px}.rsg-status-pill{display:inline-grid;gap:1px;border-radius:12px;background:#eef2ff;color:#4338ca;padding:6px 10px;font-weight:900;font-size:13px}.rsg-status-pill--payment{background:#ecfdf5;color:#047857}.rsg-status-pill small{color:inherit;opacity:.72;font-size:10px;text-transform:uppercase;letter-spacing:.04em}
        @media (max-width:640px){.rsg-shell{padding-inline:12px}.rsg-hero h1,.rsg-card h1{font-size:30px}.rsg-vendor,.rsg-actions,.rsg-loc{align-items:stretch;flex-direction:column}.rsg-icon-btn{width:100%}}
      `}</style>
    </div>
  );
}
