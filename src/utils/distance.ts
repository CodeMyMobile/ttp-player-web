import { getStoredLocation, type Coordinates } from "./userLocation";

// Great-circle (straight-line) distance in miles. Extracted from the match distance math in
// play-dates/TennisMatchApp.jsx so leagues and matches report the same numbers from one place.
// NOTE: this is straight-line, not drive-time — callers must label it "~X mi", never "X min"
// (the app has no routing source; see docs/ui-feasibility-audit.md item 8).
const EARTH_RADIUS_MILES = 3958.8;
const toRad = (value: number) => (value * Math.PI) / 180;

// Number(null) is 0 and Number("") is 0 — which would silently compute a bogus distance to
// the equator/prime-meridian. Treat null/undefined/empty as invalid so missing coords omit
// the chip (the degradation rule) instead of showing a wrong number.
const coord = (value: number | string | null | undefined): number => {
  if (value === null || value === undefined || value === "") return Number.NaN;
  return Number(value);
};

export const distanceMiles = (
  lat1: number | string | null | undefined,
  lon1: number | string | null | undefined,
  lat2: number | string | null | undefined,
  lon2: number | string | null | undefined,
): number | null => {
  const a1 = coord(lat1);
  const o1 = coord(lon1);
  const a2 = coord(lat2);
  const o2 = coord(lon2);
  if ([a1, o1, a2, o2].some((value) => Number.isNaN(value))) return null;

  const dLat = toRad(a2 - a1);
  const dLon = toRad(o2 - o1);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a1)) * Math.cos(toRad(a2)) * Math.sin(dLon / 2) ** 2;
  const distance = EARTH_RADIUS_MILES * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  if (!Number.isFinite(distance)) return null;
  return Math.round(distance * 10) / 10;
};

// "~7 mi". Straight-line, so deliberately no "min". null → caller omits the chip entirely.
export const formatDistanceMiles = (miles: number | null | undefined): string | null =>
  miles == null ? null : `~${Math.round(miles)} mi`;

type VenueLike = {
  venue_latitude?: number | string | null;
  venue_longitude?: number | string | null;
};

// Distance from the player's stored location to a league's venue. The League type carries
// venue_latitude/venue_longitude (the prompt's "League.latitude/longitude" maps to these).
// Returns null when either side is unknown — no stored player location (permission denied /
// not set) or the league has no venue coords — so the caller drops the chip rather than guess.
export const leagueVenueDistanceMiles = (
  league: VenueLike,
  playerCoords: Coordinates | null = getStoredLocation(),
): number | null => {
  if (!playerCoords) return null;
  return distanceMiles(
    playerCoords.latitude,
    playerCoords.longitude,
    league.venue_latitude,
    league.venue_longitude,
  );
};
