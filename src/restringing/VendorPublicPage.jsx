import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { MessageCircle, Navigation, Phone, Share2 } from "lucide-react";
import AppNav from "../components/AppNav.jsx";
import RestringingPlayerFlow from "./RestringingPlayerFlow.jsx";
import { googleMapsUriForVendor, googleReviewsForVendor, hasGoogleSummary } from "./googleReviews.js";
import { vendorImageSrc } from "./playerFlow.js";
import { getVendorProfile, listVendors } from "./restringingService.js";
import { parseVendorHours, vendorOpenStatus } from "./vendorPage.js";
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

export default function VendorPublicPage({ vendorSlug: directVendorSlug = "" }) {
  const { vendorSlug: routeVendorSlug = "" } = useParams();
  const slug = clean(directVendorSlug || routeVendorSlug);
  const [status, setStatus] = useState("loading");
  const [vendor, setVendor] = useState(null);
  const [now, setNow] = useState(() => new Date());
  const [shareNote, setShareNote] = useState("");

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
  const collection = clean(vendor.collection_details);
  const shareUrl = `${window.location.origin}/${vendorSlug(vendor.name)}`;
  const shareText = `Book a restring at ${vendor.name}`;
  const contactRows = [
    vendor.owner_name ? ["Owner", <span key="owner">{vendor.owner_name}</span>] : null,
    vendor.public_phone ? ["Phone", <a key="phone" href={vendor.phone_href}>{formatPhone(vendor.public_phone)}</a>] : null,
    vendor.contact_email ? ["Email", <a key="email" href={`mailto:${vendor.contact_email}`}>{vendor.contact_email}</a>] : null,
    website ? ["Website", <a key="web" href={website} target="_blank" rel="noreferrer">{webLabel(website)}</a>] : null,
    googleBusinessHref ? ["Google", <a key="google" href={googleBusinessHref} target="_blank" rel="noreferrer">Business profile ↗</a>] : null,
  ].filter(Boolean);

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

          <ReviewsSection vendor={vendor} />
        </div>

        <aside className="vp-col">
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
              {directions ? (
                <a className="vp-map" href={directions} target="_blank" rel="noreferrer" aria-label="Get directions in Google Maps"><i /></a>
              ) : null}
              {address ? <div className="vp-map-addr">{address}</div> : null}
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
    </div>
  );
}
