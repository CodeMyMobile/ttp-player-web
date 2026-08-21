import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Elements, ExpressCheckoutElement, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ClipboardList,
  CreditCard,
  Lightbulb,
  MapPin,
  MessageCircle,
  Minus,
  Package,
  Phone,
  Plus,
  RefreshCw,
  ShoppingBag,
  Star,
  Target,
  X,
} from "lucide-react";
import MobileHomeBottomNav from "../components/MobileHomeBottomNav";
import { useAuth } from "../context/AuthContext.jsx";
import { useAuthDrawer } from "../context/AuthDrawerContext.jsx";
import {
  brandsForMaterial,
  buildCheckoutItems,
  categoryLabel,
  deriveTier,
  filterCatalog,
  formatMoneyCents,
  GAUGES,
  highlightMatch,
  isHybridCategory,
  lbsToKg,
  loadCatalog,
  normalizePaymentMethods,
  orderStatusLabel,
  paymentStatusLabel,
  recommendStringCategory,
} from "./playerFlow.js";
import {
  assembleVendorCatalog,
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
];

const tierSub = (tier) => ({
  syn_gut: "Reliable all-rounder",
  std_multi: "Comfort and power",
  prem_multi: "Top comfort and feel",
  std_poly: "Spin and durability",
  prem_poly: "Tour-level control",
}[tier?.string_category] || "You supply the string");

const clean = (value) => String(value || "").trim();
const isOwnTier = (tier) => tier && tier.string_category === null;

// Material filter buckets (must match materialFromCategory's output ids).
const MATERIALS = [
  { id: "all", label: "All" },
  { id: "poly", label: "Poly" },
  { id: "multi", label: "Multi" },
  { id: "syn gut", label: "Syn gut" },
  { id: "nat gut", label: "Natural gut" },
  { id: "hybrid", label: "Hybrid" },
];

const rowGauges = (row) => (Array.isArray(row.gauges) ? row.gauges : row.gauge != null && row.gauge !== "" ? [row.gauge] : []);

const wholeLbs = (value) => (Number.isFinite(Number(value)) ? String(Math.round(Number(value))) : "");

const relativeWhen = (value) => {
  if (!value) return "";
  const then = new Date(value).getTime();
  if (!Number.isFinite(then)) return "";
  const days = Math.max(0, Math.round((Date.now() - then) / 86400000));
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  const weeks = Math.round(days / 7);
  if (weeks < 5) return `${weeks} week${weeks > 1 ? "s" : ""} ago`;
  const months = Math.max(1, Math.round(days / 30));
  return `${months} month${months > 1 ? "s" : ""} ago`;
};

// Chrome model: section screens keep the app bottom nav; order-flow screens hide it
// and get an X + a 6-step progress bar. The app header never appears inside restringing.
const SECTION_SCREENS = new Set(["home", "stringers", "orders"]);
const FLOW_STEP = { mode: 1, search: 2, own: 2, vendor: 3, config: 4, rackets: 5, checkout: 6 };
const SCREEN_TITLES = {
  home: "Restring",
  stringers: "Find a stringer",
  orders: "My orders",
  mode: "New order",
  search: "Choose a string",
  own: "Your string",
  vendor: "Choose a stringer",
  profile: "Stringer",
  config: "Your setup",
  rackets: "Your rackets",
  checkout: "Review & pay",
  confirmation: "Order placed",
  tier: "Choose a service",
  wizard: "Help me choose",
  recommendation: "Our pick",
};

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

export default function RestringingPlayerFlow() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, loading: authLoading, logout } = useAuth();
  const authDrawer = useAuthDrawer();
  const [screen, setScreen] = useState("home");
  const [, setHistory] = useState([]);
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
  const [, setServiceMode] = useState(null); // "supplied" | "own" — asked first so results can price
  const [searchPrefill, setSearchPrefill] = useState(""); // seeds the string search (reorder / miss recovery)
  // String-first search: one merged catalog (all string tiers for the vendor), assembled
  // once and filtered client-side per keystroke.
  const [searchCatalog, setSearchCatalog] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMaterial, setSearchMaterial] = useState("all");
  const [searchBrand, setSearchBrand] = useState("all");
  const catalogLoadStarted = useRef(false); // load-once guard (a ref, so it can't re-trigger the effect)
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
  const needsOtherString = Boolean(tier && !isOwnTier(tier) && (stringId === "other" || catalog.length === 0));
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

  // Reset scroll on every screen change so a screen never opens mid-content
  // (the sticky nav header stays pinned regardless).
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [screen]);

  // Assemble the merged catalog once. loadCatalog ALWAYS resolves, so setSearchLoading(false)
  // is guaranteed to run. The load-once guard is a ref (not state) so setting the loading flag
  // can't re-trigger this effect and cancel its own resolution (the original hang). No
  // mounted-ref guard: React 19 no-ops setState after unmount, and a mounted ref breaks under
  // StrictMode's mount/unmount/remount — which was leaving loading stuck at "loading…".
  const loadSearchCatalog = useCallback(() => {
    const vendor = allVendors[0] || vendors[0] || null;
    if (!vendor || !tiers.length) return;
    catalogLoadStarted.current = true;
    setSearchLoading(true);
    setSearchError("");
    loadCatalog(() => assembleVendorCatalog({ vendorId: vendor.id, tiers })).then((result) => {
      setSearchCatalog(result.catalog);
      setSearchError(result.error || "");
      setSearchLoading(false);
      if (import.meta.env.DEV) {
        const sample = result.catalog[0] || {};
        // Dev-only: answers the live row-shape question (count / gauges / hybrid comp).
        // console.log (not .debug) so it isn't hidden by Chrome's Verbose filter.
        console.log(`%c[restring] assembled ${result.catalog.length} strings`, "color:#7c3aed;font-weight:700", {
          error: result.error,
          sampleRow: sample,
          sampleKeys: Object.keys(sample),
          withGauges: result.catalog.filter((r) => Array.isArray(r.gauges) || (r.gauge != null && r.gauge !== "")).length,
          withHybridComposition: result.catalog.filter((r) => r.mains != null || r.crosses != null).length,
        });
        // Dev-only: compare against the BARE catalog (no service_tier_id). If this returns
        // strings while the per-tier calls didn't, the strings aren't tier-scoped and the
        // per-tier assembly is the bug (should fetch bare + derive category from the row).
        listVendorStrings({ vendorId: vendor.id })
          .then((data) => {
            const bare = (data && data.catalog) || [];
            console.log(`%c[restring] BARE catalog (no service_tier_id): ${bare.length}`, "color:#c026d3;font-weight:700", { sampleRow: bare[0] || null });
          })
          .catch((err) => console.log("[restring] BARE catalog error", err?.status || err));
      }
    });
  }, [allVendors, vendors, tiers]);

  useEffect(() => {
    if (screen === "search" && !catalogLoadStarted.current) loadSearchCatalog();
  }, [screen, loadSearchCatalog]);

  const retrySearchCatalog = () => {
    catalogLoadStarted.current = false;
    loadSearchCatalog();
  };

  // Seed the search box from a reorder / miss prefill the first time search opens.
  useEffect(() => {
    if (screen === "search" && searchPrefill) {
      setSearchQuery(searchPrefill);
      setSearchPrefill("");
    }
  }, [screen, searchPrefill]);

  // Demand signal for strings no stringer stocks. The logging endpoint does not
  // exist yet, so this is a debounced no-op until the backend adds it.
  useEffect(() => {
    if (screen !== "search") return undefined;
    const q = searchQuery.trim();
    if (q.length < 3 || filterCatalog(searchCatalog, { query: searchQuery }).length) return undefined;
    const timer = setTimeout(() => { /* captureSearchMiss(q) — no-op until endpoint exists */ }, 700);
    return () => clearTimeout(timer);
  }, [screen, searchQuery, searchCatalog]);

  useEffect(() => {
    if (!tier || !selectedVendor) return;
    let cancelled = false;
    listVendorStrings({ vendorId: selectedVendor.id, serviceTierId: tier.id })
      .then((data) => {
        if (cancelled) return;
        const rows = data.catalog || [];
        setCatalog(rows);
        // Keep a string already chosen in the string-first search if it's valid here;
        // otherwise default to the first row (or free-text "other").
        setStringId((current) =>
          current && rows.some((row) => String(row.id) === String(current))
            ? current
            : rows[0]?.id ? String(rows[0].id) : "other",
        );
      })
      .catch(() => {
        if (!cancelled) setCatalog([]);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedVendor, tier]);

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
      go("profile");
    } finally {
      setBusy(false);
    }
  };

  const validateConfig = () => {
    if (!tier) return false;
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
    selectedStringId: adviceRequested ? null : needsOtherString ? null : stringId || catalog[0]?.id || null,
    customStringText: adviceRequested ? null : needsOtherString ? otherString : null,
    ownStringText: isOwnTier(tier) ? ownString : null,
    gauge,
    tensionMains: tension,
    tensionCrosses: splitTension ? crosses : tension,
    adviceRequested,
    racketMakeModel,
    orderNotes,
    quantity,
    setupMode,
    perRacketItems,
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

  const inSection = SECTION_SCREENS.has(screen);
  const isTerminal = screen === "confirmation";
  const flowStep = FLOW_STEP[screen] || 0;
  const navTitle = SCREEN_TITLES[screen] || "Restring";
  const showBack = !isTerminal;
  const showClose = !inSection && !isTerminal; // X only exists to bail out of an order
  const showProgress = flowStep > 0;

  const exitToHome = () => {
    setHistory([]);
    setScreen("home");
    setError("");
  };
  const onHeaderBack = () => {
    if (screen === "home") {
      navigate("/"); // Back on the Restring landing returns to app home
      return;
    }
    back();
  };

  // Reorder card: the player's most recent order (returning = there is one).
  const lastOrder = orders[0] || null;
  const lastOrderItem = lastOrder ? (lastOrder.items || [])[0] || null : null;
  const isReturning = Boolean(lastOrder && lastOrderItem);
  // Own-string orders have no catalog string_name — present them as such and skip
  // any catalog re-resolution (handleReorder routes them straight to the own screen).
  const isOwnLastOrder = Boolean(lastOrderItem && !clean(lastOrderItem.string_name));
  const lastOwnText = clean(lastOrderItem?.own_string_text || lastOrderItem?.custom_string_text);
  const reorderName = !lastOrderItem
    ? ""
    : isOwnLastOrder
      ? `Your own string${lastOwnText ? ` · ${lastOwnText}` : ""}`
      : `${lastOrderItem.string_brand || ""} ${lastOrderItem.string_name}`.trim();
  const reorderTension = !lastOrderItem
    ? ""
    : lastOrderItem.tension_lbs_crosses && Number(lastOrderItem.tension_lbs_crosses) !== Number(lastOrderItem.tension_lbs_mains)
      ? `${wholeLbs(lastOrderItem.tension_lbs_mains)}/${wholeLbs(lastOrderItem.tension_lbs_crosses)}`
      : wholeLbs(lastOrderItem.tension_lbs_mains);
  const reorderUnitCents = lastOrder
    ? Math.round(Number(lastOrder.total_cents || 0) / Math.max(1, (lastOrder.items || []).length))
    : 0;
  const suppliedPrices = tiers.filter((t) => t.string_category).map((t) => Number(t.price_cents)).filter(Number.isFinite);
  const minSuppliedCents = suppliedPrices.length ? Math.min(...suppliedPrices) : 0;
  const ownPriceCents = Number(tiers.find(isOwnTier)?.price_cents) || 0;

  const chooseMode = (mode) => {
    setServiceMode(mode);
    setSearchPrefill("");
    if (mode === "own") {
      const ownTier = tiers.find(isOwnTier);
      setTierId(ownTier?.id ?? null);
      setStringId("");
      setOwnString("");
      setAdviceRequested(false);
      go("own");
      return;
    }
    setTierId(null); // supplied: tier is derived once a string is picked in search
    setStringId("");
    setSearchQuery("");
    setSearchMaterial("all");
    setSearchBrand("all");
    go("search");
  };

  const changeMaterial = (mat) => {
    setSearchMaterial(mat);
    // Keep the brand valid within the new material so the two filters never
    // intersect to nothing on a tap.
    if (searchBrand !== "all" && !brandsForMaterial(searchCatalog, mat).includes(searchBrand)) {
      setSearchBrand("all");
    }
  };

  const clearFilters = () => {
    setSearchMaterial("all");
    setSearchBrand("all");
  };

  const pickString = (row) => {
    setStringId(String(row.id));
    setTierId(deriveTier(row.string_category, tiers)?.id ?? null);
    if (isHybridCategory(row.string_category)) {
      setSplitTension(true); // hybrids default to split tension
      setCrosses((current) => (current && current !== tension ? current : Math.max(40, tension - 4)));
    } else {
      const gauges = rowGauges(row);
      if (gauges.length === 1) setGauge(String(gauges[0])); // auto-select the only gauge
    }
    go("vendor");
  };

  // "Order again": carry the past setup into the flow and resume prefilled. Catalogued
  // strings resume in search (never a dead card); own-string orders resume in own.
  // The exact-match straight-to-checkout (2-tap) path lands with the search step and
  // needs vendor_id/string_id on the order so we don't re-pick the vendor.
  const handleReorder = (order) => {
    const item = (order?.items || [])[0];
    if (!item) return;
    if (item.gauge) setGauge(String(item.gauge));
    if (item.tension_lbs_mains) setTension(Number(item.tension_lbs_mains));
    if (item.tension_lbs_crosses && Number(item.tension_lbs_crosses) !== Number(item.tension_lbs_mains)) {
      setSplitTension(true);
      setCrosses(Number(item.tension_lbs_crosses));
    } else {
      setSplitTension(false);
    }
    setQuantity(1);
    setSetupMode("");
    setAdviceRequested(false);
    setRacketMakeModel(item.racket_make_model || "");
    const catalogued = clean(item.string_name);
    if (!catalogued) {
      setServiceMode("own");
      const ownTier = tiers.find(isOwnTier);
      setTierId(ownTier?.id ?? null);
      setOwnString(item.own_string_text || item.custom_string_text || "");
      go("own");
      return;
    }
    setServiceMode("supplied");
    setTierId(null);
    setStringId("");
    setSearchMaterial("all");
    setSearchBrand("all");
    setSearchPrefill(`${item.string_brand || ""} ${catalogued}`.trim());
    go("search");
  };

  return (
    <div className="dashboard-page restring-page">
      <header className="rsg-nav">
        <div className="rsg-nav-bar">
          {showBack ? (
            <button
              type="button"
              className="rsg-nav-btn"
              onClick={onHeaderBack}
              aria-label={screen === "home" ? "Back to home" : "Back"}
            >
              <ChevronLeft size={22} />
            </button>
          ) : (
            <span className="rsg-nav-btn rsg-nav-spacer" aria-hidden="true" />
          )}
          <div className="rsg-nav-title">{navTitle}</div>
          {showClose ? (
            <button type="button" className="rsg-nav-btn" onClick={exitToHome} aria-label="Close order">
              <X size={22} />
            </button>
          ) : (
            <span className="rsg-nav-btn rsg-nav-spacer" aria-hidden="true" />
          )}
        </div>
        {showProgress ? (
          <div
            className="rsg-nav-prog"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={6}
            aria-valuenow={flowStep}
          >
            <span style={{ width: `${Math.round((flowStep / 6) * 100)}%` }} />
          </div>
        ) : null}
      </header>
      <main className="rsg-shell">
        {error ? <div className="rsg-alert">{error}</div> : null}
        {loading || authLoading ? <div className="rsg-card">Loading restringing options...</div> : null}

        {!loading && screen === "home" ? (
          <>
            <section className="rsg-hero">
              <h1>Restring my racket</h1>
              <p>Fresh strings, from a stringer near you.</p>
            </section>

            {isReturning ? (
              <section className="rsg-card rsg-reorder">
                <div className="rsg-eyebrow">
                  Last order{relativeWhen(lastOrder.created_at || lastOrder.placed_at) ? ` · ${relativeWhen(lastOrder.created_at || lastOrder.placed_at)}` : ""}
                </div>
                <div className="rsg-reorder-name">{reorderName}</div>
                <div className="rsg-reorder-spec">
                  {lastOrderItem.gauge ? `${lastOrderItem.gauge} gauge · ` : ""}
                  {reorderTension ? `${reorderTension} lbs · ` : ""}
                  {lastOrder.vendor_name || "your stringer"}
                </div>
                <button type="button" className="rsg-primary" onClick={() => handleReorder(lastOrder)}>
                  Order again{reorderUnitCents ? ` · ${formatMoneyCents(reorderUnitCents)}` : ""}
                </button>
                <button type="button" className="rsg-link" onClick={() => go("orders")}>
                  View all orders ({orders.length})
                </button>
              </section>
            ) : null}

            {isReturning ? <h2 className="rsg-divider">Something different</h2> : null}

            <button type="button" className="rsg-choice" onClick={() => go("mode")}>
              <span className="rsg-choice-ico"><Target size={22} /></span>
              <span className="rsg-choice-txt"><b>I know what I want</b><small>Search for your string by name.</small></span>
              <ArrowRight size={20} className="rsg-choice-arrow" />
            </button>
            <button type="button" className={`rsg-choice${isReturning ? "" : " rsg-choice-hot"}`} onClick={() => { setWizardIndex(0); setAnswers({}); go("wizard"); }}>
              <span className="rsg-choice-ico"><Lightbulb size={22} /></span>
              <span className="rsg-choice-txt"><b>Help me choose a string</b><small>4 quick questions.</small></span>
              <ArrowRight size={20} className="rsg-choice-arrow" />
            </button>
            <button type="button" className="rsg-choice" onClick={() => go("stringers")}>
              <span className="rsg-choice-ico"><MapPin size={22} /></span>
              <span className="rsg-choice-txt"><b>Find a stringer</b><small>See who&apos;s near you.</small></span>
              <ArrowRight size={20} className="rsg-choice-arrow" />
            </button>
            {!isReturning ? (
              <button type="button" className="rsg-choice" onClick={() => go("orders")}>
                <span className="rsg-choice-ico"><ClipboardList size={22} /></span>
                <span className="rsg-choice-txt"><b>My orders</b><small>Track status and cancel before drop-off.</small></span>
                <ArrowRight size={20} className="rsg-choice-arrow" />
              </button>
            ) : null}
          </>
        ) : null}

        {screen === "mode" ? (
          <>
            <section className="rsg-hero compact">
              <h1>Whose string?</h1>
              <p>This changes the price, so we ask it first.</p>
            </section>
            <button type="button" className="rsg-choice" onClick={() => chooseMode("supplied")}>
              <span className="rsg-choice-ico"><Package size={22} /></span>
              <span className="rsg-choice-txt"><b>My stringer supplies it</b><small>Pick from what they stock.</small></span>
              {minSuppliedCents ? <span className="rsg-choice-price">From {formatMoneyCents(minSuppliedCents)}</span> : <ArrowRight size={20} className="rsg-choice-arrow" />}
            </button>
            <button type="button" className="rsg-choice" onClick={() => chooseMode("own")}>
              <span className="rsg-choice-ico"><ShoppingBag size={22} /></span>
              <span className="rsg-choice-txt"><b>I&apos;ll bring my own string</b><small>Labor only. Hybrids welcome.</small></span>
              {ownPriceCents ? <span className="rsg-choice-price">{formatMoneyCents(ownPriceCents)}</span> : <ArrowRight size={20} className="rsg-choice-arrow" />}
            </button>
          </>
        ) : null}

        {/* Placeholders — built in the next increments (string search, own-string, stringer directory). */}
        {screen === "search" ? (() => {
          const rows = searchCatalog;
          const query = searchQuery.trim();
          const results = filterCatalog(rows, { query: searchQuery, material: searchMaterial, brand: searchBrand });
          const wide = query ? filterCatalog(rows, { query: searchQuery }) : [];
          const brandPool = brandsForMaterial(rows, searchMaterial);
          const hasFilter = searchMaterial !== "all" || searchBrand !== "all";
          const filterBits = [
            searchBrand !== "all" ? searchBrand : "",
            searchMaterial !== "all" ? MATERIALS.find((m) => m.id === searchMaterial)?.label.toLowerCase() : "",
          ].filter(Boolean).join(" ");
          const countLine = query
            ? results.length ? `${results.length} match${results.length > 1 ? "es" : ""}` : "No matches"
            : hasFilter ? `${results.length} in ${filterBits}` : `${rows.length} stocked near you`;
          const ownCta = `Bring my own set${ownPriceCents ? ` · ${formatMoneyCents(ownPriceCents)}` : ""}`;
          return (
            <>
              <div className="rsg-search-controls">
                <input
                  className="rsg-search-input"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Hyper-G, Champion's Choice, RPM…"
                  autoComplete="off"
                  aria-label="Search strings by brand or name"
                />
                <div className="rsg-frow">
                  <span className="rsg-flabel">Material</span>
                  <div className="rsg-ftrack">
                    {MATERIALS.map((m) => {
                      const count = m.id === "all" ? rows.length : rows.filter((r) => r.material === m.id).length;
                      return (
                        <button key={m.id} type="button" className={`rsg-chip${searchMaterial === m.id ? " is-active" : ""}`} aria-pressed={searchMaterial === m.id} disabled={!count} onClick={() => changeMaterial(m.id)}>{m.label}</button>
                      );
                    })}
                  </div>
                </div>
                <div className="rsg-frow">
                  <span className="rsg-flabel">Brand</span>
                  <div className="rsg-ftrack">
                    <button type="button" className={`rsg-chip${searchBrand === "all" ? " is-active" : ""}`} aria-pressed={searchBrand === "all"} onClick={() => setSearchBrand("all")}>All</button>
                    {brandPool.map((b) => (
                      <button key={b} type="button" className={`rsg-chip${searchBrand === b ? " is-active" : ""}`} aria-pressed={searchBrand === b} onClick={() => setSearchBrand(b)}>{b}</button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="rsg-reshead">
                <span>{searchLoading ? "Loading strings…" : searchError ? "Couldn’t load strings" : countLine}</span>
                {hasFilter && !searchLoading && !searchError ? <button type="button" className="rsg-clear" onClick={clearFilters}>Clear filters</button> : null}
              </div>

              {import.meta.env.DEV ? (
                <div style={{ fontSize: 12, fontWeight: 700, color: "#7c3aed", margin: "0 2px 10px", wordBreak: "break-word" }}>
                  dev · {searchLoading
                    ? "loading…"
                    : searchError
                      ? `error: ${searchError}`
                      : `${searchCatalog.length} strings · ${searchCatalog.filter((r) => Array.isArray(r.gauges) || (r.gauge != null && r.gauge !== "")).length} w/ gauges · ${searchCatalog.filter((r) => r.mains != null || r.crosses != null).length} hybrid-comp · keys: ${Object.keys(searchCatalog[0] || {}).join(",") || "—"}`}
                </div>
              ) : null}

              {searchLoading ? null : searchError ? (
                <div className="rsg-miss">
                  <div className="rsg-miss-t">Couldn&apos;t load strings</div>
                  <div className="rsg-miss-s">{searchError}</div>
                  <button type="button" className="rsg-secondary" onClick={retrySearchCatalog}>Try again</button>
                </div>
              ) : results.length ? (
                <div className="rsg-stack">
                  {results.map((row) => {
                    const label = `${row.brand || ""} ${row.name || ""}`.trim();
                    const gauges = rowGauges(row);
                    const meta = isHybridCategory(row.string_category)
                      ? `${clean(row.mains)} / ${clean(row.crosses)}`.replace(/^ \/ | \/ $/g, "").trim()
                      : gauges.length ? `${gauges.join(" · ")} gauge` : "";
                    return (
                      <button key={row.id} type="button" className="rsg-res" onClick={() => pickString(row)}>
                        <div className="rsg-res-txt">
                          <div className="rsg-res-t">
                            {query
                              ? highlightMatch(label, query).map((part, i) => (part.match ? <mark key={i}>{part.text}</mark> : <span key={i}>{part.text}</span>))
                              : label}
                          </div>
                          <div className="rsg-res-m">
                            <span className="rsg-tag">{categoryLabel(row.string_category)}</span>
                            {meta ? <span className="rsg-res-meta">{meta}</span> : null}
                          </div>
                        </div>
                        {Number.isFinite(Number(row.price_cents)) ? <div className="rsg-res-p">{formatMoneyCents(row.price_cents)}</div> : null}
                      </button>
                    );
                  })}
                </div>
              ) : query && wide.length ? (
                <div className="rsg-miss">
                  <div className="rsg-miss-t">Not in {filterBits}</div>
                  <div className="rsg-miss-s">{wide.length} match{wide.length > 1 ? "es" : ""} outside these filters.</div>
                  <button type="button" className="rsg-secondary" onClick={clearFilters}>Clear filters</button>
                </div>
              ) : query ? (
                <div className="rsg-miss">
                  <div className="rsg-miss-t">No stringer near you stocks &ldquo;{query}&rdquo;</div>
                  <div className="rsg-miss-s">Bring a set with you and pay for labor only. We&apos;ve noted the request for your local stringers.</div>
                  <button type="button" className="rsg-primary" onClick={() => chooseMode("own")}>{ownCta}</button>
                </div>
              ) : hasFilter ? (
                <div className="rsg-miss">
                  <div className="rsg-miss-t">Nothing stocked in {filterBits}</div>
                  <div className="rsg-miss-s">Try another filter, or bring your own set.</div>
                  <button type="button" className="rsg-secondary" onClick={clearFilters}>Clear filters</button>
                </div>
              ) : (
                <div className="rsg-miss">
                  <div className="rsg-miss-t">No strings stocked here yet</div>
                  <div className="rsg-miss-s">Bring your own set and pay for labor only.</div>
                  <button type="button" className="rsg-primary" onClick={() => chooseMode("own")}>{ownCta}</button>
                </div>
              )}
            </>
          );
        })() : null}
        {screen === "own" ? (
          <section className="rsg-card">
            <h2>Your string</h2>
            {clean(ownString) ? <p>Prefilled: <b>{ownString}</b></p> : null}
            <p>Bring-your-own entry (brand/model, hybrid) arrives next.</p>
          </section>
        ) : null}
        {screen === "stringers" ? (
          <section className="rsg-card">
            <h2>Find a stringer</h2>
            <p>The stringer directory arrives in a later step.</p>
          </section>
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
                      <div><h2>{vendor.name}</h2><p><Star size={15} /> {vendor.google_rating || "New"} {vendor.google_rating_count ? `(${vendor.google_rating_count} Google reviews)` : ""}</p><p><MapPin size={15} /> {vendor.address || "Address pending"} {vendor.distance_miles ? `· ${Number(vendor.distance_miles).toFixed(1)} mi` : ""}</p></div>
                      <span className="rsg-pill">{vendor.turnaround_days || 3} day turnaround</span>
                    </div>
                    <div className="rsg-actions">
                      <button type="button" className="rsg-primary" onClick={() => chooseVendor(vendor)}>Order here</button>
                      {vendor.phone_href ? <a className="rsg-icon-btn" href={vendor.phone_href}><Phone size={18} /></a> : null}
                      {vendor.sms_href ? <a className="rsg-icon-btn" href={vendor.sms_href}><MessageCircle size={18} /></a> : null}
                    </div>
                    <button type="button" className="rsg-link" onClick={() => openVendorProfile(vendor)}>View full profile</button>
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
              <p>{selectedVendor.description || "Professional restringing, setup advice, and quick local pickup."}</p>
              <p><MapPin size={15} /> {selectedVendor.address}</p>
              <button type="button" className="rsg-primary" onClick={() => go("config")}>Order here</button>
            </section>
            <section className="rsg-card">
              <h2>Strings in stock</h2>
              <p>{catalog.length ? catalog.map((item) => `${item.brand} ${item.name}`).slice(0, 8).join(", ") : "Catalog loads after service selection."}</p>
            </section>
            <section className="rsg-card">
              <h2>Google reviews</h2>
              <div className="rsg-reviews">
                {(selectedVendor.google_reviews || []).slice(0, 5).map((review, index) => (
                  <div key={`${review.author_name}-${index}`} className="rsg-review">
                    <b>{review.author_name || "Google reviewer"}</b>
                    <span>{"★".repeat(Math.max(0, Math.min(5, Number(review.rating) || 0)))}</span>
                    <p>{review.text}</p>
                  </div>
                ))}
                {!selectedVendor.google_reviews?.length ? <p>No attributed Google reviews loaded yet.</p> : null}
              </div>
            </section>
          </>
        ) : null}

        {screen === "config" && tier ? (
          <section className="rsg-card">
            <h1>Your string setup</h1>
            <p>{tier.name} at {selectedVendor?.name}</p>
            {isOwnTier(tier) ? (
              <Field label="String you are bringing"><input value={ownString} onChange={(event) => setOwnString(event.target.value)} placeholder="Luxilon ALU Power 16L" /></Field>
            ) : (
              <>
                <span className="rsg-label">String</span>
                <div className="rsg-chips">
                  {catalog.map((item) => (
                    <button key={item.id} type="button" className={String(stringId || catalog[0]?.id) === String(item.id) ? "is-active" : ""} onClick={() => setStringId(String(item.id))}>
                      {item.brand} {item.name}
                    </button>
                  ))}
                  <button type="button" className={needsOtherString ? "is-active" : ""} onClick={() => setStringId("other")}>Other...</button>
                </div>
                {needsOtherString ? <Field label="Describe the string"><input value={otherString} onChange={(event) => setOtherString(event.target.value)} placeholder="Brand and model" /><small>Required for Other. Subject to availability; your stringer confirms at drop-off.</small></Field> : null}
              </>
            )}
            <span className="rsg-label">Gauge</span>
            <div className="rsg-tiles">
              {GAUGES.map((item) => <TileButton key={item} active={gauge === item && !adviceRequested} disabled={adviceRequested} onClick={() => setGauge(item)}><small>gauge</small><b>{item}</b></TileButton>)}
            </div>
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
                <span>{adviceRequested ? "Specs decided at drop-off" : `${selectedStringName || "String"} · gauge ${gauge} · ${splitTension ? `${tension}/${crosses}` : tension} lbs`}</span>
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
                  {(order.items || []).map((item) => <p key={item.id}>{item.racket_make_model}: {orderStringLine(item)}</p>)}
                  <p>{order.vendor_name} · {formatMoneyCents(order.total_cents)}</p>
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
      {inSection ? <MobileHomeBottomNav /> : null}
      <style>{`
        .restring-page{background:#f4f5f7;min-height:100vh}
        .rsg-shell{max-width:760px;margin:0 auto;padding:18px 16px 96px;color:#111827;font-family:Inter,system-ui,sans-serif}
        .rsg-nav{position:sticky;top:0;z-index:20;background:rgba(244,245,247,.86);backdrop-filter:blur(8px);border-bottom:1px solid #edf0f4}
        .rsg-nav-bar{max-width:760px;margin:0 auto;display:grid;grid-template-columns:40px 1fr 40px;align-items:center;gap:8px;height:52px;padding:0 12px}
        .rsg-nav-btn{display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:12px;border:0;background:transparent;color:#111827;cursor:pointer}
        .rsg-nav-btn:not(.rsg-nav-spacer):hover{background:#eceef2}
        .rsg-nav-btn:focus{outline:none}
        .rsg-nav-btn:focus-visible{outline:2px solid #7c3aed;outline-offset:2px}
        .rsg-nav-spacer{background:transparent;cursor:default}
        .rsg-nav-title{text-align:center;font-weight:900;font-size:16px;color:#111827;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .rsg-nav-prog{height:4px;background:#e3dcf7;overflow:hidden}
        .rsg-nav-prog span{display:block;height:100%;min-width:18px;border-radius:0 4px 4px 0;background:linear-gradient(90deg,#7c3aed,#a855f7);transition:width .25s ease}
        @media (prefers-reduced-motion:reduce){.rsg-nav-prog span{transition:none}}
        .rsg-back,.rsg-secondary,.rsg-icon-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;border:1px solid #e5e7eb;background:white;color:#111827;border-radius:14px;padding:12px 14px;font-weight:800;box-shadow:0 1px 2px rgba(17,24,39,.05)}
        .rsg-back{margin-bottom:14px}
        .rsg-hero{padding:14px 2px 18px}.rsg-hero.compact{padding-top:4px}.rsg-hero h1,.rsg-card h1{font-size:34px;line-height:1.05;font-weight:900;margin:0 0 6px}.rsg-hero p,.rsg-card p{color:#6b7280;margin:4px 0}
        .rsg-card,.rsg-choice,.rsg-tier{background:white;border:1px solid #edf0f4;border-radius:20px;box-shadow:0 1px 2px rgba(17,24,39,.05),0 10px 28px rgba(17,24,39,.06);padding:18px;margin-bottom:14px}
        .rsg-choice,.rsg-tier{width:100%;display:flex;align-items:center;justify-content:space-between;text-align:left}.rsg-choice b,.rsg-tier b{display:block;font-size:18px}.rsg-choice small,.rsg-tier small{display:block;color:#6b7280}.rsg-choice-hot{border-color:#dac7ff;background:#faf7ff}.rsg-choice-ico{flex:none;width:34px;display:inline-flex;align-items:center;justify-content:center;color:#6d28d9;margin-right:10px}.rsg-choice-txt{flex:1;min-width:0}.rsg-choice-arrow{flex:none;color:#9ca3af}.rsg-choice-price{flex:none;margin-left:12px;font-weight:900;font-size:16px;color:#111827;white-space:nowrap}
        .rsg-reorder{border-color:#dac7ff}.rsg-eyebrow{font-size:12px;font-weight:900;text-transform:uppercase;letter-spacing:.05em;color:#6d28d9}.rsg-reorder-name{font-size:22px;font-weight:900;margin:6px 0 2px}.rsg-reorder-spec{color:#6b7280;margin-bottom:4px}
        .rsg-divider{font-size:13px;font-weight:900;text-transform:uppercase;letter-spacing:.06em;color:#9ca3af;margin:8px 2px 12px;display:flex;align-items:center;gap:10px}.rsg-divider::after{content:"";flex:1;height:1px;background:#e5e7eb}
        .rsg-search-controls{position:sticky;top:56px;z-index:10;background:#f4f5f7;border:1px solid #e5e7eb;border-radius:16px;padding:12px;margin-bottom:12px;box-shadow:0 1px 2px rgba(17,24,39,.05)}
        .rsg-search-input{width:100%;border:1px solid #e5e7eb;border-radius:12px;padding:12px 13px;font-size:15px;background:#fff}
        .rsg-frow{display:flex;align-items:center;gap:10px;margin-top:10px}
        .rsg-flabel{flex:none;width:62px;font-size:12px;font-weight:900;color:#6b7280;text-transform:uppercase;letter-spacing:.03em}
        .rsg-ftrack{flex:1;min-width:0;display:flex;gap:7px;overflow-x:auto;padding:0 14px 2px 0;scrollbar-width:none;-webkit-mask-image:linear-gradient(to right,#000 calc(100% - 20px),transparent);mask-image:linear-gradient(to right,#000 calc(100% - 20px),transparent)}
        .rsg-ftrack::-webkit-scrollbar{display:none}
        .rsg-chip{flex:none;border:1px solid #e5e7eb;background:#fff;border-radius:999px;padding:7px 12px;font-weight:800;font-size:13px;white-space:nowrap;color:#111827}
        .rsg-chip.is-active{border-color:#7c3aed;background:#ede9fe;color:#6d28d9}
        .rsg-chip:disabled{opacity:.4}
        .rsg-chip:focus-visible,.rsg-res:focus-visible,.rsg-clear:focus-visible{outline:2px solid #7c3aed;outline-offset:2px}
        .rsg-reshead{display:flex;align-items:center;justify-content:space-between;margin:2px 2px 10px;font-weight:800;color:#6b7280;font-size:13px}
        .rsg-clear{border:0;background:transparent;color:#6d28d9;font-weight:900;font-size:13px}
        .rsg-res{width:100%;display:flex;align-items:center;justify-content:space-between;gap:12px;text-align:left;border:1px solid #edf0f4;background:#fff;border-radius:16px;padding:14px;box-shadow:0 1px 2px rgba(17,24,39,.05)}
        .rsg-res-txt{flex:1;min-width:0}
        .rsg-res-t{font-weight:900;font-size:16px}.rsg-res-t mark{background:#fde68a;color:inherit;border-radius:3px;padding:0 1px}
        .rsg-res-m{display:flex;align-items:center;gap:8px;margin-top:4px;flex-wrap:wrap}
        .rsg-tag{display:inline-flex;border-radius:999px;background:#f1eafe;color:#6d28d9;padding:3px 9px;font-weight:800;font-size:12px}
        .rsg-res-meta{color:#6b7280;font-size:13px}
        .rsg-res-p{flex:none;font-weight:900;font-size:16px;white-space:nowrap}
        .rsg-miss{border:1px dashed #d6d9e0;border-radius:16px;padding:18px;text-align:center;background:#fff}
        .rsg-miss-t{font-weight:900;font-size:16px}.rsg-miss-s{color:#6b7280;margin:6px 0 12px}
        .rsg-primary{width:100%;display:inline-flex;align-items:center;justify-content:center;gap:8px;border:0;border-radius:15px;padding:14px 16px;background:linear-gradient(135deg,#7c3aed,#a855f7);color:white;font-weight:900;box-shadow:0 10px 24px rgba(124,58,237,.22);margin-top:12px}.rsg-primary:disabled,.rsg-secondary:disabled{opacity:.55}
        .rsg-stack{display:grid;gap:12px}.rsg-option{display:flex;align-items:center;justify-content:space-between;border:1px solid #e5e7eb;background:#fff;border-radius:14px;padding:14px 15px;font-weight:800}.rsg-progress{height:8px;border-radius:999px;background:#ede9fe;margin-bottom:16px;overflow:hidden}.rsg-progress span{display:block;height:100%;background:#7c3aed}
        .rsg-tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(96px,1fr));gap:10px;margin:10px 0}.rsg-tile,.rsg-stat{min-height:78px;border:1px solid #e5e7eb;background:#fff;border-radius:16px;padding:12px;text-align:center}.rsg-tile.is-active,.rsg-tier.is-active{border-color:#7c3aed;background:#f5f0ff}.rsg-tile b,.rsg-stat b{display:block;font-size:22px}.rsg-tile small,.rsg-stat span,.rsg-stat small{display:block;color:#6b7280;font-size:12px}
        .rsg-pill{display:inline-flex;align-items:center;border-radius:999px;background:#ede9fe;color:#6d28d9;padding:6px 10px;font-weight:900;font-size:12px}.rsg-field,.rsg-label{display:block;margin-top:14px;font-weight:900}.rsg-field span{display:block;margin-bottom:6px}.rsg-field input,.rsg-loc input{width:100%;border:1px solid #e5e7eb;border-radius:14px;padding:13px 12px}.rsg-field small{display:block;color:#6b7280;margin-top:5px}
        .rsg-chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}.rsg-chips button{border:1px solid #e5e7eb;background:#fff;border-radius:999px;padding:10px 13px;font-weight:800}.rsg-chips button.is-active{border-color:#7c3aed;background:#ede9fe;color:#6d28d9}
        .rsg-stepper{display:flex;align-items:center;justify-content:center;gap:12px;margin:8px 0}.rsg-stepper button{width:42px;height:42px;border-radius:999px;border:1px solid #e5e7eb;background:white}.rsg-stepper div{min-width:92px;text-align:center;border:1px solid #e5e7eb;border-radius:16px;padding:8px}.rsg-stepper b{display:block;font-size:24px}.rsg-stepper small{display:block;color:#6b7280}
        .rsg-check{display:flex;gap:9px;align-items:center;margin-top:12px;font-weight:800}.rsg-actions,.rsg-loc{display:flex;gap:8px;align-items:center}.rsg-actions .rsg-primary{margin-top:0;flex:1}.rsg-link{border:0;background:transparent;color:#6d28d9;font-weight:900;margin-top:10px}.rsg-vendor{display:flex;justify-content:space-between;gap:12px}.rsg-vendor p{display:flex;align-items:center;gap:5px}
        .rsg-profile-img{height:170px;border-radius:18px;background:linear-gradient(135deg,#ede9fe,#dcfce7);display:flex;align-items:center;justify-content:center;font-size:56px;overflow:hidden}.rsg-profile-img img{width:100%;height:100%;object-fit:cover}.rsg-review{border-top:1px solid #eef2f7;padding:10px 0}.rsg-review span{display:block;color:#f59e0b}
        .rsg-racket{border:1px solid #eef2f7;border-radius:16px;padding:12px}.rsg-summary{display:grid;gap:6px}.rsg-summary span{color:#6b7280}.rsg-summary strong{font-size:24px}.rsg-payment{display:grid;gap:12px}.rsg-pay-methods{display:grid;gap:9px;margin-top:8px}.rsg-pay-method{width:100%;display:flex;align-items:center;gap:10px;text-align:left;border:1px solid #e5e7eb;background:#fff;border-radius:15px;padding:12px}.rsg-pay-method.is-active{border-color:#7c3aed;background:#f5f0ff}.rsg-pay-method span{display:grid;gap:2px}.rsg-pay-method small{color:#6b7280}.rsg-fine{font-size:12px!important;text-align:center}.rsg-alert,.rsg-error{background:#fef2f2;color:#b91c1c;border:1px solid #fecaca;border-radius:14px;padding:12px;margin-bottom:12px}.rsg-done{text-align:center}.rsg-done svg{color:#059669;margin:auto}.rsg-steps p{display:flex;gap:10px}.rsg-steps b{display:inline-flex;width:26px;height:26px;border-radius:999px;align-items:center;justify-content:center;background:#ede9fe;color:#6d28d9}.rsg-order-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:10px}.rsg-status-pill{display:inline-grid;gap:1px;border-radius:12px;background:#eef2ff;color:#4338ca;padding:6px 10px;font-weight:900;font-size:13px}.rsg-status-pill--payment{background:#ecfdf5;color:#047857}.rsg-status-pill small{color:inherit;opacity:.72;font-size:10px;text-transform:uppercase;letter-spacing:.04em}
        @media (max-width:640px){.rsg-shell{padding-inline:12px}.rsg-hero h1,.rsg-card h1{font-size:30px}.rsg-vendor,.rsg-actions,.rsg-loc{align-items:stretch;flex-direction:column}.rsg-icon-btn{width:100%}}
      `}</style>
    </div>
  );
}
