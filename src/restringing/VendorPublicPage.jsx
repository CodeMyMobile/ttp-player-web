import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { Check, ChevronLeft, Lightbulb, MessageCircle, Minus, Navigation, Phone, Plus, Share2, X } from "lucide-react";
import AppNav from "../components/AppNav.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useAuthDrawer } from "../context/AuthDrawerContext.jsx";
import RestringingPlayerFlow from "./RestringingPlayerFlow.jsx";
import { googleMapsUriForVendor, googleReviewsForVendor, hasGoogleSummary } from "./googleReviews.js";
import { formatMoneyCents, restringTaxCents, restringUnitPrice, vendorImageSrc } from "./playerFlow.js";
import { QUIZ_QUESTIONS } from "./quizV2.js";
import { getVendorProfile, listServiceTiers, listVendorStrings, listVendors, recommendStrings } from "./restringingService.js";
import {
  STRING_CHOICE,
  buildVendorPageCheckoutItem,
  clampTension,
  clearOrderDraft,
  collectionDetailsForPage,
  gaugeChoiceForString,
  loadOrderDraft,
  orderSelectionGaps,
  parseVendorHours,
  parseVendorPagePrefill,
  saveOrderDraft,
  tensionConfigForCategory,
  vendorOpenStatus,
} from "./vendorPage.js";
import { findVendorBySlug, vendorSlug } from "./vendorProfileRoutes.js";
import "./VendorPublicPage.css";

const clean = (value) => String(value || "").trim();

// "12625 Westminster Ave, Los Angeles, CA 90066, USA" -> drop the country for display.
const displayAddress = (address) => clean(address).replace(/,\s*USA$/i, "");

// City is the second comma-separated part of a Google-formatted address.
const cityFromAddress = (address) => {
  const parts = clean(address).split(",").map((part) => part.trim());
  return parts.length >= 3 ? parts[1] : "";
};

const formatPhone = (phone) => {
  const digits = clean(phone).replace(/\D/g, "");
  const national = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  return national.length === 10
    ? `(${national.slice(0, 3)}) ${national.slice(3, 6)}-${national.slice(6)}`
    : clean(phone);
};

// Vendors type these by hand: accept "www.shop.com", reject anything that is not a web address.
const webHref = (value) => {
  const text = clean(value);
  if (!text || /\s/.test(text) || !text.includes(".")) return "";
  return /^https?:\/\//i.test(text) ? text : `https://${text}`;
};

const webLabel = (href) => href.replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/+$/, "");

const directionsHref = (vendor) => {
  const lat = Number(vendor.lat);
  const lng = Number(vendor.lng);
  const destination = Number.isFinite(lat) && Number.isFinite(lng) && (lat || lng)
    ? `${lat},${lng}`
    : encodeURIComponent(clean(vendor.address));
  return destination ? `https://www.google.com/maps/dir/?api=1&destination=${destination}` : "";
};

const readyLabel = (days) => {
  const count = Number(days);
  if (!Number.isFinite(count) || count <= 0) return "";
  return `Ready in ${count} day${count === 1 ? "" : "s"}`;
};

const isOwnStringTier = (tier) => tier?.string_category === null;

// "Restringing + Standard Polyester" -> "Standard Polyester"; tiers come from the API, not a fixed list.
const tierTitle = (tier) => (
  isOwnStringTier(tier) ? "Restringing only" : clean(tier?.name).replace(/^Restring(ing)?\s*\+\s*/i, "")
);

const TIER_SUBS = {
  syn_gut: "Soft, all-round, budget",
  std_multi: "Comfort and feel",
  prem_multi: "Best feel, arm-friendly",
  std_poly: "Control and spin",
  prem_poly: "Tour-level spin and control",
  poly_multi: "Spin with comfort",
  gut_poly: "Feel of gut, durability of poly",
  nat_gut: "The softest, most powerful feel",
};

const tierSub = (tier) => (isOwnStringTier(tier) ? "You bring the string" : TIER_SUBS[tier?.string_category] || "");

const stringName = (string) => `${clean(string?.brand)} ${clean(string?.name)}`.trim();

// Where Book sends the player when something is missing; gauge chips sit under the strings.
const GAP_STEP_IDS = {
  service: "vp-step-service",
  string: "vp-step-string",
  gauge: "vp-step-string",
  racket: "vp-step-racket",
};

const GAP_MESSAGES = {
  service: "Choose a service to book.",
  string: "Tell us which string to use.",
  gauge: "Choose a gauge for your string.",
  racket: "Add your racket's make and model.",
};

function VerifiedMark({ size = 30 }) {
  return (
    <svg className="vp-verified-mark" width={size} height={size} viewBox="0 0 24 24" role="img" aria-label="Tennis Plan Verified">
      <path fill="#8B5CF6" d="M12 2l2.4 1.8 3-.2.9 2.9 2.5 1.7-1 2.8 1 2.8-2.5 1.7-.9 2.9-3-.2L12 22l-2.4-1.8-3 .2-.9-2.9-2.5-1.7 1-2.8-1-2.8 2.5-1.7.9-2.9 3 .2z" />
      <path d="M8 12.2l2.6 2.6L16 9.4" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Stars({ rating }) {
  const filled = Math.max(0, Math.min(5, Math.round(Number(rating) || 0)));
  return (
    <span className="vp-stars" aria-label={`${filled} out of 5 stars`}>
      {"★".repeat(filled)}<span>{"★".repeat(5 - filled)}</span>
    </span>
  );
}

// Google attribution: the author's name, a link back to Google, and the review text unaltered.
function ReviewsSection({ vendor }) {
  const reviews = googleReviewsForVendor(vendor).slice(0, 3);
  const mapsUri = clean(vendor.google?.google_maps_uri);
  if (!vendor.google || (!reviews.length && !hasGoogleSummary(vendor))) return null;

  return (
    <section className="vp-card" id="reviews">
      <div className="vp-reviews-top">
        <div>
          <h2>Reviews</h2>
          <span className="vp-muted vp-small">From Google</span>
        </div>
        {hasGoogleSummary(vendor) ? (
          <div className="vp-reviews-score">
            <b>{Number(vendor.google.rating).toFixed(1)}</b>
            <span>
              <Stars rating={vendor.google.rating} />
              <small>{Number(vendor.google.user_ratings_total)} reviews</small>
            </span>
          </div>
        ) : null}
      </div>
      {reviews.length ? (
        <div className="vp-reviews-grid">
          {reviews.map((review, index) => (
            <article className="vp-review" key={`${review.authorName}-${index}`}>
              <div className="vp-review-head">
                {review.authorUri ? (
                  <a href={review.authorUri} target="_blank" rel="noreferrer">{review.authorName}</a>
                ) : (
                  <b>{review.authorName}</b>
                )}
                {review.relativeTimeDescription ? <small>{review.relativeTimeDescription}</small> : null}
              </div>
              <Stars rating={review.rating} />
              {review.text ? <p>{review.text}</p> : null}
            </article>
          ))}
        </div>
      ) : null}
      {mapsUri ? (
        <a className="vp-small" href={mapsUri} target="_blank" rel="noreferrer">See all reviews on Google ↗</a>
      ) : null}
    </section>
  );
}

// "Help me choose": the same five questions as the app and the coach app, as a modal (a
// bottom sheet on phones). The answers go to the shared recommendation engine.
function StringQuizSheet({ onClose, onFinish }) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const sheetRef = useRef(null);
  const question = QUIZ_QUESTIONS[index];

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  useEffect(() => {
    sheetRef.current?.querySelector(".vp-quiz-option")?.focus();
  }, [index]);

  const answer = (value) => {
    const next = { ...answers, [question.key]: value };
    setAnswers(next);
    if (index + 1 < QUIZ_QUESTIONS.length) {
      setIndex(index + 1);
      return;
    }
    onFinish(next);
  };

  return (
    <div className="vp-quiz-backdrop" role="presentation" onClick={onClose}>
      <div
        ref={sheetRef}
        className="vp-quiz-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="vp-quiz-question"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="vp-quiz-top">
          {index > 0 ? (
            <button type="button" className="vp-quiz-icon" aria-label="Previous question" onClick={() => setIndex(index - 1)}><ChevronLeft size={20} /></button>
          ) : <span />}
          <span className="vp-quiz-count">Question {index + 1} of {QUIZ_QUESTIONS.length}</span>
          <button type="button" className="vp-quiz-icon" aria-label="Close" onClick={onClose}><X size={20} /></button>
        </div>
        <div className="vp-quiz-progress"><span style={{ width: `${((index + 1) / QUIZ_QUESTIONS.length) * 100}%` }} /></div>
        <h2 id="vp-quiz-question">{question.label}</h2>
        <div className="vp-quiz-options">
          {question.options.map((option) => (
            <button
              key={option.value}
              type="button"
              className="vp-opt vp-quiz-option"
              aria-pressed={answers[question.key] === option.value}
              onClick={() => answer(option.value)}
            >
              <span className="vp-radio" />
              <span className="vp-opt-text"><b>{option.label}</b>{option.hint ? <small>{option.hint}</small> : null}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function VendorPublicPage({ vendorSlug: directVendorSlug = "" }) {
  const { vendorSlug: routeVendorSlug = "" } = useParams();
  const location = useLocation();
  // Prefill links work both as /thetennisgarage?tier=… and as #/thetennisgarage?tier=….
  const prefillSearch = location.search || (typeof window !== "undefined" ? window.location.search : "");
  const slug = clean(directVendorSlug || routeVendorSlug);
  const [status, setStatus] = useState("loading");
  const [vendor, setVendor] = useState(null);
  const [now, setNow] = useState(() => new Date());
  const [shareNote, setShareNote] = useState("");
  const { isAuthenticated, loading: authLoading } = useAuth();
  const authDrawer = useAuthDrawer();
  const [tiers, setTiers] = useState([]);
  const [tierId, setTierId] = useState(null);
  const [catalog, setCatalog] = useState({ status: "idle", rows: [] });
  const [stringChoice, setStringChoice] = useState(STRING_CHOICE.SHOP);
  const [stringId, setStringId] = useState(null);
  const [gauge, setGauge] = useState(null);
  const [ownStringText, setOwnStringText] = useState("");
  const [tensionLbs, setTensionLbs] = useState(null);
  const [stringerChoosesTension, setStringerChoosesTension] = useState(false);
  const [racketMakeModel, setRacketMakeModel] = useState("");
  const [bookError, setBookError] = useState("");
  const [draftRestored, setDraftRestored] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [quizOpen, setQuizOpen] = useState(false);
  const [quizResult, setQuizResult] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    listVendors()
      .then(async (vendors) => {
        const match = findVendorBySlug(vendors, slug);
        if (!match) return null;
        // The profile adds Google reviews; the list row is enough to render without them.
        return getVendorProfile(match.id).then((profile) => profile || match).catch(() => match);
      })
      .then((profile) => {
        if (cancelled) return;
        setVendor(profile);
        setStatus(profile ? "ready" : "missing");
      })
      .catch(() => {
        if (!cancelled) setStatus("missing");
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    let cancelled = false;
    listServiceTiers()
      .then((rows) => {
        if (!cancelled) setTiers(Array.isArray(rows) ? rows : []);
      })
      .catch(() => {
        if (!cancelled) setTiers([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const vendorId = vendor?.id || null;
  const tier = useMemo(() => tiers.find((item) => Number(item.id) === Number(tierId)) || null, [tiers, tierId]);

  // Bring back an order saved before sign-in (or before a reload), once, when the data it
  // refers to has loaded. An order that was mid-Book carries on to checkout after sign-in.
  // Otherwise a prefill link (e.g. "Restring again") wins over an older saved order.
  useEffect(() => {
    if (draftRestored || !vendorId || !tiers.length || authLoading) return;
    setDraftRestored(true);
    const saved = loadOrderDraft(vendorId);
    const prefill = parseVendorPagePrefill(prefillSearch);
    const draft = saved?.pendingBook ? saved : prefill || saved;
    if (!draft || !tiers.some((item) => Number(item.id) === Number(draft.tierId))) return;
    setTierId(draft.tierId);
    setStringChoice(
      [STRING_CHOICE.SPECIFIED, STRING_CHOICE.AT_DROP_OFF].includes(draft.stringChoice) ? draft.stringChoice : STRING_CHOICE.SHOP,
    );
    setStringId(draft.stringId ?? null);
    setGauge(draft.gauge ?? null);
    setOwnStringText(clean(draft.ownStringText));
    setTensionLbs(draft.tensionLbs ?? null);
    setStringerChoosesTension(Boolean(draft.stringerChoosesTension));
    setRacketMakeModel(clean(draft.racketMakeModel));
    if (draft.pendingBook && isAuthenticated) setCheckoutOpen(true);
  }, [authLoading, draftRestored, isAuthenticated, prefillSearch, tiers, vendorId]);

  // All of the shop's strings, so the player can pick a string first; its category's
  // service follows from it.
  useEffect(() => {
    if (!vendorId) {
      setCatalog({ status: "idle", rows: [] });
      return undefined;
    }
    let cancelled = false;
    setCatalog({ status: "loading", rows: [] });
    listVendorStrings({ vendorId })
      .then((data) => {
        if (!cancelled) setCatalog({ status: "ready", rows: Array.isArray(data?.catalog) ? data.catalog : [] });
      })
      .catch(() => {
        if (!cancelled) setCatalog({ status: "error", rows: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [vendorId]);

  // The saved order has served its purpose once checkout has it.
  useEffect(() => {
    if (checkoutOpen && isAuthenticated && vendorId) clearOrderDraft(vendorId);
  }, [checkoutOpen, isAuthenticated, vendorId]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const hours = useMemo(() => parseVendorHours(vendor?.hours), [vendor]);
  const openStatus = useMemo(() => vendorOpenStatus(vendor?.hours, now), [vendor, now]);

  if (status === "loading") {
    return (
      <div className="dashboard-page vp-page">
        <AppNav />
        <div className="vp-loading">Loading…</div>
      </div>
    );
  }

  // Unknown slug: keep today's behaviour, which lands on the list of stringers.
  if (status === "missing" || !vendor) return <RestringingPlayerFlow vendorSlug={slug} />;

  const address = displayAddress(vendor.address);
  const city = cityFromAddress(vendor.address);
  const image = vendorImageSrc(vendor);
  const ready = readyLabel(vendor.turnaround_days);
  const directions = directionsHref(vendor);
  const website = webHref(vendor.website_url);
  const googleBusiness = webHref(vendor.google_business_url) || googleMapsUriForVendor(vendor);
  const googleBusinessHref = /^https?:\/\//i.test(googleBusiness) ? googleBusiness : "";
  const description = clean(vendor.description);
  const collection = collectionDetailsForPage(vendor.collection_details);
  const shareUrl = `${window.location.origin}/${vendorSlug(vendor.name)}`;
  const shareText = `Book a restring at ${vendor.name}`;
  const contactRows = [
    vendor.owner_name ? ["Owner", <span key="owner">{vendor.owner_name}</span>] : null,
    vendor.public_phone ? ["Phone", <a key="phone" href={vendor.phone_href}>{formatPhone(vendor.public_phone)}</a>] : null,
    vendor.contact_email ? ["Email", <a key="email" href={`mailto:${vendor.contact_email}`}>{vendor.contact_email}</a>] : null,
    website ? ["Website", <a key="web" href={website} target="_blank" rel="noreferrer">{webLabel(website)}</a>] : null,
    googleBusinessHref ? ["Google", <a key="google" href={googleBusinessHref} target="_blank" rel="noreferrer">Business profile ↗</a>] : null,
  ].filter(Boolean);

  // ----- Booking -----
  const ownTier = isOwnStringTier(tier);
  const tension = tensionConfigForCategory(tier?.string_category);
  const selectedString = stringChoice === STRING_CHOICE.SPECIFIED
    ? catalog.rows.find((item) => Number(item.id) === Number(stringId) && item.category === tier?.string_category) || null
    : null;
  // A restored string that the shop no longer lists falls back to stringer's pick.
  const stringStillLoading = catalog.status !== "ready" && stringChoice === STRING_CHOICE.SPECIFIED;
  const decideAtDropOff = !ownTier && stringChoice === STRING_CHOICE.AT_DROP_OFF;
  const effectiveChoice = decideAtDropOff
    ? STRING_CHOICE.AT_DROP_OFF
    : selectedString || stringStillLoading ? STRING_CHOICE.SPECIFIED : STRING_CHOICE.SHOP;
  const gaugeChoice = gaugeChoiceForString(selectedString);
  const effectiveGauge = gaugeChoice.gauges.includes(gauge) ? gauge : gaugeChoice.defaultGauge;
  const effectiveTension = clampTension(tensionLbs, tier?.string_category);
  const selection = {
    tier,
    stringChoice: effectiveChoice,
    stringId: selectedString?.id ?? null,
    gauge: effectiveGauge,
    ownStringText,
    tensionLbs: effectiveTension,
    stringerChoosesTension,
    racketMakeModel,
  };
  const draft = {
    tierId,
    stringChoice: effectiveChoice,
    stringId: effectiveChoice === STRING_CHOICE.SPECIFIED ? stringId : null,
    gauge: effectiveGauge,
    ownStringText,
    tensionLbs: effectiveTension,
    stringerChoosesTension,
    racketMakeModel,
  };

  const serviceLine = !tier ? "Choose a string" : ownTier ? "Restringing only" : `Restring + ${tierTitle(tier).toLowerCase()}`;
  const stringLine = !tier
    ? "—"
    : ownTier
      ? clean(ownStringText) || "Your own string"
      : decideAtDropOff
        ? "Decided at drop-off"
        : selectedString
          ? `${stringName(selectedString)}${effectiveGauge ? ` ${effectiveGauge}` : ""}`
          : "Stringer’s pick";
  const tensionLine = !tier
    ? "—"
    : decideAtDropOff
      ? "Decided at drop-off"
      : stringerChoosesTension ? "Stringer’s choice" : `${effectiveTension} lbs`;
  // A string the shop has priced costs labor plus the string; otherwise the service's price.
  const pricedString = effectiveChoice === STRING_CHOICE.SPECIFIED ? selectedString : null;
  const taxCents = restringTaxCents({ tier, vendor, string: pricedString });
  const totalLine = tier ? formatMoneyCents(restringUnitPrice(tier, pricedString).unitCents + taxCents) : "—";
  const taxNote = taxCents > 0 ? `incl. ${formatMoneyCents(taxCents)} sales tax` : "";
  const turnaround = Number(vendor.turnaround_days);
  const readyLine = Number.isFinite(turnaround) && turnaround > 0
    ? `${turnaround} day${turnaround === 1 ? "" : "s"} after drop-off`
    : "";

  const chooseTier = (next) => {
    setTierId(next.id);
    setStringChoice(STRING_CHOICE.SHOP);
    setStringId(null);
    setGauge(null);
    setTensionLbs(tensionConfigForCategory(next.string_category).defaultLbs);
    setBookError("");
  };

  // A string, or (null) stringer's pick, in `next`'s category. A new category resets the
  // tension to that category's recommendation.
  const chooseString = (string, next = tier) => {
    if (next && Number(next.id) !== Number(tierId)) {
      setTierId(next.id);
      setTensionLbs(tensionConfigForCategory(next.string_category).defaultLbs);
    }
    setStringChoice(string ? STRING_CHOICE.SPECIFIED : STRING_CHOICE.SHOP);
    setStringId(string ? string.id : null);
    setGauge(null);
    setBookError("");
  };

  // The string list: each category's in-stock strings with their price, the category's
  // stringer's pick, then services where the shop picks or the player brings the string.
  const stringGroups = tiers
    .filter((item) => item.string_category)
    .map((item) => ({
      tier: item,
      strings: catalog.rows
        .filter((row) => row.category === item.string_category && row.in_stock !== false)
        .sort((left, right) => stringName(left).localeCompare(stringName(right))),
    }));
  const presetTiers = tiers.filter((item) => !item.string_category && !isOwnStringTier(item));
  const ownTiers = tiers.filter((item) => isOwnStringTier(item));

  const recommendedTierId = quizResult?.options?.[0]?.service_tier_id ?? null;

  // Quiz result: preselect the recommended tier (or the nearest this shop offers), stringer's
  // pick and the recommended tension, then send the player on to the racket field.
  // A recommended string: picked like one from the list, at its suggested tension.
  const pickRecommended = (option) => {
    const next = tiers.find((item) => Number(item.id) === Number(option.service_tier_id));
    if (!next) return;
    const string = catalog.rows.find((row) => Number(row.id) === Number(option.string.id)) || { ...option.string };
    chooseString(string, next);
    setTensionLbs(clampTension(option.tension_lbs, next.string_category));
    setStringerChoosesTension(false);
  };

  // Quiz answers go to the shared recommendation engine; its pick is selected for the player,
  // with the alternatives offered beside it.
  const finishQuiz = async (answers) => {
    setQuizOpen(false);
    try {
      const result = await recommendStrings({ vendorId, answers });
      setQuizResult(result);
      if (result?.options?.[0]) pickRecommended(result.options[0]);
    } catch {
      setQuizResult({ options: [], warning: null });
    }
    window.setTimeout(() => {
      document.getElementById("vp-step-string")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  };

  const stepTension = (delta) => setTensionLbs(clampTension(effectiveTension + delta, tier?.string_category));

  const book = () => {
    const gaps = orderSelectionGaps(selection);
    if (gaps.length) {
      setBookError(GAP_MESSAGES[gaps[0]] || "Finish your order to book.");
      const step = document.getElementById(GAP_STEP_IDS[gaps[0]]);
      step?.scrollIntoView({ behavior: "smooth", block: "center" });
      if (gaps[0] === "racket") step?.querySelector("input")?.focus({ preventScroll: true });
      return;
    }
    setBookError("");
    if (isAuthenticated) {
      setCheckoutOpen(true);
      return;
    }
    // Saved before the drawer opens so the order survives sign-in, however the player signs in.
    saveOrderDraft(vendor.id, { ...draft, pendingBook: true });
    authDrawer.openAuth({
      mode: "signup",
      reason: "Sign in to confirm your restring — your choices are saved.",
      onSuccess: () => setCheckoutOpen(true),
      onDismiss: () => saveOrderDraft(vendor.id, draft),
    });
  };

  if (checkoutOpen && tier) {
    return (
      <RestringingPlayerFlow
        vendorSlug={slug}
        checkoutHandoff={{
          vendor,
          tierId: tier.id,
          item: buildVendorPageCheckoutItem(selection),
          summary: `${stringLine} · ${tensionLine} · ${clean(racketMakeModel)}`,
          onBack: () => setCheckoutOpen(false),
        }}
      />
    );
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareNote("Link copied");
    } catch {
      setShareNote(shareUrl);
    }
  };

  const share = async () => {
    setShareNote("");
    if (navigator.share) {
      try {
        await navigator.share({ title: vendor.name, text: shareText, url: shareUrl });
      } catch {
        // Share sheet dismissed.
      }
      return;
    }
    await copyLink();
  };

  return (
    <div className="dashboard-page vp-page">
      <AppNav />

      <section className="vp-hero">
        <div className="vp-wrap">
          <div className="vp-hero-top">
            {image ? (
              <img className="vp-logo" src={image} alt={`${vendor.name} logo`} />
            ) : (
              <div className="vp-logo vp-logo--empty" aria-hidden="true">{clean(vendor.name).slice(0, 1).toUpperCase()}</div>
            )}
            <div className="vp-hero-main">
              <div className="vp-eyebrow">Racket stringing{city ? ` · ${city}` : ""}</div>
              <div className="vp-title">
                <h1>{vendor.name}</h1>
                <VerifiedMark />
              </div>
              {address ? <div className="vp-addr">{address}</div> : null}
              <div className="vp-tags">
                {openStatus ? (
                  <span className={`vp-tag ${openStatus.isOpen ? "vp-tag--open" : ""}`}>{openStatus.label}</span>
                ) : null}
                {ready ? <span className="vp-tag">{ready}</span> : null}
                <span className="vp-tag vp-tag--verified"><VerifiedMark size={15} />Tennis Plan Verified</span>
                {hasGoogleSummary(vendor) ? (
                  <a className="vp-tag vp-tag--google" href="#reviews" onClick={(event) => {
                    event.preventDefault();
                    document.getElementById("reviews")?.scrollIntoView({ behavior: "smooth" });
                  }}>
                    ★ {Number(vendor.google.rating).toFixed(1)} · {Number(vendor.google.user_ratings_total)} Google reviews
                  </a>
                ) : null}
              </div>
            </div>
          </div>
          <div className="vp-actions">
            <button type="button" className="vp-btn vp-btn--primary vp-share-lg" onClick={share}>
              <Share2 size={18} /> Share this page
            </button>
            <div className="vp-actions-row">
              {vendor.phone_href ? <a className="vp-btn vp-btn--grey" href={vendor.phone_href}><Phone size={16} /> Call</a> : null}
              {vendor.sms_href ? <a className="vp-btn vp-btn--grey" href={vendor.sms_href}><MessageCircle size={16} /> Text</a> : null}
              {directions ? <a className="vp-btn vp-btn--grey" href={directions} target="_blank" rel="noreferrer"><Navigation size={16} /> Directions</a> : null}
              <button type="button" className="vp-btn vp-btn--primary vp-share-sm" onClick={share}>Share</button>
            </div>
            {shareNote ? <div className="vp-share-note" role="status">{shareNote}</div> : null}
          </div>
        </div>
      </section>

      <main className="vp-wrap vp-layout">
        <div className="vp-col">
          {description || website || googleBusinessHref ? (
            <section className="vp-card">
              <h2>About the shop</h2>
              {description ? <p className="vp-lead">{description}</p> : null}
              {website || googleBusinessHref ? (
                <div className="vp-links">
                  {website ? <a href={website} target="_blank" rel="noreferrer">{webLabel(website)} ↗</a> : null}
                  {googleBusinessHref ? <a href={googleBusinessHref} target="_blank" rel="noreferrer">Google Business profile ↗</a> : null}
                </div>
              ) : null}
            </section>
          ) : null}

          {tiers.length ? (
            <section className="vp-card vp-booking">
              <div>
                <h2>Book a restring</h2>
                <p className="vp-muted vp-booking-intro">Pick a string, then your tension.</p>
              </div>

              <div className="vp-quiz-box">
                <Lightbulb size={24} aria-hidden="true" />
                <div>
                  <b>Not sure which string you need?</b>
                  <p className="vp-muted">Answer {QUIZ_QUESTIONS.length} quick questions and we’ll recommend a string from this shop for your game.</p>
                </div>
                <button type="button" className="vp-btn vp-btn--primary" onClick={() => setQuizOpen(true)}>Take the quiz</button>
              </div>

              <div className="vp-step" id="vp-step-string">
                <div className="vp-step-h">
                  <span>1 · String</span>
                  <button type="button" className="vp-link-btn" onClick={() => setQuizOpen(true)}>Not sure? Take the quiz</button>
                </div>
                {quizResult ? (
                  quizResult.options?.length ? (
                    <div className="vp-quiz-why">
                      <p><b>Recommended for you: {stringName(quizResult.options[0].string)}.</b> {quizResult.options[0].reasons.join(" ")}</p>
                      {quizResult.warning ? <p>{quizResult.warning}</p> : null}
                      {quizResult.options.slice(1).map((option) => (
                        <p key={option.string.id}>
                          Or{" "}
                          <button type="button" className="vp-link-btn" onClick={() => pickRecommended(option)}>{stringName(option.string)}</button>
                          {" "}({formatMoneyCents(option.price_cents)}){option.differences?.length ? `: ${option.differences.join(" · ")}` : ""}
                        </p>
                      ))}
                    </div>
                  ) : (
                    <p className="vp-quiz-why">We couldn’t match a string in stock for those answers. Pick one below.</p>
                  )
                ) : null}
                <div className="vp-strings">
                  {stringGroups.map(({ tier: group, strings }) => (
                    <div key={group.id} className="vp-string-group" aria-label={tierTitle(group)}>
                      <div className="vp-muted vp-small vp-string-group__h">
                        {tierTitle(group)}
                        {Number(group.id) === Number(recommendedTierId) ? <span className="vp-pill vp-pill--rec vp-pill--inline">Recommended for you</span> : null}
                      </div>
                      {strings.map((string) => {
                        const gauges = gaugeChoiceForString(string).gauges;
                        return (
                          <button key={string.id} type="button" className="vp-opt" aria-pressed={Number(selectedString?.id) === Number(string.id)} onClick={() => chooseString(string, group)}>
                            <span className="vp-radio" />
                            <span className="vp-opt-text"><b>{stringName(string)}</b>{gauges.length ? <small>Gauge{gauges.length === 1 ? "" : "s"} {gauges.join(", ")}</small> : null}</span>
                            <span className="vp-opt-price">{formatMoneyCents(restringUnitPrice(group, string).unitCents)}</span>
                          </button>
                        );
                      })}
                      <button type="button" className="vp-opt" aria-pressed={Number(tierId) === Number(group.id) && effectiveChoice === STRING_CHOICE.SHOP} onClick={() => chooseString(null, group)}>
                        <span className="vp-radio" />
                        <span className="vp-opt-text"><b>Stringer’s pick</b><small>Any {tierTitle(group).toLowerCase()} we have in stock</small></span>
                        <span className="vp-opt-price">{formatMoneyCents(group.price_cents)}</span>
                      </button>
                    </div>
                  ))}
                  {[...presetTiers, ...ownTiers].length ? (
                    <div className="vp-string-group">
                      <div className="vp-muted vp-small vp-string-group__h">More options</div>
                      {presetTiers.map((item) => (
                        <button key={item.id} type="button" className="vp-opt" aria-pressed={Number(item.id) === Number(tierId)} onClick={() => chooseTier(item)}>
                          <span className="vp-radio" />
                          <span className="vp-opt-text"><b>{tierTitle(item)}</b>{tierSub(item) ? <small>{tierSub(item)}</small> : null}</span>
                          <span className="vp-opt-price">{formatMoneyCents(item.price_cents)}</span>
                        </button>
                      ))}
                      {ownTiers.map((item) => (
                        <button key={item.id} type="button" className="vp-opt" aria-pressed={Number(item.id) === Number(tierId)} onClick={() => chooseTier(item)}>
                          <span className="vp-radio" />
                          <span className="vp-opt-text"><b>Bring my own string</b><small>You supply the string; you pay for stringing only</small></span>
                          <span className="vp-opt-price">{formatMoneyCents(item.price_cents)}</span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                  {catalog.status === "loading" ? <p className="vp-muted vp-small">Loading strings…</p> : null}
                  {catalog.status === "error" ? <p className="vp-muted vp-small">We couldn’t load this shop’s strings. You can still book with stringer’s pick.</p> : null}
                  {ownTier ? (
                    <label className="vp-field">
                      Your string (brand and model)
                      <input value={ownStringText} onChange={(event) => setOwnStringText(event.target.value)} placeholder="e.g. Babolat RPM Blast 17" />
                      <span className="vp-muted">Bring your string set with the racket at drop-off.</span>
                    </label>
                  ) : null}
                  {tier && !ownTier ? (
                    <button type="button" className="vp-opt" aria-pressed={decideAtDropOff} onClick={() => { setStringChoice(decideAtDropOff ? STRING_CHOICE.SHOP : STRING_CHOICE.AT_DROP_OFF); setStringId(null); setGauge(null); setBookError(""); }}>
                      <span className="vp-radio" />
                      <span className="vp-opt-text"><b>Not sure? Decide at drop-off</b><small>Your stringer recommends the string and tension when you bring the racket in, at the {tierTitle(tier).toLowerCase()} price</small></span>
                    </button>
                  ) : null}
                  {selectedString && gaugeChoice.needsChoice ? (
                    <div className="vp-gauges">
                      <span>Gauge for {stringName(selectedString)}</span>
                      {gaugeChoice.gauges.map((option) => (
                        <button key={option} type="button" aria-pressed={option === effectiveGauge} onClick={() => setGauge(option)}>{option}</button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="vp-step">
                <div className="vp-step-h">2 · Tension</div>
                {!tier ? (
                  <p className="vp-muted vp-small">Choose a string first.</p>
                ) : decideAtDropOff ? (
                  <p className="vp-muted vp-small">Your stringer sets the tension with you at drop-off.</p>
                ) : (
                  <>
                    <div className={`vp-tension ${stringerChoosesTension ? "is-dim" : ""}`}>
                      <div className="vp-stepper">
                        <button type="button" aria-label="Lower tension" disabled={stringerChoosesTension || effectiveTension <= tension.minLbs} onClick={() => stepTension(-1)}><Minus size={20} /></button>
                        <div className="vp-tension-value"><b>{effectiveTension}</b> <span>lbs</span></div>
                        <button type="button" aria-label="Raise tension" disabled={stringerChoosesTension || effectiveTension >= tension.maxLbs} onClick={() => stepTension(1)}><Plus size={20} /></button>
                      </div>
                      <div className="vp-range">
                        <b>{tension.isFallback ? "Tell us the tension you want" : `Recommended for ${tierTitle(tier)}: ${tension.defaultLbs} lbs`}</b>
                        <div className="vp-track">
                          <div className="vp-knob" style={{ left: `${Math.round(((effectiveTension - tension.minLbs) / (tension.maxLbs - tension.minLbs)) * 100)}%` }} />
                        </div>
                        <div className="vp-ends"><span>{tension.minLbs} lbs</span><span>{tension.maxLbs} lbs</span></div>
                      </div>
                    </div>
                    <button type="button" className="vp-check" aria-pressed={stringerChoosesTension} onClick={() => setStringerChoosesTension((value) => !value)}>
                      <span className="vp-box">{stringerChoosesTension ? <Check size={13} strokeWidth={3.5} /> : null}</span>
                      <span>Not sure? <strong>Let my stringer choose</strong></span>
                    </button>
                  </>
                )}
              </div>

              <div className="vp-step" id="vp-step-racket">
                <div className="vp-step-h">3 · Your racket</div>
                <label className="vp-field">
                  Make and model
                  <input value={racketMakeModel} onChange={(event) => { setRacketMakeModel(event.target.value); setBookError(""); }} placeholder="e.g. Babolat Pure Aero 98" required />
                </label>
              </div>
              <p className="vp-muted vp-signin-note vp-signin-note--sm">You’ll sign in when you book — your choices are saved.</p>
            </section>
          ) : null}

          <ReviewsSection vendor={vendor} />
        </div>

        {quizOpen ? <StringQuizSheet onClose={() => setQuizOpen(false)} onFinish={finishQuiz} /> : null}

        <aside className="vp-col">
          {tiers.length ? (
            <section className="vp-card vp-order">
              <h3>Your order</h3>
              <div className="vp-rows">
                <div><span>Service</span><span>{serviceLine}</span></div>
                <div><span>String</span><span>{stringLine}</span></div>
                <div><span>Tension</span><span>{tensionLine}</span></div>
                {readyLine ? <div><span>Ready</span><span>{readyLine}</span></div> : null}
              </div>
              <div className="vp-total">
                <div><b>{totalLine}</b> {taxNote ? <small>{taxNote}</small> : null}</div>
                <button type="button" className="vp-btn vp-btn--primary vp-book" onClick={book}>Book restring</button>
              </div>
              {bookError ? <p className="vp-book-error" role="alert">{bookError}</p> : null}
              <p className="vp-muted vp-signin-note">You’ll sign in to confirm — your choices are saved.</p>
            </section>
          ) : null}

          {hours ? (
            <section className="vp-card">
              <div className="vp-card-head">
                <h3>Hours</h3>
                {openStatus ? (
                  <span className={`vp-tag ${openStatus.isOpen ? "vp-tag--open" : ""}`}>{openStatus.isOpen ? "Open now" : "Closed"}</span>
                ) : null}
              </div>
              <div className="vp-hours">
                {hours.map((day) => (
                  <div key={day.key} className={day.key === openStatus?.todayKey ? "is-today" : ""}>
                    <span>{day.label}{day.key === openStatus?.todayKey ? " · today" : ""}</span>
                    <span>{day.text}</span>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {address || collection ? (
            <section className="vp-card">
              {address ? <div className="vp-map-addr">{address}</div> : null}
              {directions ? <a className="vp-small" href={directions} target="_blank" rel="noreferrer">Get directions ↗</a> : null}
              {collection ? (
                <>
                  <div className="vp-step-h">Drop-off &amp; pickup</div>
                  <p className="vp-body">{collection}</p>
                </>
              ) : null}
            </section>
          ) : null}

          {contactRows.length ? (
            <section className="vp-card vp-card--tight">
              <h3>Contact</h3>
              <div className="vp-rows">
                {contactRows.map(([label, value]) => (
                  <div key={label}><span>{label}</span>{value}</div>
                ))}
              </div>
            </section>
          ) : null}
        </aside>
      </main>

      {tiers.length ? (
        <div className="vp-sticky">
          <div>
            <small>{bookError || (tier ? `${stringLine} · ${tensionLine}${readyLine ? ` · ready in ${readyLine.replace(" after drop-off", "")}` : ""}` : "Choose a service to book")}</small>
            {tier ? <><b>{totalLine}</b>{taxNote ? <small className="vp-sticky-tax"> {taxNote}</small> : null}</> : null}
          </div>
          <button type="button" className="vp-btn vp-btn--primary vp-book" onClick={book}>Book</button>
        </div>
      ) : null}
    </div>
  );
}
