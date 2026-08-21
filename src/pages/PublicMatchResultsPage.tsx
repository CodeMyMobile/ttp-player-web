import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import usePlayerIdentity from "../hooks/usePlayerIdentity";
import { usableAvatar } from "../utils/avatar";
import { buildViewerIdentities, matchesViewer } from "../utils/leagueSeason";
import { sortByRatingDesc } from "../api/matchResults";
import { useNavigate } from "react-router-dom";
import Autocomplete from "react-google-autocomplete";
import {
  Activity,
  ArrowDown,
  ArrowUp,
  BarChart3,
  MapPin,
  Search,
  ShieldCheck,
  Swords,
  Trophy,
  Users,
} from "lucide-react";

import { buildApiUrl } from "../api/config";
import api, { unwrap } from "../services/api";
import type { ConnectIntent } from "../types/matchPlay";
import { shouldShowEstimateBadge } from "../utils/ratingBadges";
import { deriveNtrp, deriveUtr } from "../utils/ratingConversions";
import {
  DEFAULT_RADIUS_MILES,
  getStoredLocation,
  getStoredLocationLabel,
  getStoredLocationRadius,
  storeLocation,
  storeLocationLabel,
  storeLocationRadius,
  USER_LOCATION_CHANGED_EVENT,
} from "../utils/userLocation";

export type Ranking = {
  rank: number;
  user_id: number | string;
  full_name: string;
  profile_picture?: string | null;
  current_rating: number | string | null;
  starting_rating?: number | string | null;
  previous_rating?: number | string | null;
  self_rated_seed?: number | string | null;
  rating_change: number | string | null;
  matches_played: number;
  wins: number;
  losses: number;
  is_provisional: boolean;
  is_estimate: boolean;
  usta_rating?: string | number | null;
  uta_rating?: string | number | null;
  calculated_ntrp?: string | number | null;
  calculated_utr?: string | number | null;
  rating_gender?: string | null;
  rating_leagues?: string | null;
  primary_court?: string | null;
  court_area?: string | null;
  court_locations?: Array<{
    id?: number | string | null;
    location?: string | null;
    area?: string | null;
    latitude?: string | number | null;
    longitude?: string | number | null;
    location_type?: string | null;
  }> | null;
  distance_miles?: number | string | null;
};

export type DecoratedRanking = Ranking & {
  /** Position after sorting by rating — not the API's proximity `rank`. */
  ladderPosition?: number;
  initials: string;
  ratingNumber: number;
  ratingLabel: string;
  ntrpLabel: string;
  utrLabel: string;
  primaryCourt: string;
  avatarClass: string;
  avatarToneClass: string;
  photoUrl: string | null;
  distanceMiles: number | null;
  distanceLabel: string | null;
};

export type RankingsUrlFilters = {
  nearLat?: number | null;
  nearLng?: number | null;
  radiusMiles?: number | null;
};

type Coordinates = { latitude: number; longitude: number };

export type PlayedCourt = {
  id: number | string;
  name: string;
  area?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  matches_played?: number | string | null;
};

const WEST_LA_COURTS = [
  { name: "Cheviot Hills", area: "Rancho Park" },
  { name: "Westwood Rec", area: "Westwood" },
  { name: "Penmar Recreation Center", area: "Venice" },
  { name: "Stoner Park", area: "Sawtelle" },
  { name: "Mar Vista Courts", area: "Mar Vista" },
  { name: "Santa Monica Tennis Center", area: "Santa Monica" },
];

const AVATAR_CLASSES = [
  ["bg-violet-100", "text-violet-700"],
  ["bg-emerald-100", "text-emerald-700"],
  ["bg-sky-100", "text-sky-700"],
  ["bg-rose-100", "text-rose-700"],
  ["bg-amber-100", "text-amber-700"],
  ["bg-indigo-100", "text-indigo-700"],
];

/**
 * A photo for this player from the rankings row.
 *
 * The signed-in player is the exception — the app already holds their photo
 * from their own profile, and the call sites pass it in.
 */
const PHOTO_FIELDS = [
  "profile_picture",
  "profile_image",
  "profileImage",
  "image",
  "image_url",
  "imageUrl",
  "avatar_url",
  "avatarUrl",
  "photo",
  "photoUrl",
  "picture",
] as const;

const photoFromRanking = (ranking: Ranking): string | null => {
  const record = ranking as unknown as Record<string, unknown>;
  for (const field of PHOTO_FIELDS) {
    const value = record[field];
    // usableAvatar rejects a bare bucket root, which would render as a broken
    // image rather than falling back to the initials that were already there.
    const usable = typeof value === "string" ? usableAvatar(value) : null;
    if (usable) return usable;
  }
  return null;
};

const toNumber = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const toFiniteCoordinate = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const stableSeed = (ranking: Pick<Ranking, "user_id" | "full_name">) => {
  const source = `${ranking.user_id}:${ranking.full_name}`;
  let seed = 0;
  for (let index = 0; index < source.length; index += 1) {
    seed = (seed * 31 + source.charCodeAt(index)) % 9973;
  }
  return seed;
};

const formatRating = (value: unknown, digits = 3, fallback = "-") => {
  const parsed = toNumber(value);
  return parsed === null ? fallback : parsed.toFixed(digits);
};

const formatDistance = (value: unknown) => {
  const parsed = toNumber(value);
  if (parsed === null) return null;
  if (parsed < 10) return `${parsed.toFixed(1)} mi`;
  return `${Math.round(parsed)} mi`;
};

export const formatCoordinatesLabel = (coords: Coordinates) => (
  `${Math.abs(coords.latitude).toFixed(2)}° ${coords.latitude >= 0 ? "N" : "S"}, ${Math.abs(coords.longitude).toFixed(2)}° ${coords.longitude >= 0 ? "E" : "W"}`
);

export const buildReverseGeocodeUrl = (coords: Coordinates) => {
  const query = new URLSearchParams({
    format: "jsonv2",
    lat: coords.latitude.toString(),
    lon: coords.longitude.toString(),
  });
  return `https://nominatim.openstreetmap.org/reverse?${query.toString()}`;
};

export const labelFromReverseGeocode = (data: unknown, fallback: string) => {
  const record = data as { address?: Record<string, unknown>; display_name?: string };
  const address = record?.address ?? {};
  const locality =
    (address.city as string | undefined) ||
    (address.town as string | undefined) ||
    (address.village as string | undefined) ||
    (address.hamlet as string | undefined) ||
    (address.suburb as string | undefined) ||
    (address.county as string | undefined);
  const region = (address.state as string | undefined) || (address.region as string | undefined);
  const countryCode = typeof address.country_code === "string" ? address.country_code.toUpperCase() : null;
  const labelParts = [locality, region, countryCode].filter(Boolean) as string[];
  if (labelParts.length) return labelParts.join(", ");
  return record?.display_name?.split(",").slice(0, 2).join(", ").trim() || fallback;
};

export const calculateDistanceMiles = (from: Coordinates, to: Coordinates) => {
  const earthRadiusMiles = 3958.8;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const latDelta = toRadians(to.latitude - from.latitude);
  const lngDelta = toRadians(to.longitude - from.longitude);
  const fromLat = toRadians(from.latitude);
  const toLat = toRadians(to.latitude);
  const a = Math.sin(latDelta / 2) ** 2
    + Math.cos(fromLat) * Math.cos(toLat) * Math.sin(lngDelta / 2) ** 2;
  return 2 * earthRadiusMiles * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export const resolveCourtFilterSelection = ({
  court,
  location,
  radiusMiles,
}: {
  court: PlayedCourt;
  location?: Coordinates | null;
  radiusMiles: number;
}) => {
  const latitude = toFiniteCoordinate(court.latitude);
  const longitude = toFiniteCoordinate(court.longitude);
  const fallback = { clearLocation: false, nearLat: null, nearLng: null };
  if (latitude === null || longitude === null) return fallback;

  const courtCoords = { latitude, longitude };
  const distance = location ? calculateDistanceMiles(location, courtCoords) : null;
  return {
    clearLocation: distance !== null && distance > radiusMiles,
    nearLat: latitude,
    nearLng: longitude,
  };
};

export const buildRankingsUrl = ({ nearLat, nearLng, radiusMiles }: RankingsUrlFilters = {}) => {
  const params = new URLSearchParams();
  if (Number.isFinite(nearLat) && Number.isFinite(nearLng)) {
    params.set("near_lat", String(nearLat));
    params.set("near_lng", String(nearLng));
    if (Number.isFinite(radiusMiles) && Number(radiusMiles) > 0) {
      params.set("radius_miles", String(radiusMiles));
    }
  }

  const query = params.toString();
  return buildApiUrl(`/match-results/rankings${query ? `?${query}` : ""}`);
};

const initials = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  if (!parts.length) return "TP";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
};

const estimateNtrp = (ranking: Ranking) =>
  deriveNtrp(ranking.calculated_ntrp ?? ranking.usta_rating, ranking.current_rating, ranking.rating_gender).value ?? "-";

const estimateUtr = (ranking: Ranking) =>
  deriveUtr(ranking.calculated_utr ?? ranking.uta_rating, ranking.current_rating).value ?? "-";

export const decorateRankings = (rankings: Ranking[]): DecoratedRanking[] =>
  rankings
    .map((ranking) => {
      const seed = stableSeed(ranking);
      const fallbackCourt = WEST_LA_COURTS[seed % WEST_LA_COURTS.length];
      const backendCourt = Array.isArray(ranking.court_locations) ? ranking.court_locations[0] : null;
      const primaryCourt = ranking.primary_court || backendCourt?.location || fallbackCourt.name;
      const avatar = AVATAR_CLASSES[seed % AVATAR_CLASSES.length];
      const ratingNumber = toNumber(ranking.current_rating) ?? toNumber(ranking.self_rated_seed) ?? 0;
      const distanceMiles = toNumber(ranking.distance_miles);
      return {
        ...ranking,
        initials: initials(ranking.full_name),
        ratingNumber,
        ratingLabel: formatRating(ratingNumber),
        ntrpLabel: estimateNtrp(ranking),
        utrLabel: estimateUtr(ranking),
        primaryCourt,
        avatarClass: avatar[0],
        avatarToneClass: avatar[1],
        photoUrl: photoFromRanking(ranking),
        distanceMiles,
        distanceLabel: formatDistance(distanceMiles),
      };
    })
    .sort(() => 0);

/**
 * Ladder order, and the position printed beside each player.
 *
 * The API's `rank` is assigned after it re-sorts by distance, so under the geo
 * scoping this page uses it is proximity order — "#1" meant nearest, not best.
 * Ordering by current_rating here, and numbering from that order, is what makes
 * the column mean what it says.
 *
 * sortByRatingDesc is shared with the home tile's position so the two cannot
 * disagree about where a player sits.
 */
export const orderLadder = (rankings: DecoratedRanking[]): DecoratedRanking[] =>
  sortByRatingDesc(rankings).map((ranking, index) => ({ ...ranking, ladderPosition: index + 1 }));

/**
 * Which row is the signed-in player, or null.
 *
 * Null highlights nobody. Previously this fell back to decorated[3] — the fourth
 * row — so a logged-out visitor, or a player outside the radius, was shown a
 * stranger badged "you" and every "from you" delta was measured from them.
 *
 * Matched on id OR name, not id alone: the account id and the ranking's user_id
 * are different id-spaces, so comparing only ids silently finds nobody. That is
 * the same trap buildViewerIdentities was written for on the leagues page.
 */
export const findViewer = (
  rankings: DecoratedRanking[],
  identities: Set<string>,
): DecoratedRanking | null => {
  if (!identities?.size) return null;
  return rankings.find((ranking) => matchesViewer(identities, ranking.user_id, ranking.full_name)) ?? null;
};

export const getSuggestedRankings = (
  rankings: DecoratedRanking[],
  viewer?: DecoratedRanking | null,
  limit = 3,
) => {
  if (!viewer) return rankings.slice(0, limit);
  return rankings
    .filter((ranking) => String(ranking.user_id) !== String(viewer.user_id))
    .map((ranking) => ({ ranking, delta: Math.abs(ranking.ratingNumber - viewer.ratingNumber) }))
    .sort((a, b) => a.delta - b.delta || Number(a.ranking.ladderPosition ?? a.ranking.rank) - Number(b.ranking.ladderPosition ?? b.ranking.rank))
    .slice(0, limit)
    .map(({ ranking }) => ranking);
};

export const buildChallengeState = (ranking: DecoratedRanking): { connectIntent: ConnectIntent } => ({
  connectIntent: {
    invitee: {
      id: String(ranking.user_id),
      name: ranking.full_name,
      level: `TRP ${ranking.ratingLabel}`,
    },
    senderLevel: "TRP",
    suggestedAvailability: [],
    preferredCourt: ranking.primaryCourt,
    source: "match-results-ladder",
    senderName: "West LA Ladder",
  },
});

const displayChange = (value: unknown) => {
  const parsed = toNumber(value);
  if (parsed === null || Math.abs(parsed) < 0.001) return { label: "0.000", tone: "text-slate-400", icon: null };
  return {
    label: `${parsed > 0 ? "+" : ""}${parsed.toFixed(3)}`,
    tone: parsed > 0 ? "text-emerald-600" : "text-rose-600",
    icon: parsed > 0 ? "up" : "down",
  };
};

const clickOnKeyboard = (event: React.KeyboardEvent, action: () => void) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  action();
};

const radiusOptions = [5, 10, 25, 50];

export default function PublicMatchResultsPage() {
  const navigate = useNavigate();
  const { avatarUrl: viewerPhotoUrl } = usePlayerIdentity();
  const storedLocation = getStoredLocation();
  const [rankings, setRankings] = useState<Ranking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [locationSearch, setLocationSearch] = useState(() => getStoredLocationLabel() || "");
  const [locationKey, setLocationKey] = useState(0);
  const [nearLat, setNearLat] = useState<number | null>(() => storedLocation?.latitude ?? null);
  const [nearLng, setNearLng] = useState<number | null>(() => storedLocation?.longitude ?? null);
  const [radiusMiles, setRadiusMiles] = useState(() => getStoredLocationRadius() ?? DEFAULT_RADIUS_MILES);
  const { user } = useAuth();
  const viewerIdentities = useMemo(() => {
    // The fetched player profile carries the identity the rankings use; the thin
    // auth user often does not.
    let profile = null;
    try {
      const raw = window.localStorage.getItem("playerPersonalDetails");
      profile = raw ? JSON.parse(raw) : null;
    } catch {
      profile = null;
    }
    return buildViewerIdentities(user, profile);
  }, [user]);
  const [playedCourts, setPlayedCourts] = useState<PlayedCourt[]>([]);
  const [selectedCourtId, setSelectedCourtId] = useState("");

  const applyLocation = ({ label, latitude, longitude, persist = false }: {
    label: string;
    latitude: number;
    longitude: number;
    persist?: boolean;
  }) => {
    setLocationSearch(label);
    setNearLat(latitude);
    setNearLng(longitude);
    setSelectedCourtId("");
    setLocationKey((key) => key + 1);
    if (persist) {
      storeLocation({ latitude, longitude });
      storeLocationLabel(label);
    }
  };

  const clearLocationState = () => {
    setLocationSearch("");
    setLocationKey((key) => key + 1);
  };

  useEffect(() => {
    const syncStoredLocation = () => {
      const nextLocation = getStoredLocation();
      const nextRadius = getStoredLocationRadius();
      if (nextRadius !== null) setRadiusMiles(nextRadius);
      if (!nextLocation) return;

      applyLocation({
        label: getStoredLocationLabel() || "Current location",
        latitude: nextLocation.latitude,
        longitude: nextLocation.longitude,
      });
    };

    window.addEventListener(USER_LOCATION_CHANGED_EVENT, syncStoredLocation);
    return () => window.removeEventListener(USER_LOCATION_CHANGED_EVENT, syncStoredLocation);
  }, []);

  useEffect(() => {
    if (storedLocation || typeof navigator === "undefined" || !navigator.geolocation) {
      return;
    }

    let cancelled = false;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (cancelled) return;
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
        applyLocation({ label: "Current location", latitude, longitude, persist: true });
      },
      () => undefined,
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 },
    );

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (nearLat === null || nearLng === null) return;
    if (selectedCourtId) return;
    if (locationSearch && locationSearch !== "Current location") return;

    const coords = { latitude: nearLat, longitude: nearLng };
    const fallback = formatCoordinatesLabel(coords);
    let cancelled = false;
    const controller = new AbortController();

    fetch(buildReverseGeocodeUrl(coords), {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        const label = labelFromReverseGeocode(data, fallback);
        setLocationSearch(label);
        setLocationKey((key) => key + 1);
        storeLocationLabel(label);
      })
      .catch(() => {
        if (cancelled) return;
        setLocationSearch(fallback);
        setLocationKey((key) => key + 1);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [locationSearch, nearLat, nearLng, selectedCourtId]);

  useEffect(() => {
    let alive = true;
    unwrap(api("/match-results/my-courts"))
      .then((data) => {
        if (!alive) return;
        setPlayedCourts(Array.isArray(data?.courts) ? data.courts : []);
      })
      .catch(() => {
        if (alive) setPlayedCourts([]);
      });

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    fetch(buildRankingsUrl({ nearLat, nearLng, radiusMiles }))
      .then(async (response) => {
        const data = await response.json().catch(() => null);
        if (!response.ok) throw new Error(data?.error || "Failed to load rankings");
        return data;
      })
      .then((data) => {
        if (!alive) return;
        const next = Array.isArray(data?.rankings) ? data.rankings : [];
        setRankings(next);
      })
      .catch((err) => {
        if (!alive) return;
        setError(err instanceof Error ? err.message : "Failed to load rankings");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [nearLat, nearLng, radiusMiles]);

  const decorated = useMemo(() => orderLadder(decorateRankings(rankings)), [rankings]);
  // The signed-in player, or nobody. Not a list position — see findViewer.
  const viewer = useMemo(() => findViewer(decorated, viewerIdentities), [decorated, viewerIdentities]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return decorated.filter((ranking) => {
      if (query && !ranking.full_name.toLowerCase().includes(query)) return false;
      return true;
    });
  }, [decorated, search]);

  const suggestions = useMemo(() => getSuggestedRankings(decorated, viewer, 3), [decorated, viewer]);

  const stats = useMemo(() => ({
    players: decorated.length,
    active: decorated.filter((ranking) => Number(ranking.matches_played || 0) > 0).length,
    matches: Math.round(decorated.reduce((sum, ranking) => sum + Number(ranking.wins || 0), 0)),
    topRating: decorated[0]?.ratingLabel ?? "-",
  }), [decorated]);

  const selectedPlayedCourt = useMemo(
    () => playedCourts.find((court) => String(court.id) === selectedCourtId) ?? null,
    [playedCourts, selectedCourtId],
  );

  const activeFilterLabel = selectedPlayedCourt
    ? selectedPlayedCourt.name
    : locationSearch;

  const handlePlayedCourtChange = (courtId: string) => {
    setSelectedCourtId(courtId);
    if (!courtId) {
      const stored = getStoredLocation();
      if (stored) {
        applyLocation({
          label: getStoredLocationLabel() || "Current location",
          latitude: stored.latitude,
          longitude: stored.longitude,
        });
      } else {
        setNearLat(null);
        setNearLng(null);
      }
      return;
    }

    const court = playedCourts.find((item) => String(item.id) === courtId);
    if (!court) return;
    const stored = getStoredLocation();
    const currentLocation = locationSearch && stored
      ? { latitude: stored.latitude, longitude: stored.longitude }
      : null;
    const result = resolveCourtFilterSelection({
      court,
      location: currentLocation,
      radiusMiles,
    });
    if (result.clearLocation) clearLocationState();
    setNearLat(result.nearLat);
    setNearLng(result.nearLng);
  };

  const openChallenge = (ranking: DecoratedRanking) => {
    navigate("/matches/create", { state: buildChallengeState(ranking) });
  };

  const openProfile = (ranking: DecoratedRanking) => {
    navigate(`/players/${ranking.user_id}`);
  };

  const photoFor = (ranking: DecoratedRanking) =>
    (String(ranking.user_id) === String(viewer?.user_id) ? usableAvatar(viewerPhotoUrl) : null) ??
    ranking.photoUrl;

  return (
    <div className="min-h-screen bg-[#f4f2fb] text-[#1f2033]">
      <main className="mx-auto max-w-4xl px-4 py-5 sm:px-6">
        <div className="min-w-0">
          {/* Above the list so your own standing is the first thing on the page. */}
          <ViewerCard ranking={viewer} photoUrl={viewer ? photoFor(viewer) : null} />

          <header className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-violet-500 text-white">
                <Trophy size={22} />
              </div>
              <div>
                <h1 className="text-xl font-black tracking-tight">West LA Ladder</h1>
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Public player rankings</p>
              </div>
            </div>
          </header>

          <section className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <StatCard label="Players" value={stats.players} icon={<Users size={16} />} />
            <StatCard label="Active" value={stats.active} icon={<Activity size={16} />} />
            <StatCard label="Results" value={stats.matches} icon={<ShieldCheck size={16} />} />
            <StatCard label="Top TRP" value={stats.topRating} icon={<BarChart3 size={16} />} />
          </section>

          <section className="mt-4 rounded-2xl bg-white p-3 shadow-sm">
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_130px_auto] md:items-end">
              <label className="block">
                <span className="mb-1 block text-[11px] font-black uppercase tracking-[0.12em] text-slate-400">Location</span>
                <Autocomplete
                  key={`ladder-location-${locationKey}`}
                  apiKey={import.meta.env.VITE_GOOGLE_API_KEY || undefined}
                  placeholder="Search city, address, or court"
                  defaultValue={locationSearch}
                  onChange={(event) => {
                    setLocationSearch((event.target as HTMLInputElement).value);
                    setNearLat(null);
                    setNearLng(null);
                    setSelectedCourtId("");
                  }}
                  onPlaceSelected={(place) => {
                    const lat = place?.geometry?.location?.lat?.();
                    const lng = place?.geometry?.location?.lng?.();
                    const label = place?.formatted_address || place?.name || "";
                    if (typeof lat === "number" && Number.isFinite(lat) && typeof lng === "number" && Number.isFinite(lng)) {
                      applyLocation({ label, latitude: lat, longitude: lng, persist: true });
                    } else {
                      setLocationSearch(label);
                      setNearLat(null);
                      setNearLng(null);
                    }
                  }}
                  options={{
                    types: ["geocode", "establishment"],
                    fields: ["formatted_address", "geometry", "name", "address_components"],
                    componentRestrictions: { country: "us" },
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-700 outline-none transition focus:border-violet-400"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] font-black uppercase tracking-[0.12em] text-slate-400">Courts you've played at</span>
                <select
                  value={selectedCourtId}
                  onChange={(event) => handlePlayedCourtChange(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-700 outline-none transition focus:border-violet-400"
                >
                  <option value="">No court filter</option>
                  {playedCourts.map((court) => {
                    const hasCoords = toFiniteCoordinate(court.latitude) !== null && toFiniteCoordinate(court.longitude) !== null;
                    return (
                      <option key={court.id} value={court.id} disabled={!hasCoords}>
                        {[court.name, court.area].filter(Boolean).join(" - ")}
                        {hasCoords ? "" : " (no location)"}
                      </option>
                    );
                  })}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] font-black uppercase tracking-[0.12em] text-slate-400">Radius</span>
                <select
                  value={radiusMiles}
                  onChange={(event) => {
                    const nextRadius = Number(event.target.value);
                    setRadiusMiles(nextRadius);
                    storeLocationRadius(nextRadius);
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-700 outline-none transition focus:border-violet-400"
                >
                  {radiusOptions.map((option) => (
                    <option key={option} value={option}>{option} mi</option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-black text-slate-500 transition hover:border-violet-300 hover:text-violet-700"
                onClick={() => {
                  setLocationSearch("");
                  setNearLat(null);
                  setNearLng(null);
                  setRadiusMiles(10);
                  setSelectedCourtId("");
                  setLocationKey((key) => key + 1);
                }}
              >
                Reset
              </button>
            </div>
            {nearLat !== null && nearLng !== null ? (
              <div className="mt-2 text-xs font-bold text-slate-400">
                Showing players within {radiusMiles} mi of {activeFilterLabel || "selected location"}.
              </div>
            ) : null}
          </section>

          {suggestions.length ? (
            <>
              <div className="mx-1 mt-5 text-xs font-black uppercase tracking-[0.14em] text-slate-400">Suggested for you</div>
              <section className="mt-2 grid gap-3 md:grid-cols-3">
                {suggestions.map((ranking) => (
                  <div
                    role="button"
                    tabIndex={0}
                    key={ranking.user_id}
                    className="rounded-2xl bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                    onClick={() => openProfile(ranking)}
                    onKeyDown={(event) => clickOnKeyboard(event, () => openProfile(ranking))}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar ranking={ranking} photoUrl={photoFor(ranking)} />
                      <div className="min-w-0">
                        <div className="truncate text-sm font-black">{ranking.full_name}</div>
                        <div className="text-xs font-semibold text-slate-400">#{ranking.ladderPosition ?? ranking.rank} · TRP {ranking.ratingLabel}</div>
                      </div>
                    </div>
                    <div className="mt-3 text-xs font-bold text-violet-700">
                      {viewer ? `${Math.abs(ranking.ratingNumber - viewer.ratingNumber).toFixed(3)} from you` : "Top ladder player"}
                    </div>
                    <button
                      type="button"
                      className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-3 py-2 text-sm font-black text-white"
                      onClick={(event) => {
                        event.stopPropagation();
                        openChallenge(ranking);
                      }}
                    >
                      <Swords size={15} />
                      Challenge
                    </button>
                  </div>
                ))}
              </section>
            </>
          ) : null}

          <section className="mt-4 overflow-hidden rounded-2xl bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 size={18} className="text-violet-600" />
                <h2 className="text-base font-black">Ladder</h2>
              </div>
              <label className="flex min-w-0 items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 focus-within:border-violet-400 sm:w-64">
                <Search size={16} className="text-slate-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search player"
                  className="w-full bg-transparent text-sm font-semibold outline-none placeholder:text-slate-400"
                />
              </label>
            </div>

            {error ? (
              <div className="p-8 text-center text-sm font-bold text-rose-600">{error}</div>
            ) : loading ? (
              <div className="p-8 text-center text-sm font-bold text-slate-400">Loading rankings...</div>
            ) : (
              <>
                <div className="hidden lg:block">
                  <div className="grid grid-cols-[54px_minmax(0,1fr)_92px_82px_82px_80px_100px] border-b border-slate-100 px-4 py-3 text-[11px] font-black uppercase tracking-[0.12em] text-slate-400">
                    <span>#</span>
                    <span>Player</span>
                    <span className="text-center">Rating</span>
                    <span className="text-center">NTRP</span>
                    <span className="text-center">UTR</span>
                    <span className="text-center">W-L</span>
                    <span />
                  </div>
                  {filtered.map((ranking) => (
                    <LadderRow
                      key={ranking.user_id}
                      ranking={ranking}
                      viewer={String(ranking.user_id) === String(viewer?.user_id)}
                      photoUrl={photoFor(ranking)}
                      onSelect={() => openProfile(ranking)}
                      onChallenge={() => openChallenge(ranking)}
                    />
                  ))}
                </div>
                <div className="divide-y divide-slate-100 lg:hidden">
                  {filtered.map((ranking) => (
                    <MobileRankingCard
                      key={ranking.user_id}
                      ranking={ranking}
                      viewer={String(ranking.user_id) === String(viewer?.user_id)}
                      photoUrl={photoFor(ranking)}
                      onSelect={() => openProfile(ranking)}
                      onChallenge={() => openChallenge(ranking)}
                    />
                  ))}
                </div>
                {!filtered.length ? (
                  <div className="p-8 text-center text-sm font-bold text-slate-400">No players match these filters.</div>
                ) : null}
              </>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

/**
 * The signed-in player's own standing.
 *
 * This replaced a side panel that showed whoever was last tapped: it duplicated
 * the row it came from, its one unique field (availability) was invented from a
 * hash of the player record, and it meant the most prominent thing on the page
 * was a stranger. Tapping a row now opens that player's profile instead.
 *
 * Renders only when the viewer is actually in the list. No card is better than a
 * card about someone else.
 */
function ViewerCard({ ranking, photoUrl }: { ranking: DecoratedRanking | null; photoUrl?: string | null }) {
  const [photoFailed, setPhotoFailed] = useState(false);
  const known = photoUrl ?? ranking?.photoUrl ?? null;
  if (!ranking) return null;

  const src = photoFailed ? null : known;

  return (
    <section className="mb-4 rounded-2xl bg-violet-600 p-4 text-white shadow-sm">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-white/20 text-sm font-black">
          {src ? (
            <img
              src={src}
              alt=""
              loading="lazy"
              onError={() => setPhotoFailed(true)}
              className="h-full w-full object-cover"
            />
          ) : (
            ranking.initials
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-violet-200">Your position</p>
          <p className="truncate text-lg font-black leading-tight">
            #{ranking.ladderPosition ?? ranking.rank} · {ranking.full_name}
          </p>
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-4 gap-2 text-center">
        <ViewerStat label="Rating" value={ranking.ratingLabel} />
        <ViewerStat label="NTRP" value={ranking.ntrpLabel} />
        <ViewerStat label="UTR" value={ranking.utrLabel} />
        <ViewerStat label="Record" value={`${ranking.wins}-${ranking.losses}`} />
      </dl>
    </section>
  );
}

function ViewerStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/10 px-1 py-2">
      <dt className="text-[10px] font-bold uppercase tracking-wide text-violet-200">{label}</dt>
      <dd className="mt-0.5 text-sm font-black tabular-nums">{value}</dd>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string | number; icon: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between text-violet-600">{icon}</div>
      <div className="mt-2 text-2xl font-black">{value}</div>
      <div className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-400">{label}</div>
    </div>
  );
}

/**
 * The player's photo when there is one, their initials when there is not.
 *
 * `photoUrl` overrides what the row carries — that is how the signed-in
 * player's own picture gets in without a request. A photo that fails to load
 * falls back to the initials rather than leaving a broken image, the same guard
 * AppNav uses.
 *
 * The wrapper carries the initials colours only when no photo is showing.
 */
function Avatar({ ranking, photoUrl }: { ranking: DecoratedRanking; photoUrl?: string | null }) {
  const [failed, setFailed] = useState(false);
  const known = photoUrl ?? ranking.photoUrl;
  const src = failed ? null : known;

  return (
    <span
      className={`grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full text-xs font-black ${
        src ? "bg-slate-100" : `${ranking.avatarClass} ${ranking.avatarToneClass}`
      }`}
    >
      {src ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        ranking.initials
      )}
    </span>
  );
}

function RankValue({ rank }: { rank: number }) {
  const tone = rank === 1 ? "text-amber-700" : rank === 2 ? "text-slate-500" : rank === 3 ? "text-orange-700" : "text-slate-400";
  return <span className={`font-black tabular-nums ${tone}`}>#{rank}</span>;
}

function Badge({ children, tone = "violet" }: { children: React.ReactNode; tone?: "violet" | "green" | "blue" | "gray" }) {
  const classes = {
    violet: "bg-violet-50 text-violet-700",
    green: "bg-emerald-50 text-emerald-700",
    blue: "bg-sky-50 text-sky-700",
    gray: "bg-slate-100 text-slate-500",
  };
  return <span className={`rounded-lg px-2.5 py-1 text-xs font-black tabular-nums ${classes[tone]}`}>{children}</span>;
}

function Change({ value }: { value: unknown }) {
  const change = displayChange(value);
  return (
    <span className={`inline-flex items-center justify-center gap-1 text-xs font-black tabular-nums ${change.tone}`}>
      {change.icon === "up" ? <ArrowUp size={13} /> : null}
      {change.icon === "down" ? <ArrowDown size={13} /> : null}
      {change.label}
    </span>
  );
}

function LadderRow({
  ranking,
  viewer,
  photoUrl,
  onSelect,
  onChallenge,
}: {
  ranking: DecoratedRanking;
  viewer: boolean;
  photoUrl?: string | null;
  onSelect: () => void;
  onChallenge: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      className="grid w-full grid-cols-[54px_minmax(0,1fr)_92px_82px_82px_80px_100px] items-center px-4 py-3 text-left transition hover:bg-[#faf9fe]"
      onClick={onSelect}
      onKeyDown={(event) => clickOnKeyboard(event, onSelect)}
    >
      <RankValue rank={ranking.ladderPosition ?? ranking.rank} />
      <span className="flex min-w-0 items-center gap-3">
        <Avatar ranking={ranking} photoUrl={photoUrl} />
        <span className="min-w-0">
          <span className="flex items-center gap-2">
            <span className="truncate text-sm font-black">{ranking.full_name}</span>
            {viewer ? <span className="rounded-full bg-violet-600 px-2 py-0.5 text-[10px] font-black text-white">you</span> : null}
            {shouldShowEstimateBadge(ranking) ? <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-black text-amber-700">Est.</span> : null}
          </span>
          <span className="mt-0.5 flex items-center gap-1 text-xs font-semibold text-slate-400">
            <MapPin size={12} />
            {ranking.distanceLabel ? `${ranking.distanceLabel} · ${ranking.primaryCourt}` : ranking.primaryCourt}
          </span>
        </span>
      </span>
      <span className="text-center"><Badge>{ranking.ratingLabel}</Badge></span>
      <span className="text-center"><Badge tone="green">{ranking.ntrpLabel}</Badge></span>
      <span className="text-center"><Badge tone="blue">{ranking.utrLabel}</Badge></span>
      <span className="text-center text-sm font-black tabular-nums">{ranking.wins}-{ranking.losses}</span>
      <span className="text-right">
        {viewer ? <Change value={ranking.rating_change} /> : (
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-black text-white"
            onClick={(event) => {
              event.stopPropagation();
              onChallenge();
            }}
          >
            <Swords size={13} />
            Challenge
          </button>
        )}
      </span>
    </div>
  );
}

function MobileRankingCard({
  ranking,
  viewer,
  photoUrl,
  onSelect,
  onChallenge,
}: {
  ranking: DecoratedRanking;
  viewer: boolean;
  photoUrl?: string | null;
  onSelect: () => void;
  onChallenge: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      className="w-full p-4 text-left"
      onClick={onSelect}
      onKeyDown={(event) => clickOnKeyboard(event, onSelect)}
    >
      <div className="flex items-center gap-3">
        <RankValue rank={ranking.ladderPosition ?? ranking.rank} />
        <Avatar ranking={ranking} photoUrl={photoUrl} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-black">{ranking.full_name}</span>
            {viewer ? <span className="rounded-full bg-violet-600 px-2 py-0.5 text-[10px] font-black text-white">you</span> : null}
          </div>
          <div className="mt-0.5 text-xs font-semibold text-slate-400">
            {ranking.distanceLabel ? `${ranking.distanceLabel} · ${ranking.primaryCourt}` : ranking.primaryCourt}
          </div>
        </div>
        <Badge>{ranking.ratingLabel}</Badge>
      </div>
      <div className="mt-3 grid grid-cols-4 gap-2 text-center">
        <Badge tone="green">NTRP {ranking.ntrpLabel}</Badge>
        <Badge tone="blue">UTR {ranking.utrLabel}</Badge>
        <Badge tone="gray">{ranking.wins}-{ranking.losses}</Badge>
        {viewer ? <Change value={ranking.rating_change} /> : (
          <button
            type="button"
            className="rounded-lg bg-violet-600 px-2 py-1 text-xs font-black text-white"
            onClick={(event) => {
              event.stopPropagation();
              onChallenge();
            }}
          >
            Challenge
          </button>
        )}
      </div>
    </div>
  );
}
