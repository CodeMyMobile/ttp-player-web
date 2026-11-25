import { useCallback, useEffect, useState } from "react";
import { ChevronRight, ClipboardList, Lightbulb, MapPin, Navigation, RotateCcw, Target } from "lucide-react";
import { formatMoneyCents, isPresetCompositionTier, vendorImageSrc } from "./playerFlow.js";
import { directionsUrl, displayAddress } from "./myOrders.js";
import { distanceLabel, lastRestring, orderAgainCard, stringerListing, stringerTags } from "./entryV2.js";
import { listVendorStrings, listVendors } from "./restringingService.js";
import {
  DEFAULT_RADIUS_MILES,
  getStoredLocation,
  getStoredLocationRadius,
  requestLocationPicker,
  USER_LOCATION_CHANGED_EVENT,
} from "../utils/userLocation";
import "./RestringEntryV2.css";

const takesOwnString = (tiers) =>
  (Array.isArray(tiers) ? tiers : []).some((tier) => tier.string_category == null && !isPresetCompositionTier(tier));

/**
 * The shops to list (see stringerListing for which, and why), each with how many strings it
 * has in stock. Loads again when the player changes their location, and on retry.
 */
function useNearbyStringers() {
  const [state, setState] = useState({ loading: true, error: false, mode: "all", radius: null, vendors: [], stringCounts: {} });
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((count) => count + 1), []);

  useEffect(() => {
    window.addEventListener(USER_LOCATION_CHANGED_EVENT, retry);
    return () => window.removeEventListener(USER_LOCATION_CHANGED_EVENT, retry);
  }, [retry]);

  useEffect(() => {
    let cancelled = false;
    const position = getStoredLocation();
    const radius = position ? getStoredLocationRadius() ?? DEFAULT_RADIUS_MILES : null;
    setState((previous) => ({ ...previous, loading: true, error: false }));
    listVendors(position ? { lat: position.latitude, lng: position.longitude } : {})
      .then(async (rows) => {
        const { mode, vendors } = stringerListing(rows, { hasLocation: Boolean(position), radiusMiles: radius });
        const counts = await Promise.all(
          vendors.map((vendor) =>
            listVendorStrings({ vendorId: vendor.id })
              .then((data) => (Array.isArray(data?.catalog) ? data.catalog.length : null))
              .catch(() => null),
          ),
        );
        if (cancelled) return;
        setState({
          loading: false,
          error: false,
          mode,
          radius,
          vendors,
          stringCounts: Object.fromEntries(vendors.map((vendor, index) => [vendor.id, counts[index]])),
        });
      })
      .catch(() => {
        // Not "no stringers nearby": we don't know, so say so and offer to try again.
        if (!cancelled) setState({ loading: false, error: true, mode: "all", radius, vendors: [], stringCounts: {} });
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);
  return { ...state, retry };
}

// The last order's shop's strings for its service, so the Order again price includes a
// string the shop has priced. Loading until they arrive; empty (the service's price) on error.
function useShopStrings(entry) {
  const vendorId = entry?.order?.vendor_id ?? null;
  const serviceTierId = entry?.item?.service_tier_id ?? null;
  const hasString = entry?.item?.string_id != null;
  const [state, setState] = useState({ key: "", loading: false, catalog: [] });
  const key = hasString && vendorId && serviceTierId ? `${vendorId}:${serviceTierId}` : "";
  useEffect(() => {
    if (!key) return undefined;
    let cancelled = false;
    setState({ key, loading: true, catalog: [] });
    listVendorStrings({ vendorId, serviceTierId })
      .then((data) => {
        if (!cancelled) setState({ key, loading: false, catalog: data?.catalog || [] });
      })
      .catch(() => {
        if (!cancelled) setState({ key, loading: false, catalog: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [key, serviceTierId, vendorId]);
  return state.key === key ? state : { loading: Boolean(key), catalog: [] };
}

/**
 * The redesigned restring entry (VITE_RESTRING_V2): Order again, the two ways in, Stringers
 * near you, and My orders. Choosing and paying stay in RestringingPlayerFlow.
 */
export default function RestringEntryV2({ tiers, orders, isAuthenticated, ordersLine, busy, onKnow, onHelp, onShop, onOrders, onReorder }) {
  const entry = lastRestring(orders);
  const againCatalog = useShopStrings(entry);
  const card = orderAgainCard(entry, tiers, againCatalog.catalog);
  const nearby = useNearbyStringers();
  const ownString = takesOwnString(tiers);

  return (
    <div className="rsx">
      <header className="rsx-title">
        <h1>Restring</h1>
        <p>Fresh strings, from a stringer near you.</p>
      </header>

      {card ? (
        <section className="rsx-again" aria-label="Order again">
          <span className="rsx-again__label">
            <RotateCcw size={14} aria-hidden="true" /> Order again
          </span>
          <b className="rsx-again__string">{card.string}</b>
          <span className="rsx-again__detail">{card.tension} · {card.racket}</span>
          <span className="rsx-again__meta">
            {[card.shop, card.date ? `Last strung ${card.date}` : ""].filter(Boolean).join(" · ")}
          </span>
          <div className="rsx-again__row">
            <strong>{againCatalog.loading ? "" : formatMoneyCents(card.priceCents)}</strong>
            <button type="button" className="rsx-again__btn" disabled={busy} onClick={() => onReorder(entry)}>
              {busy ? "Loading…" : "Reorder"}
            </button>
          </div>
        </section>
      ) : null}

      <div className="rsx-choices">
        <button type="button" className="rsx-choice" onClick={onKnow}>
          <span className="rsx-icon"><Target size={22} aria-hidden="true" /></span>
          <b>I know what I want</b>
          <small>Pick your string from what’s in stock</small>
        </button>
        <button type="button" className="rsx-choice" onClick={onHelp}>
          <span className="rsx-icon"><Lightbulb size={22} aria-hidden="true" /></span>
          <b>Help me choose</b>
          <small>4 quick questions</small>
        </button>
      </div>

      <section className="rsx-section" aria-label={nearby.mode === "all" ? "Stringers" : "Stringers near you"}>
        <h2>{nearby.mode === "all" && !nearby.loading ? "Stringers" : "Stringers near you"}</h2>
        {!nearby.loading && !nearby.error && nearby.mode === "all" ? (
          <div className="rsx-note">
            <MapPin size={18} aria-hidden="true" />
            <p>
              <b>Where do you play?</b>
              <span>Set your location to see stringers near you.</span>
            </p>
            <button type="button" className="rsx-note__btn" onClick={requestLocationPicker}>
              Set location
            </button>
          </div>
        ) : null}
        {!nearby.loading && nearby.mode === "nearest" ? (
          <div className="rsx-note">
            <MapPin size={18} aria-hidden="true" />
            <p>
              <b>No stringers within {nearby.radius} mi</b>
              <span>{nearby.vendors.length === 1 ? "Here’s the nearest one." : "Here are the nearest."}</span>
            </p>
            <button type="button" className="rsx-note__btn" onClick={requestLocationPicker}>
              Change area
            </button>
          </div>
        ) : null}
        {nearby.loading ? (
          <p className="rsx-muted">Finding stringers…</p>
        ) : nearby.error ? (
          <div className="rsx-note rsx-note--error" role="alert">
            <p>
              <b>Couldn’t load stringers</b>
              <span>Check your connection and try again.</span>
            </p>
            <button type="button" className="rsx-note__btn" onClick={nearby.retry}>
              Try again
            </button>
          </div>
        ) : nearby.vendors.length === 0 ? (
          <p className="rsx-muted">No stringers on The Tennis Plan yet.</p>
        ) : (
          nearby.vendors.map((vendor) => {
            const tags = stringerTags(vendor, { stringCount: nearby.stringCounts[vendor.id], takesOwnString: ownString });
            const directions = directionsUrl(vendor.address);
            const distance = distanceLabel(vendor);
            return (
              <article key={vendor.id} className="rsx-shop">
                {/* The card orders from this shop: its strings, then the rest of the flow. */}
                <button type="button" className="rsx-shop__pick" disabled={busy} onClick={() => onShop(vendor)}>
                  <span className="rsx-shop__img">
                    {vendorImageSrc(vendor) ? <img src={vendorImageSrc(vendor)} alt="" /> : <span aria-hidden="true">🎾</span>}
                  </span>
                  <span className="rsx-shop__body">
                    <b>{vendor.name}</b>
                    <span className="rsx-shop__addr">
                      <MapPin size={13} aria-hidden="true" />
                      {[displayAddress(vendor.address) || "Address pending", distance].filter(Boolean).join(" · ")}
                    </span>
                    {tags.length ? (
                      <span className="rsx-shop__tags">
                        {tags.map((tag) => <span key={tag} className="rsx-tag">{tag}</span>)}
                      </span>
                    ) : null}
                    <span className="rsx-shop__cta">See strings and order</span>
                  </span>
                  <ChevronRight className="rsx-shop__chev" size={18} aria-hidden="true" />
                </button>
                {directions ? (
                  <a className="rsx-shop__dir" href={directions} target="_blank" rel="noopener noreferrer">
                    <Navigation size={14} aria-hidden="true" /> Directions
                  </a>
                ) : null}
              </article>
            );
          })
        )}
      </section>

      <button type="button" className="rsx-orders" onClick={onOrders}>
        <span className="rsx-icon"><ClipboardList size={20} aria-hidden="true" /></span>
        <span className="rsx-orders__text">
          <b>My orders</b>
          <small>{isAuthenticated ? ordersLine : "Sign in to see your restrings"}</small>
        </span>
        <ChevronRight size={18} aria-hidden="true" />
      </button>
    </div>
  );
}
