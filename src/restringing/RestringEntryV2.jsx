import { useEffect, useState } from "react";
import { ChevronRight, ClipboardList, Lightbulb, MapPin, Navigation, RotateCcw, Target } from "lucide-react";
import { formatMoneyCents, isPresetCompositionTier, vendorImageSrc } from "./playerFlow.js";
import { directionsUrl, displayAddress } from "./myOrders.js";
import { distanceLabel, lastRestring, nearbyStringers, orderAgainCard, stringerTags } from "./entryV2.js";
import { listVendorStrings, listVendors } from "./restringingService.js";
import { DEFAULT_RADIUS_MILES, getStoredLocation, getStoredLocationRadius } from "../utils/userLocation";
import "./RestringEntryV2.css";

const takesOwnString = (tiers) =>
  (Array.isArray(tiers) ? tiers : []).some((tier) => tier.string_category == null && !isPresetCompositionTier(tier));

/**
 * Shops within the player's Home location radius (every shop when they haven't set one),
 * each with how many strings it has in stock.
 */
function useNearbyStringers() {
  const [state, setState] = useState({ loading: true, vendors: [], stringCounts: {} });
  useEffect(() => {
    let cancelled = false;
    const position = getStoredLocation();
    listVendors(position ? { lat: position.latitude, lng: position.longitude } : {})
      .then(async (rows) => {
        const vendors = nearbyStringers(rows, position ? getStoredLocationRadius() ?? DEFAULT_RADIUS_MILES : null);
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
          vendors,
          stringCounts: Object.fromEntries(vendors.map((vendor, index) => [vendor.id, counts[index]])),
        });
      })
      .catch(() => {
        if (!cancelled) setState({ loading: false, vendors: [], stringCounts: {} });
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return state;
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
export default function RestringEntryV2({ tiers, orders, isAuthenticated, ordersLine, busy, onKnow, onHelp, onOrders, onReorder }) {
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

      <section className="rsx-section" aria-label="Stringers near you">
        <h2>Stringers near you</h2>
        {nearby.loading ? (
          <p className="rsx-muted">Finding stringers…</p>
        ) : nearby.vendors.length === 0 ? (
          <p className="rsx-muted">No stringers within your area yet.</p>
        ) : (
          nearby.vendors.map((vendor) => {
            const tags = stringerTags(vendor, { stringCount: nearby.stringCounts[vendor.id], takesOwnString: ownString });
            const directions = directionsUrl(vendor.address);
            const distance = distanceLabel(vendor);
            return (
              <article key={vendor.id} className="rsx-shop">
                <div className="rsx-shop__img">
                  {vendorImageSrc(vendor) ? <img src={vendorImageSrc(vendor)} alt="" /> : <span aria-hidden="true">🎾</span>}
                </div>
                <div className="rsx-shop__body">
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
                  {directions ? (
                    <a className="rsx-shop__dir" href={directions} target="_blank" rel="noopener noreferrer">
                      <Navigation size={14} aria-hidden="true" /> Directions
                    </a>
                  ) : null}
                </div>
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
