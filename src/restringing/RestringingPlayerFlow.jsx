import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Elements, ExpressCheckoutElement, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  CreditCard,
  Lightbulb,
  MapPin,
  MessageCircle,
  Minus,
  Package,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  Star,
  Target,
  Wallet,
} from "lucide-react";
import AppNav from "../components/AppNav.jsx";
import FeatureNavBar, { FeatureNavIconButton } from "../components/FeatureNavBar";
import MobileHomeBottomNav from "../components/MobileHomeBottomNav";
import { useAuth } from "../context/AuthContext.jsx";
import { useAuthDrawer } from "../context/AuthDrawerContext.jsx";
import {
  addOnCheckoutItems,
  buildCheckoutItems,
  checkoutErrorMessage,
  MAX_RACKETS,
  catalogGaugesForString,
  categoryLabel,
  defaultGaugeForString,
  formatMoneyCents,
  restringCostSplit,
  restringUnitPrice,
  lbsToKg,
  normalizePaymentMethods,
  recommendStringCategory,
  WIZARD_QUESTIONS,
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
import { listAllStrings } from "./allStringsService.js";
import { matchOwnString, ownStringHint, ownStringResults } from "./ownString.js";
import {
  cancelOrder,
  captureVendorLead,
  createCheckoutOrder,
  quoteCheckout,
  getVendorProfile,
  listMyOrders,
  listMyStrings,
  listSavedPaymentMethods,
  listServiceTiers,
  listVendorStrings,
  recommendStrings,
  listVendors,
  rateMyString,
  saveGameProfile,
} from "./restringingService.js";
import { ratingBody } from "./stringFeedback.js";
import { vendorHoursSummary } from "./vendorPage.js";
import { findVendorBySlug, vendorProfilePath } from "./vendorProfileRoutes.js";
import MyOrdersScreen, { RateStringScreen } from "./MyOrdersScreen.jsx";
import { formatOrderTotal, ordersSummaryLine, usualSetup } from "./myOrders.js";
import RestringEntryV2 from "./RestringEntryV2.jsx";
import RestringStringPicker from "./RestringStringPicker.jsx";
import { RestringQuizQuestion, RestringQuizResult } from "./RestringQuizV2.jsx";
import { QUIZ_QUESTIONS, levelFromNtrp } from "./quizV2.js";
import { getPlayerPersonalDetails } from "../api/playerProfile";
import { getStoredAuthToken } from "../services/authToken.js";
import { playerLevelOf } from "../utils/groupLessonLevelFit";
import { nearbyStringers, reorderPlan } from "./entryV2.js";
import { DEFAULT_RADIUS_MILES, getStoredLocation, getStoredLocationRadius } from "../utils/userLocation";
import { isRestringV2Enabled } from "../utils/featureFlags";

const stripePublishableKey =
  import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ??
  import.meta.env.VITE_STRIPE_PUBLISHABLEKEY ??
  "";
const stripePromise = stripePublishableKey ? loadStripe(stripePublishableKey) : null;

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

// checkoutHandoff: an order already chosen on the public vendor page — { vendor, tierId, item,
// summary, onBack }. The flow opens straight on checkout and submits that item as-is.
export default function RestringingPlayerFlow({ vendorSlug: directVendorSlug = "", checkoutHandoff = null }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { vendorSlug: routeVendorSlug = "" } = useParams();
  const activeVendorSlug = clean(directVendorSlug || routeVendorSlug);
  const { isAuthenticated, loading: authLoading, logout } = useAuth();
  const authDrawer = useAuthDrawer();
  const [screen, setScreen] = useState(checkoutHandoff ? "checkout" : "home");
  const [history, setHistory] = useState([]);
  const [tiers, setTiers] = useState(defaultTiers);
  const [vendors, setVendors] = useState([]);
  const [allVendors, setAllVendors] = useState([]);
  const [selectedVendor, setSelectedVendor] = useState(checkoutHandoff?.vendor || null);
  const [catalog, setCatalog] = useState([]);
  const [orders, setOrders] = useState([]);
  const [ordersUpdatedAt, setOrdersUpdatedAt] = useState(null);
  const [ordersRefreshing, setOrdersRefreshing] = useState(false);
  // My strings: { strings, consented, profile }, for the "How's your …?" cards and the list.
  const [myStrings, setMyStrings] = useState(null);
  // The racket a rating text links to (?screen=rate&item=…).
  const [rateItemId, setRateItemId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [locationText, setLocationText] = useState("");
  const [leadEmail, setLeadEmail] = useState("");
  const [leadSent, setLeadSent] = useState(false);
  const [wizardIndex, setWizardIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [recommendation, setRecommendation] = useState(null);
  const [tierId, setTierId] = useState(checkoutHandoff?.tierId ?? null);
  const [stringId, setStringId] = useState("");
  // A custom hybrid's crosses: any in-stock string the shop has priced, from all its strings.
  const [crossesId, setCrossesId] = useState("");
  const [crossesGauge, setCrossesGauge] = useState("");
  const [shopStrings, setShopStrings] = useState([]);
  // The setup screen shows the chosen string, not the whole list, until the player asks to
  // change it; a hybrid's crosses only when they ask for one.
  const [editingString, setEditingString] = useState(false);
  const [hybridOpen, setHybridOpen] = useState(false);
  const [otherString, setOtherString] = useState("");
  const [ownString, setOwnString] = useState("");
  // The catalog string the player's own string is, when they pick or type one ("" when not).
  const [ownStringId, setOwnStringId] = useState("");
  // Every catalog string for the own-string search, with this shop's stock; the open list and its highlighted row.
  const [allStrings, setAllStrings] = useState({ vendorId: null, rows: [] });
  const [ownSearch, setOwnSearch] = useState(null);
  const [gauge, setGauge] = useState("16");
  const [tension, setTension] = useState(54);
  const [splitTension, setSplitTension] = useState(false);
  const [crosses, setCrosses] = useState(52);
  const [adviceRequested, setAdviceRequested] = useState(Boolean(checkoutHandoff?.item?.advice_requested));
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
  // Apple Pay as its own choice beside the saved cards, offered only when this device can pay
  // with it (as on coach packages and private-lesson booking).
  const [applePayRequest, setApplePayRequest] = useState(null);
  const restringV2 = isRestringV2Enabled();
  // Reorder: the string (and gauge) to keep when the shop's catalog for the tier loads, instead
  // of the first in the list. Read once by the catalog effect.
  const preferredStringRef = useRef(null);
  const [reorderNotice, setReorderNotice] = useState("");
  // "I know what I want": the nearest shop, its whole in-stock list, and the pick so far.
  const [pickerShop, setPickerShop] = useState(null);
  const [pickerCatalog, setPickerCatalog] = useState([]);
  const [stringPick, setStringPick] = useState(null);
  // "Help me choose": the question on screen, the answers, the level from the player's NTRP,
  // and the result.
  const [quizIndex, setQuizIndex] = useState(0);
  const [quizAnswers, setQuizAnswers] = useState({});
  const [quizLevel, setQuizLevel] = useState(null);
  const [quizResult, setQuizResult] = useState(null);
  // Checkout extras: the shop's add-ons ({ offerId: quantity }), an applied discount code, and
  // the API's price for the order as it stands (null until quoted, or signed out).
  const [addOnQty, setAddOnQty] = useState({});
  const [discountCode, setDiscountCode] = useState("");
  const [codeInput, setCodeInput] = useState("");
  const [codeError, setCodeError] = useState("");
  const [quote, setQuote] = useState(null);
  const [quoting, setQuoting] = useState(false);

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
  const hybridStrings = useMemo(
    () => shopStrings.filter((row) => row.in_stock !== false && row.string_price_cents != null),
    [shopStrings],
  );
  const canHybrid = Boolean(tier?.string_category && selectedString?.string_price_cents != null && !adviceRequested && stringId !== "other");
  const crossesString = canHybrid ? hybridStrings.find((row) => String(row.id) === String(crossesId)) || null : null;
  // Each racket's string: a shop-priced string sets that racket's price (labor + string).
  const racketPrices = (setupMode === "different" && quantity >= 2 && perRacketItems.length
    ? perRacketItems.map((item) => catalog.find((row) => String(row.id) === String(item.stringId)) || null)
    : Array.from({ length: quantity }, () => selectedString)
  ).map((string) => restringUnitPrice(tier, string, crossesString && string === selectedString ? crossesString : null));
  const subtotalCents = racketPrices.reduce((sum, price) => sum + price.unitCents, 0);
  const taxCents = Math.round(
    racketPrices.reduce((sum, price) => sum + price.taxableCents, 0) * (Number(selectedVendor?.tax_rate) || 0),
  );
  // The API's price once quoted (add-ons, discount and tax included); before that, the
  // restring alone, worked out here the way the API does.
  const pricing = quote?.pricing || null;
  const totalCents = pricing ? Number(pricing.total_cents || 0) : subtotalCents + taxCents;
  const totalLabel = formatMoneyCents(totalCents);

  const go = useCallback((next) => {
    setHistory((items) => [...items, screen]);
    setScreen(next);
    setError("");
  }, [screen]);

  const back = useCallback(() => {
    if (checkoutHandoff && screen === "checkout") {
      checkoutHandoff.onBack?.();
      return;
    }
    if (screen === "wizard" && wizardIndex > 0) {
      setWizardIndex((index) => index - 1);
      return;
    }
    if (screen === "quiz" && quizIndex > 0) {
      setQuizIndex((index) => index - 1);
      return;
    }
    setHistory((items) => {
      const next = [...items];
      const previous = next.pop() || "home";
      setScreen(previous);
      return next;
    });
  }, [checkoutHandoff, quizIndex, screen, wizardIndex]);

  const refreshOrders = useCallback(async () => {
    if (!isAuthenticated) {
      setOrders([]);
      setMyStrings(null);
      return;
    }
    setOrdersRefreshing(true);
    // Strings and ratings load beside the orders; without them the page is just My orders.
    const strings = listMyStrings().then(setMyStrings, () => setMyStrings(null));
    try {
      setOrders(await listMyOrders());
      setOrdersUpdatedAt(Date.now());
    } catch {
      setOrders([]);
    } finally {
      await strings;
      setOrdersRefreshing(false);
    }
  }, [isAuthenticated]);

  const rateString = useCallback(async (orderItemId, answers) => {
    const row = await rateMyString(orderItemId, ratingBody(answers, { consented: Boolean(myStrings?.consented) }));
    setMyStrings((current) => current && {
      ...current,
      consented: true,
      strings: current.strings.map((item) => (item.order_item_id === orderItemId && row ? row : item)),
    });
    return row;
  }, [myStrings?.consented]);

  const saveProfile = useCallback(async (answers) => {
    const profile = await saveGameProfile(answers);
    setMyStrings((current) => current && { ...current, profile });
    return profile;
  }, []);

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
    } else if (params.get("screen") === "rate") {
      setRateItemId(params.get("item"));
      setScreen("rate");
      // Back goes to My orders, where the rest of their strings are.
      setHistory((items) => (items.length ? items : ["home", "orders"]));
      void refreshOrders();
    }
  }, [location.search, refreshOrders]);

  useEffect(() => {
    void refreshPaymentMethods();
  }, [refreshPaymentMethods]);

  useEffect(() => {
    if (!activeVendorSlug || loading || checkoutHandoff) return undefined;
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
  }, [activeVendorSlug, allVendors, checkoutHandoff, loading, vendors]);

  useEffect(() => {
    if (!selectedVendor) {
      setShopStrings([]);
      return undefined;
    }
    let cancelled = false;
    listVendorStrings({ vendorId: selectedVendor.id })
      .then((data) => {
        if (!cancelled) setShopStrings(data?.catalog || []);
      })
      .catch(() => {
        if (!cancelled) setShopStrings([]);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedVendor]);

  useEffect(() => {
    setCrossesId("");
    setCrossesGauge("");
    setEditingString(false);
    setHybridOpen(false);
  }, [tierId, stringId]);

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
        const preferred = preferredStringRef.current;
        preferredStringRef.current = null;
        setCatalog(rows);
        if (preferred?.id === "other") {
          setStringId("other");
          return;
        }
        const kept = preferred ? rows.find((row) => String(row.id) === String(preferred.id)) : null;
        const pick = kept || rows[0] || null;
        setStringId(pick?.id ? String(pick.id) : "other");
        setGauge(kept && catalogGaugesForString(kept).includes(preferred.gauge) ? preferred.gauge : defaultGaugeForString(pick));
      })
      .catch(() => {
        if (!cancelled) setCatalog([]);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedVendor, tier]);

  // Every catalog string, once the player chooses to bring their own. Without it the box is plain text.
  const ownStringShopId = tier && isOwnTier(tier) ? selectedVendor?.id || null : null;
  useEffect(() => {
    if (!ownStringShopId || allStrings.vendorId === ownStringShopId) return undefined;
    let cancelled = false;
    listAllStrings({ vendorId: ownStringShopId })
      .then((rows) => {
        if (!cancelled) setAllStrings({ vendorId: ownStringShopId, rows });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [allStrings.vendorId, ownStringShopId]);

  // A reordered own string names its catalog string once the list is in.
  useEffect(() => {
    if (!allStrings.rows.length) return;
    setOwnStringId((current) => current || String(matchOwnString(ownString, allStrings.rows)?.id ?? ""));
    // Only when the list arrives: typing keeps the id in step itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allStrings]);

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

  // Order again: the last restring's setup as a new order at the same shop, then checkout. If
  // its string isn't stocked any more (or it needs details), the setup screen instead.
  const reorder = async (entry) => {
    const { order, item } = entry || {};
    const vendor = (allVendors.length ? allVendors : vendors).find((row) => Number(row.id) === Number(order?.vendor_id));
    const nextTier = tiers.find((row) => Number(row.id) === Number(item?.service_tier_id));
    if (!vendor || !nextTier) {
      setError("That setup can't be reordered right now. Pick your string instead.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const [profile, catalogData] = await Promise.all([
        getVendorProfile(vendor.id).catch(() => vendor),
        nextTier.string_category
          ? listVendorStrings({ vendorId: vendor.id, serviceTierId: nextTier.id }).catch(() => ({ catalog: [] }))
          : Promise.resolve({ catalog: [] }),
      ]);
      const plan = reorderPlan({ item, tier: nextTier, catalog: catalogData?.catalog || [] });
      preferredStringRef.current = plan.stringId ? { id: plan.stringId, gauge: plan.gauge } : null;
      setSelectedVendor(profile || vendor);
      setTierId(nextTier.id);
      setStringId(plan.stringId);
      setGauge(plan.gauge || "16");
      setOtherString(plan.customString);
      setOwnString(plan.ownString);
      setOwnStringId(String(matchOwnString(plan.ownString, allStrings.rows)?.id ?? ""));
      setTension(plan.tensionMains);
      setCrosses(plan.tensionCrosses);
      setSplitTension(plan.splitTension);
      setAdviceRequested(plan.adviceRequested);
      setRacketMakeModel(plan.racketMakeModel);
      setQuantity(1);
      setSetupMode("");
      setPerRacketItems([]);
      setOrderNotes("");
      setCheckoutResult(null);
      const lastString = `${clean(item?.string_brand)} ${clean(item?.string_name)}`.trim();
      setReorderNotice(
        plan.stocked
          ? ""
          : lastString
            ? `${lastString} isn't in stock at ${vendor.name} right now. Pick another string.`
            : "Add the string you're bringing, then continue.",
      );
      go(plan.stocked && plan.racketMakeModel ? "checkout" : plan.stocked ? "rackets" : "config");
    } finally {
      setBusy(false);
    }
  };

  // The shop "I know what I want" lists strings from: the nearest within the player's Home
  // radius, else the first shop.
  const nearestShop = async () => {
    const position = getStoredLocation();
    if (!position) return (allVendors.length ? allVendors : vendors)[0] || null;
    const rows = await listVendors({ lat: position.latitude, lng: position.longitude }).catch(() => []);
    return nearbyStringers(rows, getStoredLocationRadius() ?? DEFAULT_RADIUS_MILES)[0] || (allVendors.length ? allVendors : vendors)[0] || null;
  };

  const openStringPicker = async () => {
    setBusy(true);
    setError("");
    try {
      const shop = pickerShop || await nearestShop();
      if (!shop) {
        go("vendor");
        return;
      }
      const data = await listVendorStrings({ vendorId: shop.id }).catch(() => ({ catalog: [] }));
      setPickerShop(shop);
      setPickerCatalog(data?.catalog || []);
      go("strings");
    } finally {
      setBusy(false);
    }
  };

  // Continue from the string list: the pick's service at that shop, then gauge and tension.
  const continueFromPicker = (pick) => {
    const nextTier = tiers.find((row) => Number(row.id) === Number(pick.tierId));
    if (!nextTier || !pickerShop) return;
    setStringPick(pick);
    setSelectedVendor(pickerShop);
    setReorderNotice("");
    setAdviceRequested(false);
    if (pick.kind === "string") {
      const row = pickerCatalog.find((item) => String(item.id) === String(pick.stringId));
      preferredStringRef.current = { id: pick.stringId, gauge: defaultGaugeForString(row || null) };
      setStringId(pick.stringId);
      setGauge(defaultGaugeForString(row || null));
    } else {
      preferredStringRef.current = null;
      setStringId("");
    }
    if (pick.kind === "own") {
      setOwnString("");
      setOwnStringId("");
    }
    setTension(nextTier.string_category?.includes("poly") ? 50 : 54);
    setCrosses(nextTier.string_category?.includes("poly") ? 48 : 52);
    setSplitTension(false);
    setTierId(nextTier.id);
    go("config");
  };

  // Help me choose: the nearest shop's strings (what the result can pick from) and the
  // player's level, then question 1.
  const openQuiz = async () => {
    setBusy(true);
    setError("");
    try {
      const token = getStoredAuthToken();
      const [shop, ntrp] = await Promise.all([
        pickerShop ? Promise.resolve(pickerShop) : nearestShop(),
        isAuthenticated && token
          ? getPlayerPersonalDetails({ token }).then((details) => playerLevelOf(details)).catch(() => null)
          : Promise.resolve(null),
      ]);
      if (shop && (shop !== pickerShop || !pickerCatalog.length)) {
        const data = await listVendorStrings({ vendorId: shop.id }).catch(() => ({ catalog: [] }));
        setPickerShop(shop);
        setPickerCatalog(data?.catalog || []);
      }
      setQuizLevel(levelFromNtrp(ntrp));
      setQuizAnswers({});
      setQuizIndex(0);
      setQuizResult(null);
      go("quiz");
    } finally {
      setBusy(false);
    }
  };

  // The last answer asks the recommendation engine about the shop's strings.
  const answerQuiz = async (key, value) => {
    const next = { ...quizAnswers, [key]: value };
    setQuizAnswers(next);
    if (quizIndex + 1 < QUIZ_QUESTIONS.length) {
      setQuizIndex((index) => index + 1);
      return;
    }
    // The answers also go on the player's profile, for string feedback. Best effort.
    if (isAuthenticated) saveGameProfile(next).catch(() => {});
    if (!pickerShop) {
      setQuizResult(null);
      go("quizResult");
      return;
    }
    setBusy(true);
    setError("");
    try {
      setQuizResult(await recommendStrings({ vendorId: pickerShop.id, answers: next }));
    } catch {
      setQuizResult(null);
    } finally {
      setBusy(false);
    }
    go("quizResult");
  };

  // A recommended string goes the same way as a pick from the list, at its suggested tension.
  const chooseFromQuiz = (option) => {
    continueFromPicker({ kind: "string", tierId: option.service_tier_id, stringId: String(option.string.id) });
    setTension(option.tension_lbs);
    setCrosses(option.tension_lbs);
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

  // Change the string: back to the list it was picked from, or the shop's strings here.
  const changeString = () => {
    const from = history[history.length - 1];
    if (restringV2 && (from === "strings" || from === "quizResult")) {
      back();
      return;
    }
    setEditingString(true);
  };

  const validateConfig = () => {
    if (!tier) return false;
    if (isPresetCompositionTier(tier)) return true;
    if (adviceRequested && !isOwnTier(tier)) return true;
    if (isOwnTier(tier)) return Boolean(clean(ownString));
    if (needsOtherString) return Boolean(clean(otherString));
    if (crossesString && !crossesGauge) return false;
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

  const buildItems = () => checkoutHandoff ? [checkoutHandoff.item] : buildCheckoutItems({
    serviceTierId: tier.id,
    // An own string names its catalog string when the player picked or typed one.
    selectedStringId: isOwnTier(tier) ? ownStringId || null : adviceRequested || isPresetCompositionTier(tier) ? null : needsOtherString ? null : stringId || catalog[0]?.id || null,
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
      // Every racket gets the one own string the box names, as typed then.
      : isOwnTier(tier)
        ? perRacketItems.map((item) => ({ ...item, stringId: ownStringId || null, ownStringText: ownString }))
        : perRacketItems,
    crossesStringId: crossesString ? crossesString.id : null,
    crossesGauge: crossesString ? crossesGauge : null,
  });

  // The string jobs plus any add-ons chosen at checkout.
  const orderItems = () => [...buildItems(), ...addOnCheckoutItems(addOnQty)];
  const checkoutItemsKey = screen === "checkout" && tier ? JSON.stringify(orderItems()) : "";

  const applyDiscountCode = async () => {
    const code = codeInput.trim();
    if (!code || !selectedVendor) return;
    setQuoting(true);
    setCodeError("");
    try {
      const result = await quoteCheckout({ vendorId: selectedVendor.id, items: orderItems(), discountCode: code });
      setQuote(result);
      setDiscountCode(code);
    } catch (err) {
      setCodeError(checkoutErrorMessage(err, "That code couldn't be checked. Try again."));
    } finally {
      setQuoting(false);
    }
  };

  const removeDiscountCode = () => {
    setDiscountCode("");
    setCodeInput("");
    setCodeError("");
  };

  const changeAddOn = (offerId, delta) => {
    setAddOnQty((current) => {
      const next = Math.max(0, Math.min(20, Number(current[offerId] || 0) + delta));
      return { ...current, [offerId]: next };
    });
  };

  // Back from checkout to change the order. Any order already started for payment is
  // dropped from the screen; a new one is made from the edited choices.
  const editOrder = (target) => {
    if (checkoutHandoff) {
      checkoutHandoff.onBack?.();
      return;
    }
    setCheckoutResult(null);
    go(target);
  };

  // Price the order with the API whenever it changes at checkout: the shop's add-ons, the
  // discount, and the total the card will be charged. Signed-out players see the restring
  // price until they sign in, as before.
  useEffect(() => {
    if (!checkoutItemsKey || !isAuthenticated || !selectedVendor || checkoutResult) return undefined;
    let cancelled = false;
    setQuoting(true);
    quoteCheckout({ vendorId: selectedVendor.id, items: JSON.parse(checkoutItemsKey), discountCode: discountCode || null })
      .then((result) => {
        if (!cancelled) setQuote(result);
      })
      .catch((err) => {
        if (cancelled) return;
        const detail = err?.data?.detail;
        if (detail === "add_on_offer_not_found") setAddOnQty({});
        if (detail === "discount_code_invalid" || detail === "discount_code_attempts_exceeded") {
          setDiscountCode("");
          setCodeError(checkoutErrorMessage(err));
          return;
        }
        setQuote(null);
        setError(checkoutErrorMessage(err, "Your order couldn't be priced. Try again."));
      })
      .finally(() => {
        if (!cancelled) setQuoting(false);
      });
    return () => {
      cancelled = true;
    };
  }, [checkoutItemsKey, checkoutResult, discountCode, isAuthenticated, selectedVendor]);

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
        items: orderItems(),
        paymentMethodId,
        discountCode: discountCode || null,
      });
      setCheckoutResult(result);
      setConfirmedOrder(result.order);
      // A code made it free: it's already paid, and there's no card step.
      if (result.comp) {
        void refreshOrders();
        go("confirmation");
      }
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
      setError(checkoutErrorMessage(err));
      return null;
    } finally {
      setBusy(false);
    }
  };

  // Prepared ahead, so the Apple Pay sheet can open straight from the tap; its total follows
  // the quote as add-ons and codes change.
  const applePayAmount = screen === "checkout" && isAuthenticated && !checkoutResult ? totalCents : 0;
  const applePayAmountRef = useRef(applePayAmount);
  applePayAmountRef.current = applePayAmount;
  const applePayWanted = applePayAmount > 0;
  useEffect(() => {
    let cancelled = false;
    setApplePayRequest(null);
    if (!stripePromise || !applePayWanted) return undefined;
    (async () => {
      const stripe = await stripePromise;
      if (!stripe || cancelled) return;
      const request = stripe.paymentRequest({
        country: "US",
        currency: "usd",
        total: { label: "The Tennis Plan", amount: applePayAmountRef.current },
      });
      const canPay = await request.canMakePayment();
      if (!cancelled && canPay?.applePay) setApplePayRequest(request);
    })().catch(() => {
      if (!cancelled) setApplePayRequest(null);
    });
    return () => {
      cancelled = true;
    };
  }, [applePayWanted]);

  useEffect(() => {
    if (applePayRequest && applePayAmount > 0) {
      applePayRequest.update({ total: { label: "The Tennis Plan", amount: applePayAmount } });
    }
  }, [applePayRequest, applePayAmount]);

  useEffect(() => {
    if (!applePayRequest && paymentChoice === "wallet") {
      setPaymentChoice(paymentMethods.length ? "saved" : "new");
    }
  }, [applePayRequest, paymentChoice, paymentMethods.length]);

  // The sheet gives a card; the order is made and charged with it, like a saved card.
  const finishApplePay = async (event) => {
    let completed = false;
    const complete = (status) => {
      if (completed) return;
      completed = true;
      event.complete(status);
    };
    const paymentMethodId = event.paymentMethod.id;
    const result = await startCheckout(paymentMethodId);
    if (result?.comp) {
      complete("success");
      return;
    }
    if (!result?.client_secret) {
      complete("fail");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const stripe = await stripePromise;
      if (!stripe) throw new Error("Stripe is not ready.");
      const confirmation = await stripe.confirmCardPayment(
        result.client_secret,
        { payment_method: paymentMethodId },
        { handleActions: false },
      );
      if (confirmation.error) {
        complete("fail");
        setError(confirmation.error.message || "Payment could not be completed.");
        return;
      }
      complete("success");
      // A bank that asks for an extra check gets it after the sheet closes.
      if (confirmation.paymentIntent?.status === "requires_action") {
        const followUp = await stripe.confirmCardPayment(result.client_secret);
        if (followUp.error) {
          setError(followUp.error.message || "Payment could not be completed.");
          return;
        }
      }
      setConfirmedOrder(result.order);
      await refreshOrders();
      go("confirmation");
    } catch (err) {
      complete("fail");
      setError(err?.message || "Payment could not be completed.");
    } finally {
      setBusy(false);
    }
  };

  // Called straight from the tap: Apple Pay only opens from a user gesture.
  const payWithApplePay = () => {
    const request = applePayRequest;
    if (!request || busy || quoting) return;
    setError("");
    const onPaymentMethod = (event) => {
      request.off("cancel", onCancel);
      void finishApplePay(event);
    };
    const onCancel = () => request.off("paymentmethod", onPaymentMethod);
    request.once("paymentmethod", onPaymentMethod);
    request.once("cancel", onCancel);
    try {
      request.show();
    } catch {
      request.off("paymentmethod", onPaymentMethod);
      request.off("cancel", onCancel);
      setError("Apple Pay couldn't open. Choose another way to pay.");
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

  const selectedStringName = selectedString
    ? `${selectedString.brand || ""} ${selectedString.name || ""}`.trim()
    : stringId === "other"
      ? otherString
      : ownString;
  // Checkout's line items: what the rackets' price is for labor and for string.
  const costSplit = restringCostSplit({ quoteItems: quote?.items || null, localPrices: racketPrices });
  const stringLineLabel = crossesString
    ? `${selectedStringName} / ${crossesString.brand} ${crossesString.name} (hybrid)`
    : checkoutHandoff
      ? "String"
      : adviceRequested || isPresetCompositionTier(tier) || (!selectedString && !needsOtherString)
        ? `${tier?.string_composition ? serviceCompositionLabel(tier.string_composition) : categoryLabel(tier?.string_category)} (stringer’s pick)`
        : needsOtherString
          ? clean(otherString) || "String"
          : selectedStringName || "String";

  // ----- Phone chrome: FeatureNavBar in place of AppNav, bottom nav outside task flows -----
  const goHome = () => {
    setHistory([]);
    setScreen("home");
    setError("");
    setReorderNotice("");
  };
  const STEP_TITLES = {
    wizard: "String quiz",
    recommendation: "Recommendation",
    tier: "Service",
    strings: "Strings",
    quiz: "String quiz",
    quizResult: "Your string",
    vendor: "Choose a stringer",
    profile: selectedVendor?.name || "Stringer",
    config: "String setup",
    rackets: checkoutHandoff ? "Your racket" : `Your racket${quantity > 1 ? "s" : ""}`,
    checkout: "Checkout",
    confirmation: "Order confirmed",
  };
  const featureNav = screen === "home"
    ? {
        backLabel: "Home",
        backTo: "/",
        title: "Restring",
        titleMode: "on-scroll",
        action: (
          <FeatureNavIconButton label="My orders" onClick={() => { void refreshOrders(); go("orders"); }}>
            <ClipboardList size={22} />
          </FeatureNavIconButton>
        ),
      }
    : screen === "orders"
      ? {
          backLabel: "Restring",
          onBack: back,
          title: "My orders",
          action: (
            <FeatureNavIconButton label="Refresh orders" onClick={() => void refreshOrders()} disabled={ordersRefreshing}>
              <RefreshCw size={20} className={ordersRefreshing ? "rsg-spin" : ""} />
            </FeatureNavIconButton>
          ),
        }
      : screen === "rate"
        ? { backLabel: "My orders", onBack: back, title: "Rate your string" }
      : screen === "confirmation"
        ? { backLabel: "Restring", onBack: goHome, title: STEP_TITLES.confirmation }
        : { backLabel: "Back", onBack: back, title: STEP_TITLES[screen] || "" };
  // Booking and checkout are task flows: no tab bar until they're done.
  const showTabBar = !checkoutHandoff && ["home", "orders", "confirmation"].includes(screen);
  const usual = usualSetup(orders);
  const usualPrice = usual ? Number(usual.item?.unit_price_cents || usual.order?.total_cents || 0) : 0;

  return (
    <div className={`dashboard-page restring-page ${screen === "orders" ? "restring-page--orders" : ""}`}>
      <div className="rsg-desktop-nav"><AppNav /></div>
      <FeatureNavBar {...featureNav} />
      <main className={`rsg-shell ${screen === "orders" ? "rsg-shell--wide" : ""} ${showTabBar ? "rsg-shell--tabbar" : ""}`}>
        {screen !== "home" && screen !== "orders" ? (
          <button type="button" className="rsg-back rsg-desktop-only" onClick={back}>
            <ChevronLeft size={18} /> Back
          </button>
        ) : null}

        {error ? <div className="rsg-alert">{error}</div> : null}
        {loading || authLoading ? <div className="rsg-card">Loading restringing options...</div> : null}

        {!loading && screen === "home" && restringV2 ? (
          <RestringEntryV2
            tiers={tiers}
            orders={orders}
            isAuthenticated={isAuthenticated}
            ordersLine={ordersSummaryLine(orders)}
            busy={busy}
            onKnow={() => void openStringPicker()}
            onHelp={() => void openQuiz()}
            onOrders={() => { void refreshOrders(); go("orders"); }}
            onReorder={(entry) => void reorder(entry)}
          />
        ) : null}

        {!loading && screen === "home" && !restringV2 ? (
          <div className="rsg-home rsg-mobile-only">
            <header className="rsg-home-title">
              <h1>Restring</h1>
              <p>Fresh strings, from a stringer near you.</p>
            </header>
            {usual?.href ? (
              <section className="rsg-usual" aria-label="Your usual setup">
                <span className="rsg-usual-label">Your usual</span>
                <b>{usual.line.title}</b>
                <span>{usual.line.detail}</span>
                <span className="rsg-usual-shop">{usual.order.vendor_name}</span>
                <a className="rsg-usual-btn" href={usual.href}>
                  Restring again{usualPrice ? ` · ${formatOrderTotal(usualPrice)}` : ""}
                </a>
              </section>
            ) : null}
            <div className="rsg-list">
              <button type="button" className="rsg-list-row" onClick={() => go("tier")}>
                <span className="rsg-list-icon rsg-list-icon--purple"><Target size={20} /></span>
                <span className="rsg-list-text"><b>I know what I want</b><small>Pick a service and string</small></span>
                <ChevronRight size={20} className="rsg-list-chevron" />
              </button>
              <button type="button" className="rsg-list-row" onClick={() => { setWizardIndex(0); setAnswers({}); go("wizard"); }}>
                <span className="rsg-list-icon rsg-list-icon--amber"><Lightbulb size={20} /></span>
                <span className="rsg-list-text"><b>Help me choose a string</b><small>4 quick questions</small></span>
                <ChevronRight size={20} className="rsg-list-chevron" />
              </button>
            </div>
            <div className="rsg-list">
              <button type="button" className="rsg-list-row" onClick={() => { void refreshOrders(); go("orders"); }}>
                <span className="rsg-list-icon rsg-list-icon--green"><ClipboardList size={20} /></span>
                <span className="rsg-list-text"><b>My orders</b><small>{isAuthenticated ? ordersSummaryLine(orders) : "Sign in to see your restrings"}</small></span>
                <ChevronRight size={20} className="rsg-list-chevron" />
              </button>
            </div>
          </div>
        ) : null}

        {!loading && screen === "home" && !restringV2 ? (
          <div className="rsg-desktop-only">
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
          </div>
        ) : null}

        {screen === "strings" && restringV2 ? (
          <RestringStringPicker
            tiers={tiers}
            catalog={pickerCatalog}
            vendor={pickerShop}
            initialPick={stringPick}
            onContinue={continueFromPicker}
          />
        ) : null}

        {screen === "quiz" && restringV2 ? (
          <RestringQuizQuestion index={quizIndex} answers={quizAnswers} levelFromRating={quizLevel} onAnswer={answerQuiz} />
        ) : null}

        {screen === "quizResult" && restringV2 ? (
          <RestringQuizResult result={quizResult} vendor={pickerShop} onChoose={chooseFromQuiz} onSeeAll={() => go("strings")} />
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
            {reorderNotice ? <div className="rsg-alert" role="status">{reorderNotice}</div> : null}
            {isPresetCompositionTier(tier) ? (
              <p>Included strings: {serviceCompositionLabel(tier.string_composition)}. Your stringer will choose the matching setup.</p>
            ) : isOwnTier(tier) ? (
              <Field label="String you are bringing">
                <div className="rsg-own-box">
                  <input
                    value={ownString}
                    onChange={(event) => {
                      setOwnString(event.target.value);
                      setOwnStringId(String(matchOwnString(event.target.value, allStrings.rows)?.id ?? ""));
                      setOwnSearch({ active: 0 });
                    }}
                    onFocus={() => setOwnSearch({ active: 0 })}
                    // After a tap on a result has landed.
                    onBlur={() => window.setTimeout(() => setOwnSearch(null), 150)}
                    onKeyDown={(event) => {
                      const results = ownSearch ? ownStringResults(ownString, ownStringId, allStrings.rows) : [];
                      if (!results.length) return;
                      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                        event.preventDefault();
                        const step = event.key === "ArrowDown" ? 1 : results.length - 1;
                        setOwnSearch({ active: (ownSearch.active + step) % results.length });
                      } else if (event.key === "Enter") {
                        event.preventDefault();
                        const result = results[ownSearch.active] || results[0];
                        setOwnString(result.name);
                        setOwnStringId(result.id);
                        setOwnSearch(null);
                      } else if (event.key === "Escape") {
                        setOwnSearch(null);
                      }
                    }}
                    role="combobox"
                    aria-expanded={Boolean(ownSearch)}
                    aria-autocomplete="list"
                    autoComplete="off"
                    placeholder="Start typing, e.g. RPM Blast"
                  />
                  {ownSearch && ownStringResults(ownString, ownStringId, allStrings.rows).length ? (
                    <ul className="rsg-own-results" role="listbox">
                      {ownStringResults(ownString, ownStringId, allStrings.rows).map((result, index) => (
                        <li
                          key={result.id}
                          role="option"
                          aria-selected={index === ownSearch.active}
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => {
                            setOwnString(result.name);
                            setOwnStringId(result.id);
                            setOwnSearch(null);
                          }}
                        >
                          {result.name}
                          {result.inStock ? <em>Stocked here</em> : null}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
                {allStrings.rows.length > 0 && !(ownSearch && ownStringResults(ownString, ownStringId, allStrings.rows).length) && ownStringHint(ownString, ownStringId, allStrings.rows) ? (
                  <small>{ownStringHint(ownString, ownStringId, allStrings.rows)}</small>
                ) : null}
              </Field>
            ) : selectedString && !editingString && !needsOtherString ? (
              <>
                <span className="rsg-label">String</span>
                <div className="rsg-picked">
                  <span>
                    <b>{selectedStringName}</b>
                    <small>
                      {formatMoneyCents(restringUnitPrice(tier, selectedString).unitCents)}
                      {selectedGaugeOptions.length === 1 ? ` · gauge ${selectedGaugeOptions[0]}` : ""}
                    </small>
                  </span>
                  <button type="button" className="rsg-link-btn" onClick={changeString}>Change</button>
                </div>
              </>
            ) : (
              <>
                <span className="rsg-label">String</span>
                <div className="rsg-chips">
                  {catalog.map((item) => (
                    <button key={item.id} type="button" className={String(stringId || catalog[0]?.id) === String(item.id) ? "is-active" : ""} onClick={() => { setStringId(String(item.id)); setGauge(defaultGaugeForString(item)); }}>
                      {item.brand} {item.name}
                      {item.restring_price_cents != null ? ` · ${formatMoneyCents(item.restring_price_cents)}` : ""}
                    </button>
                  ))}
                  <button type="button" className={needsOtherString ? "is-active" : ""} onClick={() => setStringId("other")}>Other...</button>
                </div>
                {needsOtherString ? <Field label="Describe the string"><input value={otherString} onChange={(event) => setOtherString(event.target.value)} placeholder="Brand and model" /><small>Required for Other. Subject to availability; your stringer confirms at drop-off.</small></Field> : null}
              </>
            )}
            {!isPresetCompositionTier(tier) ? (
              <>
                {/* One stocked gauge needs no choosing: it shows with the string above. */}
                {selectedGaugeOptions.length > 1 || !selectedString || editingString ? (
                  <>
                    <span className="rsg-label">Gauge</span>
                    <div className="rsg-tiles">
                      {selectedGaugeOptions.map((item) => <TileButton key={item} active={gauge === item && !adviceRequested} disabled={adviceRequested} onClick={() => setGauge(item)}><small>gauge</small><b>{item}</b></TileButton>)}
                    </div>
                  </>
                ) : null}
                {canHybrid && hybridStrings.length && !hybridOpen && !crossesString ? (
                  <button type="button" className="rsg-link-btn rsg-link-btn--block" onClick={() => setHybridOpen(true)}>
                    Use a different string for the crosses (hybrid)
                  </button>
                ) : null}
                {canHybrid && hybridStrings.length && (hybridOpen || crossesString) ? (
                  <>
                    <span className="rsg-label">Crosses string (hybrid)</span>
                    <div className="rsg-chips">
                      {hybridStrings.map((item) => (
                        <button key={item.id} type="button" className={String(crossesId) === String(item.id) ? "is-active" : ""} onClick={() => { setCrossesId(String(item.id)); setCrossesGauge(defaultGaugeForString(item)); }}>
                          {item.brand} {item.name}
                        </button>
                      ))}
                    </div>
                    <button type="button" className="rsg-link-btn rsg-link-btn--block" onClick={() => { setCrossesId(""); setCrossesGauge(""); setHybridOpen(false); }}>
                      Same string for the crosses
                    </button>
                    {crossesString ? (
                      <>
                        <small className="rsg-hint">Hybrid: stringing plus half of each string’s price.</small>
                        <span className="rsg-label">Crosses gauge</span>
                        <div className="rsg-tiles">
                          {catalogGaugesForString(crossesString).map((item) => <TileButton key={item} active={crossesGauge === item} onClick={() => setCrossesGauge(item)}><small>gauge</small><b>{item}</b></TileButton>)}
                        </div>
                      </>
                    ) : null}
                  </>
                ) : null}
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
              <TileButton active={quantity > 4} onClick={() => setQuantity((current) => (current > 4 ? current : 5))}><small>rackets</small><b>5+</b></TileButton>
            </div>
            {quantity > 4 ? (
              <div className="rsg-count">
                <button type="button" aria-label="One racket fewer" onClick={() => setQuantity((current) => Math.max(1, current - 1))}><Minus size={18} /></button>
                <b aria-live="polite">{quantity} rackets</b>
                <button type="button" aria-label="One racket more" disabled={quantity >= MAX_RACKETS} onClick={() => setQuantity((current) => Math.min(MAX_RACKETS, current + 1))}><Plus size={18} /></button>
              </div>
            ) : null}
            {quantity >= MAX_RACKETS ? <p className="rsg-fine">Up to {MAX_RACKETS} rackets in one order. Place another order for more.</p> : null}
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
              <div className="rsg-checkout-head">
                <h1>Checkout</h1>
                {!checkoutResult ? (
                  <div className="rsg-edit-links">
                    {checkoutHandoff ? (
                      <button type="button" onClick={() => editOrder()}><Pencil size={14} aria-hidden="true" /> Edit</button>
                    ) : (
                      <>
                        <button type="button" onClick={() => editOrder("config")}><Pencil size={14} aria-hidden="true" /> String</button>
                        <button type="button" onClick={() => editOrder("rackets")}><Plus size={14} aria-hidden="true" /> Rackets</button>
                      </>
                    )}
                  </div>
                ) : null}
              </div>
              <div className="rsg-summary">
                <b>{tier.name} · x{quantity}</b>
                <span>{checkoutHandoff ? checkoutHandoff.summary : adviceRequested ? "Specs decided at drop-off" : `${isPresetCompositionTier(tier) ? serviceCompositionLabel(tier.string_composition) : crossesString ? `${selectedStringName} ${gauge} mains / ${crossesString.brand} ${crossesString.name} ${crossesGauge} crosses` : `${selectedStringName || "String"} · gauge ${gauge}`} · ${splitTension ? `${tension}/${crosses}` : tension} lbs`}</span>
                <span>{selectedVendor?.name} · {selectedVendor?.address}</span>
                {orderNotes ? <span>{orderNotes}</span> : null}
                {/* Line items: stringing labor, the string, add-ons, any discount, then sales tax. */}
                <div className="rsg-lines">
                  <span><span>Stringing{costSplit.rackets > 1 ? ` × ${costSplit.rackets}` : ""}</span><span>{formatMoneyCents(costSplit.laborCents)}</span></span>
                  {costSplit.stringCents > 0 ? (
                    <span><span>{stringLineLabel}{costSplit.rackets > 1 ? ` × ${costSplit.rackets}` : ""}</span><span>{formatMoneyCents(costSplit.stringCents)}</span></span>
                  ) : null}
                  {pricing ? (quote.items || []).filter((item) => item.add_on_offer_id).map((item) => (
                    <span key={item.add_on_offer_id}><span>{item.label} × {item.item_qty}</span><span>{formatMoneyCents(item.unit_price_cents * item.item_qty)}</span></span>
                  )) : null}
                  {pricing?.discount_amount_cents > 0 ? (
                    <span className="rsg-discount-line"><span>{pricing.discount_label || "Discount"}</span><span>−{formatMoneyCents(pricing.discount_amount_cents)}</span></span>
                  ) : null}
                  {(pricing ? pricing.tax_cents : taxCents) > 0 ? (
                    <span><span>Sales tax</span><span>{formatMoneyCents(pricing ? pricing.tax_cents : taxCents)}</span></span>
                  ) : null}
                </div>
                <strong className="rsg-total"><span>Total</span><span>{totalLabel}</span></strong>
              </div>
            </section>
            {isAuthenticated && !checkoutResult && quote?.add_on_offers?.length ? (
              <section className="rsg-card">
                <h2>Add to your order</h2>
                <div className="rsg-addons">
                  {quote.add_on_offers.map((offer) => {
                    const qty = Number(addOnQty[offer.id] || 0);
                    return (
                      <div className="rsg-addon" key={offer.id}>
                        {offer.image_url ? (
                          <img className="rsg-addon__img" src={offer.image_url} alt="" />
                        ) : (
                          <span className="rsg-addon__img" aria-hidden="true"><Package size={20} /></span>
                        )}
                        <span className="rsg-addon__text">
                          <b>{offer.name}</b>
                          <small>
                            {formatMoneyCents(offer.bundle_price_cents)}
                            {offer.regular_price_cents > offer.bundle_price_cents ? <s>{formatMoneyCents(offer.regular_price_cents)}</s> : null}
                            {" "}with your restring
                          </small>
                        </span>
                        <span className="rsg-stepper">
                          {qty > 0 ? (
                            <>
                              <button type="button" aria-label={`One fewer ${offer.name}`} disabled={busy} onClick={() => changeAddOn(offer.id, -1)}><Minus size={16} /></button>
                              <b aria-live="polite">{qty}</b>
                            </>
                          ) : null}
                          <button type="button" aria-label={`Add ${offer.name}`} disabled={busy || qty >= 20} onClick={() => changeAddOn(offer.id, 1)}><Plus size={16} /></button>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </section>
            ) : null}
            {isAuthenticated && !checkoutResult ? (
              <section className="rsg-card rsg-code">
                {discountCode ? (
                  <div className="rsg-code__applied">
                    <span>
                      <b>{pricing?.discount_label || "Discount"}</b>
                      <small>Code {discountCode.toUpperCase()} applied{pricing?.discount_amount_cents ? ` · −${formatMoneyCents(pricing.discount_amount_cents)}` : ""}</small>
                    </span>
                    <button type="button" onClick={removeDiscountCode}>Remove</button>
                  </div>
                ) : (
                  <>
                    <label className="rsg-label" htmlFor="rsg-discount-code">Discount code</label>
                    <form className="rsg-code__row" onSubmit={(event) => { event.preventDefault(); void applyDiscountCode(); }}>
                      <input
                        id="rsg-discount-code"
                        value={codeInput}
                        onChange={(event) => { setCodeInput(event.target.value); setCodeError(""); }}
                        autoCapitalize="characters"
                        autoComplete="off"
                        spellCheck={false}
                        placeholder="Enter code"
                      />
                      <button type="submit" disabled={!codeInput.trim() || quoting}>Apply</button>
                    </form>
                    {codeError ? <p className="rsg-code__error" role="alert">{codeError}</p> : null}
                  </>
                )}
              </section>
            ) : null}
            {!isAuthenticated ? (
              <section className="rsg-card">
                <h2>Create an account to track your order</h2>
                <p>Checkout is the only login wall. You’ll get status tracking and SMS pickup updates.</p>
                <button type="button" className="rsg-primary" onClick={startCheckout}>Sign up / log in</button>
              </section>
            ) : (
              <section className="rsg-card">
                {!checkoutResult && pricing && totalCents === 0 ? (
                  // A code made it free: nothing to pay, so no card step.
                  <button type="button" className="rsg-primary" disabled={busy || quoting} onClick={() => void startCheckout()}>
                    {busy ? "Placing order..." : "Place order · Free"}
                  </button>
                ) : !checkoutResult ? (
                  <>
                    {paymentMethodsLoading ? <p>Loading saved payment methods...</p> : null}
                    {paymentMethods.length || applePayRequest ? (
                      <>
                        <span className="rsg-label">Payment method</span>
                        <div className="rsg-pay-methods">
                          {applePayRequest ? (
                            <button
                              type="button"
                              className={`rsg-pay-method ${paymentChoice === "wallet" ? "is-active" : ""}`}
                              onClick={() => setPaymentChoice("wallet")}
                            >
                              <Wallet size={18} />
                              <span><b>Apple Pay</b><small>Pay with Apple Pay on this device</small></span>
                            </button>
                          ) : null}
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
                    {paymentChoice === "wallet" && applePayRequest ? (
                      <button type="button" className="rsg-primary" disabled={busy || quoting} onClick={payWithApplePay}>
                        {busy ? "Processing..." : `Pay ${totalLabel} with Apple Pay`}
                      </button>
                    ) : paymentChoice === "saved" && paymentMethods.length ? (
                      <button type="button" className="rsg-primary" disabled={busy || quoting || !selectedPaymentMethodId} onClick={payWithSavedMethod}>
                        {busy ? "Processing..." : `Pay ${totalLabel}`}
                      </button>
                    ) : (
                      <button type="button" className="rsg-primary" disabled={busy || quoting} onClick={() => void startCheckout()}>
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
                <p><b>1</b> Drop off at {selectedVendor?.address}.{vendorHoursSummary(selectedVendor?.hours) ? ` Hours: ${vendorHoursSummary(selectedVendor.hours)}.` : ""}</p>
                <p><b>2</b> {selectedVendor?.name} strings it {adviceRequested ? "with specs agreed at drop-off" : "with your selected specs"}.</p>
                <p><b>3</b> We text you when it is ready.</p>
              </div>
            </section>
            <button type="button" className="rsg-secondary" onClick={() => { void refreshOrders(); go("orders"); }}>View my orders</button>
          </>
        ) : null}

        {screen === "rate" ? (
          <RateStringScreen
            itemId={rateItemId}
            myStrings={myStrings}
            loading={authLoading || ordersRefreshing || (isAuthenticated && !myStrings && !ordersUpdatedAt)}
            signedIn={isAuthenticated}
            onSignIn={() => authDrawer.openAuth({
              mode: "signin",
              reason: "Log in to rate your string.",
              onSuccess: () => void refreshOrders(),
            })}
            onRate={rateString}
            onSaveProfile={saveProfile}
            onOrders={() => { void refreshOrders(); go("orders"); }}
          />
        ) : null}

        {screen === "orders" ? (
          <MyOrdersScreen
            orders={orders}
            updatedAt={ordersUpdatedAt}
            refreshing={ordersRefreshing}
            onRefresh={refreshOrders}
            onBack={back}
            onCancel={async (orderId) => { await cancelOrder(orderId); await refreshOrders(); }}
            onStartNew={() => go("home")}
            myStrings={myStrings}
            onRateString={rateString}
            onSaveProfile={saveProfile}
          />
        ) : null}
      </main>
      {showTabBar ? <MobileHomeBottomNav /> : null}
      <style>{`
        .restring-page{background:#f4f5f7;min-height:100vh}
        .rsg-shell{max-width:760px;margin:0 auto;padding:18px 16px 96px;color:var(--coach-color-heading);font-family:inherit}.rsg-shell--wide{max-width:1080px;width:100%;box-sizing:border-box}
        .rsg-mobile-only{display:none}
        @keyframes rsg-spin{to{transform:rotate(360deg)}}.rsg-spin{animation:rsg-spin .9s linear infinite}
        @media (max-width:820px){
          .rsg-desktop-nav,.rsg-desktop-only{display:none!important}
          .rsg-mobile-only{display:block}
          .restring-page,.restring-page--orders{gap:0}
          .rsg-shell,.restring-page--orders .rsg-shell{padding:12px 0 32px;width:100%;box-sizing:border-box}
          .rsg-shell--tabbar{padding-bottom:calc(84px + var(--safe-bottom,env(safe-area-inset-bottom)))!important}
          .rsg-home-title{padding:2px 2px 16px}.rsg-home-title h1{margin:0;font-size:34px;line-height:1.1;font-weight:800;letter-spacing:-.02em}.rsg-home-title p{margin:4px 0 0;color:#6b7280;font-size:15px}
          .rsg-usual{display:flex;flex-direction:column;gap:3px;margin-bottom:16px;padding:18px;border-radius:20px;background:linear-gradient(145deg,#3b0764,#5b21b6);color:#fff;box-shadow:0 12px 28px rgba(59,7,100,.28)}
          .rsg-usual-label{font-size:12px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#ddd6fe}
          .rsg-usual b{font-size:20px;font-weight:800;margin-top:2px}.rsg-usual span{font-size:14px;color:#ede9fe}.rsg-usual .rsg-usual-shop{font-size:13px;color:#c4b5fd}
          .rsg-usual-btn{align-self:flex-start;margin-top:12px;padding:11px 16px;border-radius:12px;background:#c4ec52;color:#1a2e05;font-weight:800;font-size:15px;text-decoration:none}
          .rsg-list{margin-bottom:16px;border-radius:16px;background:#fff;border:1px solid #edf0f4;overflow:hidden}
          .rsg-list-row{width:100%;display:flex;align-items:center;gap:12px;padding:12px 14px;border:0;background:#fff;text-align:left;color:#111827;font:inherit}
          .rsg-list-row+.rsg-list-row{border-top:1px solid #f1f2f4}
          .rsg-list-row:active{background:#f5f6f8}
          .rsg-list-icon{flex:0 0 36px;width:36px;height:36px;border-radius:10px;display:flex;align-items:center;justify-content:center}
          .rsg-list-icon--purple{background:#ede9fe;color:#6d28d9}.rsg-list-icon--amber{background:#fef3c7;color:#b45309}.rsg-list-icon--green{background:#dcfce7;color:#15803d}
          .rsg-list-text{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px}.rsg-list-text b{font-size:16px;font-weight:700}.rsg-list-text small{font-size:13.5px;color:#6b7280;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
          .rsg-list-chevron{flex-shrink:0;color:#c0c4cc}
        }.restring-page--orders{gap:16px}.restring-page--orders .rsg-shell{padding-top:9px}
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
        .rsg-own-box{position:relative}.rsg-own-results{position:absolute;top:calc(100% + 4px);left:0;right:0;z-index:20;max-height:260px;overflow-y:auto;margin:0;padding:4px;list-style:none;background:#fff;border:1px solid #e5e7eb;border-radius:14px;box-shadow:0 12px 28px rgba(16,24,40,.14);font-weight:500}.rsg-own-results li{display:flex;align-items:center;justify-content:space-between;gap:10px;min-height:44px;padding:8px 10px;border-radius:10px;cursor:pointer}.rsg-own-results li[aria-selected="true"],.rsg-own-results li:hover{background:#f5f0ff}.rsg-own-results em{color:#6d28d9;font-size:12px;font-style:normal;font-weight:700;white-space:nowrap}
        .rsg-racket{border:1px solid #eef2f7;border-radius:16px;padding:12px}.rsg-summary{display:grid;gap:6px}.rsg-summary span{color:#6b7280}.rsg-summary strong{font-size:24px}.rsg-payment{display:grid;gap:12px}.rsg-pay-methods{display:grid;gap:9px;margin-top:8px}.rsg-pay-method{width:100%;display:flex;align-items:center;gap:10px;text-align:left;border:1px solid #e5e7eb;background:#fff;border-radius:15px;padding:12px}.rsg-pay-method.is-active{border-color:#7c3aed;background:#f5f0ff}.rsg-pay-method span{display:grid;gap:2px}.rsg-pay-method small{color:#6b7280}.rsg-fine{font-size:12px!important;text-align:center}.rsg-alert,.rsg-error{background:#fef2f2;color:#b91c1c;border:1px solid #fecaca;border-radius:14px;padding:12px;margin-bottom:12px}.rsg-done{text-align:center}.rsg-done svg{color:#059669;margin:auto}.rsg-steps p{display:flex;gap:10px}.rsg-steps b{display:inline-flex;width:26px;height:26px;border-radius:999px;align-items:center;justify-content:center;background:#ede9fe;color:#6d28d9}.rsg-order-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:10px}.rsg-status-pill{display:inline-grid;gap:1px;border-radius:12px;background:#eef2ff;color:#4338ca;padding:6px 10px;font-weight:900;font-size:13px}.rsg-status-pill--payment{background:#ecfdf5;color:#047857}.rsg-status-pill small{color:inherit;opacity:.72;font-size:10px;text-transform:uppercase;letter-spacing:.04em}
        @media (max-width:640px){.rsg-shell{padding-inline:12px}.rsg-hero h1,.rsg-card h1{font-size:30px}.rsg-vendor,.rsg-actions,.rsg-loc{align-items:stretch;flex-direction:column}.rsg-icon-btn{width:100%}}
        .rsg-checkout-head{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}.rsg-checkout-head h1{margin:0}
        .rsg-edit-links{display:flex;gap:8px}.rsg-edit-links button{display:inline-flex;align-items:center;gap:5px;min-height:36px;padding:0 12px;border:1px solid var(--color-primary-border);border-radius:9999px;background:var(--coach-color-surface);color:var(--color-primary-dark);font-size:13px;font-weight:700;cursor:pointer}
        .rsg-discount-line{color:var(--coach-color-success)!important;font-weight:500}
        .rsg-hint{display:block;margin-top:8px;color:var(--coach-color-subtle);font-size:13px}.rsg-lines{display:grid;gap:6px;margin-top:6px;padding-top:8px;border-top:1px solid var(--coach-color-divider)}.rsg-lines>span,.rsg-total{display:flex;justify-content:space-between;gap:12px}.rsg-lines>span>span:first-child{min-width:0;overflow-wrap:anywhere}.rsg-total{padding-top:8px;border-top:1px solid var(--coach-color-divider)}.rsg-summary .rsg-total span{color:var(--coach-color-heading)}.rsg-picked{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:8px;padding:12px 14px;border:1px solid var(--color-primary-border);border-radius:14px;background:var(--color-primary-tint)}.rsg-picked span{display:grid;gap:2px;min-width:0}.rsg-picked b{overflow-wrap:anywhere}.rsg-picked small{color:var(--coach-color-subtle);font-size:13px}.rsg-link-btn{flex-shrink:0;min-height:44px;padding:0 4px;border:0;background:none;color:var(--color-primary-dark);font-weight:700;cursor:pointer}.rsg-link-btn--block{display:block;margin-top:10px;text-align:left}.rsg-addons{display:grid;gap:10px;margin-top:10px}.rsg-addon{display:flex;align-items:center;gap:12px;padding:10px;border:1px solid var(--coach-color-border);border-radius:14px}
        .rsg-addon__img{display:inline-flex;flex:0 0 48px;width:48px;height:48px;align-items:center;justify-content:center;border-radius:10px;background:var(--color-primary-tint);color:var(--color-primary);object-fit:cover}
        .rsg-addon__text{display:flex;min-width:0;flex:1;flex-direction:column}.rsg-addon__text b{font-size:15px;overflow-wrap:break-word}.rsg-addon__text small{color:var(--coach-color-subtle);font-size:13px}.rsg-addon__text s{margin-left:6px;color:var(--coach-color-muted)}
        .rsg-stepper,.rsg-count{display:inline-flex;align-items:center;gap:8px;flex-shrink:0}.rsg-stepper button,.rsg-count button{display:inline-flex;width:36px;height:36px;align-items:center;justify-content:center;border:1px solid var(--color-primary-border);border-radius:9999px;background:var(--coach-color-surface);color:var(--color-primary-dark);cursor:pointer}.rsg-stepper button:disabled,.rsg-count button:disabled{opacity:.45;cursor:default}.rsg-stepper b{min-width:18px;text-align:center}
        .rsg-count{display:flex;justify-content:center;gap:16px;margin:4px 0 8px}.rsg-count b{font-size:18px}
        .rsg-code .rsg-label{margin-top:0}.rsg-code__row{display:flex;gap:8px;margin-top:8px}.rsg-code__row input{flex:1;min-width:0;border:1px solid var(--coach-color-border);border-radius:14px;padding:12px;text-transform:uppercase}.rsg-code__row button,.rsg-code__applied button{min-height:44px;padding:0 18px;border:1px solid var(--color-primary-border);border-radius:9999px;background:var(--coach-color-surface);color:var(--color-primary-dark);font-weight:700;cursor:pointer}.rsg-code__row button:disabled{opacity:.5;cursor:default}
        .rsg-code__error{margin:8px 0 0;color:#b91c1c;font-size:14px}.rsg-code__applied{display:flex;align-items:center;justify-content:space-between;gap:12px}.rsg-code__applied span{display:grid;gap:2px}.rsg-code__applied small{color:var(--coach-color-success)}
      `}</style>
    </div>
  );
}
