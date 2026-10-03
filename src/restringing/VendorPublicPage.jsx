import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Check, ChevronLeft, Lightbulb, MessageCircle, Minus, Navigation, Phone, Plus, Share2, X } from "lucide-react";
import AppNav from "../components/AppNav.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useAuthDrawer } from "../context/AuthDrawerContext.jsx";
import RestringingPlayerFlow from "./RestringingPlayerFlow.jsx";
import { googleMapsUriForVendor, googleReviewsForVendor, hasGoogleSummary } from "./googleReviews.js";
import { WIZARD_QUESTIONS, formatMoneyCents, recommendStringCategory, vendorImageSrc } from "./playerFlow.js";
import { getVendorProfile, listServiceTiers, listVendorStrings, listVendors } from "./restringingService.js";
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
  saveOrderDraft,
  tensionConfigForCategory,
  tierForRecommendedCategory,
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

// The existing 4-question string quiz, as a modal (a bottom sheet on phones).
function StringQuizSheet({ onClose, onFinish }) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const sheetRef = useRef(null);
  const question = WIZARD_QUESTIONS[index];

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

  const answer = (option) => {
    const next = { ...answers, [question.key]: option };
    setAnswers(next);
    if (index + 1 < WIZARD_QUESTIONS.length) {
      setIndex(index + 1);
      return;
    }
    onFinish(recommendStringCategory(next));
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
          <span className="vp-quiz-count">Question {index + 1} of {WIZARD_QUESTIONS.length}</span>
          <button type="button" className="vp-quiz-icon" aria-label="Close" onClick={onClose}><X size={20} /></button>
        </div>
        <div className="vp-quiz-progress"><span style={{ width: `${((index + 1) / WIZARD_QUESTIONS.length) * 100}%` }} /></div>
        <h2 id="vp-quiz-question">{question.label}</h2>
        <div className="vp-quiz-options">
          {question.options.map((option) => (
            <button
              key={option}
              type="button"
              className="vp-opt vp-quiz-option"
              aria-pressed={answers[question.key] === option}
              onClick={() => answer(option)}
            >
              <span className="vp-radio" />
              <span className="vp-opt-text"><b>{option}</b></span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function VendorPublicPage({ vendorSlug: directVendorSlug = "" }) {
  const { vendorSlug: routeVendorSlug = "" } = useParams();
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
  useEffect(() => {
    if (draftRestored || !vendorId || !tiers.length || authLoading) return;
    setDraftRestored(true);
    const draft = loadOrderDraft(vendorId);
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
  }, [authLoading, draftRestored, isAuthenticated, tiers, vendorId]);

  useEffect(() => {
    if (!vendorId || !tier || isOwnStringTier(tier)) {
      setCatalog({ status: "idle", rows: [] });
      return undefined;
    }
    let cancelled = false;
    setCatalog({ status: "loading", rows: [] });
    listVendorStrings({ vendorId, serviceTierId: tier.id })
      .then((data) => {
        if (!cancelled) setCatalog({ status: "ready", rows: Array.isArray(data?.catalog) ? data.catalog : [] });
      })
      .catch(() => {
        if (!cancelled) setCatalog({ status: "error", rows: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [tier, vendorId]);

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
    ? catalog.rows.find((item) => Number(item.id) === Number(stringId)) || null
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

  const serviceLine = !tier ? "Choose a service" : ownTier ? "Restringing only" : `Restring + ${tierTitle(tier).toLowerCase()}`;
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
  const totalLine = tier ? formatMoneyCents(tier.price_cents) : "—";
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

  const chooseString = (string) => {
    setStringChoice(string ? STRING_CHOICE.SPECIFIED : STRING_CHOICE.SHOP);
    setStringId(string ? string.id : null);
    setGauge(null);
    setBookError("");
  };

  const recommendedTierId = quizResult?.tierId ?? null;

  // Quiz result: preselect the recommended tier (or the nearest this shop offers), stringer's
  // pick and the recommended tension, then send the player on to the racket field.
  const finishQuiz = (result) => {
    setQuizOpen(false);
    const recommended = tierForRecommendedCategory(tiers, result.category);
    if (!recommended) {
      setQuizResult({ tierId: null, rationale: result.rationale, label: result.categoryLabel });
      return;
    }
    chooseTier(recommended);
    setTensionLbs(clampTension(result.tensionLbs, recommended.string_category));
    setStringerChoosesTension(false);
    setQuizResult({ tierId: recommended.id, rationale: result.rationale, label: tierTitle(recommended) });
    window.setTimeout(() => {
      const step = document.getElementById("vp-step-racket");
      step?.scrollIntoView({ behavior: "smooth", block: "center" });
      step?.querySelector("input")?.focus({ preventScroll: true });
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
                <p className="vp-muted vp-booking-intro">Pick a service, then a string, then your tension.</p>
              </div>

              <div className="vp-quiz-box">
                <Lightbulb size={24} aria-hidden="true" />
                <div>
                  <b>Not sure which string you need?</b>
                  <p className="vp-muted">Answer {WIZARD_QUESTIONS.length} quick questions and we’ll recommend a string type for your game.</p>
                </div>
                <button type="button" className="vp-btn vp-btn--primary" onClick={() => setQuizOpen(true)}>Take the quiz</button>
              </div>

              <div className="vp-step" id="vp-step-service">
                <div className="vp-step-h">1 · Service</div>
                <div className="vp-grid2">
                  {tiers.map((item) => (
                    <button key={item.id} type="button" className="vp-opt" aria-pressed={Number(item.id) === Number(tierId)} onClick={() => chooseTier(item)}>
                      <span className="vp-radio" />
                      <span className="vp-opt-text">
                        <b>{tierTitle(item)}</b>
                        {tierSub(item) ? <small>{tierSub(item)}</small> : null}
                        {Number(item.id) === Number(recommendedTierId) ? <span className="vp-pill vp-pill--rec vp-pill--inline">Recommended for you</span> : null}
                      </span>
                      <span className="vp-opt-price">{formatMoneyCents(item.price_cents)}</span>
                    </button>
                  ))}
                </div>
                {quizResult ? (
                  <p className="vp-quiz-why">
                    {quizResult.tierId ? <b>Recommended for you: {quizResult.label}. </b> : <b>We suggest {quizResult.label}, which this shop doesn’t list. </b>}
                    {quizResult.rationale}
                  </p>
                ) : null}
              </div>

              <div className="vp-step" id="vp-step-string">
                <div className="vp-step-h">
                  <span>2 · String</span>
                  <button type="button" className="vp-link-btn" onClick={() => setQuizOpen(true)}>Not sure? Take the quiz</button>
                </div>
                {!tier ? (
                  <p className="vp-muted vp-small">Choose a service first.</p>
                ) : ownTier ? (
                  <label className="vp-field">
                    Your string (brand and model)
                    <input value={ownStringText} onChange={(event) => setOwnStringText(event.target.value)} placeholder="e.g. Babolat RPM Blast 17" />
                    <span className="vp-muted">Bring your string set with the racket at drop-off.</span>
                  </label>
                ) : (
                  <div className="vp-strings">
                    <div className="vp-muted vp-small">{tierTitle(tier)} strings in stock</div>
                    <button type="button" className="vp-opt" aria-pressed={effectiveChoice === STRING_CHOICE.SHOP} onClick={() => chooseString(null)}>
                      <span className="vp-radio" />
                      <span className="vp-opt-text"><b>Stringer’s pick</b><small>Any {tierTitle(tier).toLowerCase()} we have in stock</small></span>
                      <span className="vp-pill vp-pill--rec">Recommended</span>
                    </button>
                    <button type="button" className="vp-opt" aria-pressed={decideAtDropOff} onClick={() => { setStringChoice(STRING_CHOICE.AT_DROP_OFF); setStringId(null); setGauge(null); setBookError(""); }}>
                      <span className="vp-radio" />
                      <span className="vp-opt-text"><b>Not sure? Decide at drop-off</b><small>Your stringer recommends the string and tension when you bring the racket in</small></span>
                    </button>
                    {catalog.rows.map((string) => {
                      const gauges = gaugeChoiceForString(string).gauges;
                      return (
                        <button key={string.id} type="button" className="vp-opt" aria-pressed={Number(selectedString?.id) === Number(string.id)} onClick={() => chooseString(string)}>
                          <span className="vp-radio" />
                          <span className="vp-opt-text"><b>{stringName(string)}</b>{gauges.length ? <small>Gauge{gauges.length === 1 ? "" : "s"} {gauges.join(", ")}</small> : null}</span>
                          <span className="vp-pill">In stock</span>
                        </button>
                      );
                    })}
                    {catalog.status === "loading" ? <p className="vp-muted vp-small">Loading strings…</p> : null}
                    {catalog.status === "error" ? <p className="vp-muted vp-small">We couldn’t load this shop’s strings. You can still book with stringer’s pick.</p> : null}
                    {catalog.status === "ready" && !catalog.rows.length ? <p className="vp-muted vp-small">This shop hasn’t listed its strings yet.</p> : null}
                    {selectedString && gaugeChoice.needsChoice ? (
                      <div className="vp-gauges">
                        <span>Gauge for {stringName(selectedString)}</span>
                        {gaugeChoice.gauges.map((option) => (
                          <button key={option} type="button" aria-pressed={option === effectiveGauge} onClick={() => setGauge(option)}>{option}</button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                )}
              </div>

              <div className="vp-step">
                <div className="vp-step-h">3 · Tension</div>
                {!tier ? (
                  <p className="vp-muted vp-small">Choose a service first.</p>
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
                <div className="vp-step-h">4 · Your racket</div>
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
                <div><b>{totalLine}</b> {tier ? <small>+ tax</small> : null}</div>
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
            {tier ? <><b>{totalLine}</b><small className="vp-sticky-tax"> + tax</small></> : null}
          </div>
          <button type="button" className="vp-btn vp-btn--primary vp-book" onClick={book}>Book</button>
        </div>
      ) : null}
    </div>
  );
}
