import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import usePlayerIdentity from "../hooks/usePlayerIdentity";
import { usableAvatar } from "../utils/avatar";
import { buildViewerIdentities, matchesViewer } from "../utils/leagueSeason";
import { sortByRatingDesc } from "../api/matchResults";
import {
  getStoredLocationLabel,
  requestLocationPicker,
  USER_LOCATION_CHANGED_EVENT,
} from "../utils/userLocation";
import { useNavigate } from "react-router-dom";
import {
  ArrowDown,
  Bell,
  Flag,
  ChevronDown,
  ArrowUp,
  BarChart3,
  MapPin,
  Search,
  Swords,
  Trophy,
} from "lucide-react";

import { buildApiUrl } from "../api/config";
import type { ConnectIntent } from "../types/matchPlay";
import { shouldShowEstimateBadge } from "../utils/ratingBadges";
import { deriveNtrp, deriveUtr } from "../utils/ratingConversions";

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
  primaryCourt: string | null;
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
  page?: number;
  pageSize?: number;
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

const AVATAR_BUCKET_URL = "https://ttp-avatars-production.s3.amazonaws.com/";

const resolveRankingPhotoUrl = (value: string): string | null => {
  const usable = usableAvatar(value);
  if (!usable) return null;
  if (/^https?:\/\//i.test(usable) || usable.startsWith("/")) return usable;
  return `${AVATAR_BUCKET_URL}${encodeURIComponent(usable)}`;
};

const photoFromRanking = (ranking: Ranking): string | null => {
  const record = ranking as unknown as Record<string, unknown>;
  for (const field of PHOTO_FIELDS) {
    const value = record[field];
    // usableAvatar rejects a bare bucket root, which would render as a broken
    // image rather than falling back to the initials that were already there.
    const usable = typeof value === "string" ? resolveRankingPhotoUrl(value) : null;
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
  // Guard before toNumber: Number(null) is 0 and 0 is finite, so toNumber lets a
  // missing distance through as zero and every row read "0.0 mi".
  if (value === null || value === undefined || value === "") return null;
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

/**
 * Kept, but currently unwired.
 *
 * The location, court and radius filters were removed on 2026-08-22 because
 * they scoped the ladder through `player_locations`, which only 214 of 1231
 * players have a row in. These helpers and their tests stay so the filters can
 * come back cheaply once a player's location can be derived from the matches
 * they have played. Nothing on the page calls this today.
 */
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

export const buildRankingsUrl = (filters: RankingsUrlFilters = {}) => {
  const { nearLat, nearLng, radiusMiles, page, pageSize } = filters;
  const params = new URLSearchParams();
  if (Number.isFinite(nearLat) && Number.isFinite(nearLng)) {
    params.set("near_lat", String(nearLat));
    params.set("near_lng", String(nearLng));
    if (Number.isFinite(radiusMiles) && Number(radiusMiles) > 0) {
      params.set("radius_miles", String(radiusMiles));
    }
  }

  if (Number.isInteger(page) && Number(page) > 0) {
    params.set("page", String(page));
  }
  if (Number.isInteger(pageSize) && Number(pageSize) > 0) {
    params.set("page_size", String(pageSize));
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
      const backendCourt = Array.isArray(ranking.court_locations) ? ranking.court_locations[0] : null;
      // A court we were told about, or none. This used to fall back to one of
      // six West LA courts picked by hashing the player's id and name, so
      // Josh Berenbaum — who has no court on file — was shown at "Mar Vista
      // Courts" on every load. 1017 of 1231 players have no location recorded,
      // so that fallback was inventing a home court for 83% of the ladder.
      const primaryCourt = ranking.primary_court || backendCourt?.location || null;
      const avatar = AVATAR_CLASSES[seed % AVATAR_CLASSES.length];
      const ratingNumber = toNumber(ranking.current_rating) ?? toNumber(ranking.self_rated_seed) ?? 0;
      // toNumber alone is not enough: Number(null) is 0 and 0 is finite, so an
      // unknown distance became 0 and rendered as "0.0 mi" on every row. Nothing
      // sends a distance now that the radius filter is gone.
      const rawDistance = ranking.distance_miles;
      const distanceMiles =
        rawDistance === null || rawDistance === undefined || rawDistance === ""
          ? null
          : toNumber(rawDistance);
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
/**
 * Only players with a rating belong on a ladder.
 *
 * 1159 of 1231 players carry current_rating exactly 0 — not missing, and with no
 * self-rated seed either, so they have neither played nor told us how they play.
 * They sorted to the bottom and made the ladder 94% padding.
 *
 * The 10 who are rated without having played keep their place: their rating is
 * their own self-rating, which the row already marks with an estimate badge.
 *
 * Filtered before ordering so positions run 1..n with no gaps.
 */
export const onlyRatedPlayers = (rankings: DecoratedRanking[]): DecoratedRanking[] =>
  (Array.isArray(rankings) ? rankings : []).filter((ranking) => Number(ranking.ratingNumber) > 0);

/** "2W-1L", never "2-1" — the bare form reads as a set score. */
/**
 * The row's second line, which must never be empty or rows jump height.
 *
 * Home court is dropped when we have none rather than invented — 1017 of 1231
 * players have no location on file. A player with no result shows "Provisional"
 * instead of "0W-0L", which reads as a record they do not have.
 */
/**
 * How far a suggested player is from you, and in which direction.
 *
 * Returns null when there is no viewer to compare against — the card then says
 * what it can rather than inventing a gap.
 */
export const ratingGap = (ranking: DecoratedRanking, viewer: DecoratedRanking | null) => {
  if (!viewer) return null;
  const delta = ranking.ratingNumber - viewer.ratingNumber;
  return {
    above: delta > 0,
    delta: Math.abs(delta).toFixed(3),
    position: ranking.ladderPosition ?? ranking.rank,
  };
};

export const rowMeta = (ranking: DecoratedRanking) => {
  const played = Number(ranking.matches_played || 0) > 0;
  // Home court is deliberately absent. It was the first token when a player had
  // one and missing when they did not, so the line started differently row to
  // row and a long court name ("Mar Vista Recreation Center") ate everything
  // after it. It belongs on the player profile. Every row now reads the same
  // fields in the same order.
  return [
    `NTRP ${ranking.ntrpLabel}`,
    `UTR ${ranking.utrLabel}`,
    played ? recordLabel(ranking) : null,
  ].filter(Boolean).join(" · ");
};

/** The ladder has no name in the API, so this is the one we show. */
const LADDER_NAME = "West LA Ladder";

/**
 * The header title.
 *
 * This substituted the resolved location name when one was stored, which put a
 * place where a competition's name belongs. There is no ladder identity to read:
 * /match-results/rankings returns no ladder id or name, and `rating_leagues` is
 * null on all 1231 rows. The app's one named-competition model is `League`
 * (src/api/leagues.ts), which this page does not use.
 *
 * So the name below is hardcoded, pending a decision on where ladder identity
 * should live. It is deliberately not derived from anything.
 */
export const resolveLadderTitle = () => LADDER_NAME;

export const recordLabel = (ranking: { wins?: unknown; losses?: unknown }) =>
  `${Number(ranking.wins || 0)}W-${Number(ranking.losses || 0)}L`;

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
      level: `TPR ${ranking.ratingLabel}`,
    },
    senderLevel: "TPR",
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
const RANKINGS_PAGE_SIZE = 100;

export default function PublicMatchResultsPage() {
  const navigate = useNavigate();
  const { avatarUrl: viewerPhotoUrl } = usePlayerIdentity();
  const [rankings, setRankings] = useState<Ranking[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
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

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    fetch(buildRankingsUrl({ page: 1, pageSize: RANKINGS_PAGE_SIZE }))
      .then(async (response) => {
        const data = await response.json().catch(() => null);
        if (!response.ok) throw new Error(data?.error || "Failed to load rankings");
        return data;
      })
      .then((data) => {
        if (!alive) return;
        const next = Array.isArray(data?.rankings) ? data.rankings : [];
        setRankings(next);
        setPage(Number(data?.page) || 1);
        setTotal(Number(data?.total) || next.length);
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
  }, []);

  const loadMore = async () => {
    const nextPage = page + 1;
    setLoadingMore(true);
    try {
      const response = await fetch(buildRankingsUrl({ page: nextPage, pageSize: RANKINGS_PAGE_SIZE }));
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Failed to load rankings");
      const next = Array.isArray(data?.rankings) ? data.rankings : [];
      setRankings((current) => [...current, ...next]);
      setPage(Number(data?.page) || nextPage);
      setTotal(Number(data?.total) || total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load rankings");
    } finally {
      setLoadingMore(false);
    }
  };

  // Shown as-is from the location the app already resolved; the header caps its
  // width in CSS and ellipsizes rather than pre-truncating the value.
  //
  // Reads the label only — nothing here resolves coordinates or asks for
  // permission. The listener is what makes the title follow a selection made in
  // AppNav's picker, which is a sibling of the bar this page hides.
  const [ladderTitle, setLadderTitle] = useState(resolveLadderTitle);

  useEffect(() => {
    const syncTitle = () => setLadderTitle(resolveLadderTitle());
    window.addEventListener(USER_LOCATION_CHANGED_EVENT, syncTitle);
    return () => window.removeEventListener(USER_LOCATION_CHANGED_EVENT, syncTitle);
  }, []);

  const decorated = useMemo(() => orderLadder(onlyRatedPlayers(decorateRankings(rankings))), [rankings]);
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
      <main className="ladder-scroll mx-auto max-w-4xl px-4 py-5 sm:px-6">
        <div className="min-w-0">
          {/* Mobile chrome: one 52px header in place of the brand bar and the
              ladder title card, which together cost ~180px before any content.
              The chevron opens AppNav's existing location picker via
              requestLocationPicker() — the picker itself is untouched. */}
          <header className="ladder-head lg:hidden">
            <button
              type="button"
              className="flex min-w-0 items-center gap-1 text-[17px] font-bold tracking-[-0.02em]"
              onClick={() => requestLocationPicker()}
            >
              <span className="truncate">{ladderTitle}</span>
              <ChevronDown size={18} className="shrink-0 text-slate-400" />
            </button>
            <span className="ml-auto flex shrink-0 items-center gap-3">
              <button
                type="button"
                aria-label="Notifications"
                className="grid h-9 w-9 place-items-center rounded-full text-slate-500"
                onClick={() => navigate("/notifications")}
              >
                <Bell size={20} />
              </button>
              {viewer ? (
                <Avatar ranking={viewer} photoUrl={photoFor(viewer)} />
              ) : null}
            </span>
          </header>

          {/* Above the list so your own standing is the first thing on the page. */}
          <ViewerCard ranking={viewer} photoUrl={viewer ? photoFor(viewer) : null} />

          <header className="hidden rounded-2xl bg-white p-4 shadow-sm lg:block">
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


          {/* The location, court and radius filters were removed on 2026-08-22.
              They scoped the list through player_locations, which only 214 of
              1231 players have a row in — so a filter silently dropped 83% of
              the ladder, including six of the top eight, on the basis of a
              location nobody had recorded rather than distance. Everyone
              currently ranked is local to West LA, so the filters bought little
              and cost a lot. They come back when a player's location can be
              derived from the matches they have actually played. */}

          {suggestions.length ? (
            <>
              <div className="mx-1 mt-5 text-xs font-black uppercase tracking-[0.14em] text-slate-400">Suggested for you</div>
              <section className="ladder-rail mt-2 lg:grid lg:gap-3 lg:grid-cols-3">
                {suggestions.map((ranking) => (
                  <div
                    role="button"
                    tabIndex={0}
                    key={ranking.user_id}
                    className="rounded-[14px] border border-slate-200 bg-white p-3 text-left transition hover:-translate-y-0.5 hover:shadow-md lg:border-0 lg:p-4 lg:shadow-sm"
                    onClick={() => openProfile(ranking)}
                    onKeyDown={(event) => clickOnKeyboard(event, () => openProfile(ranking))}
                  >
                    {/* Stacked, not avatar-beside-name: the card's job is to
                        identify a person, and the horizontal arrangement left so
                        little room that names truncated to "Connor…". */}
                    <Avatar ranking={ranking} photoUrl={photoFor(ranking)} />
                    {/* Wraps rather than truncating — a card exists to name a
                        person. It previously reserved two lines' height, which
                        left an empty band under every one-line name. The rail
                        stretches its cards to match, so they still line up. */}
                    <div className="mt-2 text-sm font-bold leading-tight">{ranking.full_name}</div>
                    <div className="text-xs font-semibold text-slate-400">
                      #{ranking.ladderPosition ?? ranking.rank} · TPR {ranking.ratingLabel}
                    </div>
                    {(() => {
                      // Nothing previously said which way the gap ran, so no
                      // card told you which challenge would gain you a place.
                      // The rank is on the line above, so it is not repeated.
                      const gap = ratingGap(ranking, viewer);
                      if (!gap) return <div className="mt-1 text-xs text-slate-500">Top ladder player</div>;
                      return (
                        <div className={`mt-1 text-xs font-semibold ${gap.above ? "text-violet-700" : "text-slate-500"}`}>
                          {gap.above ? "\u25B2" : "\u25BC"} {gap.delta} {gap.above ? "up" : "down"}
                        </div>
                      );
                    })()}
                    <button
                      type="button"
                      className="mt-2.5 inline-flex min-h-[34px] w-full items-center justify-center gap-1.5 rounded-[10px] bg-violet-600 px-2.5 py-1.5 text-[13px] font-bold text-white"
                      onClick={(event) => {
                        event.stopPropagation();
                        openChallenge(ranking);
                      }}
                    >
                      <Swords size={14} />
                      Challenge
                    </button>
                  </div>
                ))}
              </section>
            </>
          ) : null}

          {/* Directly above the list it filters. Under the header it read as
              global app search, with no visible list beneath it once scrolled. */}
          <div className="ladder-searchstrip lg:hidden">
            <label className="flex h-9 min-w-0 items-center gap-2 rounded-full border border-slate-200 bg-white px-3">
              <Search size={16} className="shrink-0 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search player"
                className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
              />
            </label>
          </div>

          <section className="mt-4 overflow-hidden rounded-2xl bg-white shadow-sm">
            {/* Mobile starts at row 1: the page header already names the ladder,
                so a card header here spent ~90px on one word. */}
            <div className="hidden flex-col gap-3 border-b border-slate-100 p-4 lg:flex lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 size={18} className="text-violet-600" />
                <h2 className="text-base font-black">Ladder</h2>
              </div>
              <label className="hidden min-w-0 items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 focus-within:border-violet-400 lg:flex lg:w-64">
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
                    <span className="text-center">TPR</span>
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
                {rankings.length < total ? (
                  <div className="border-t border-slate-100 p-4 text-center">
                    <button
                      type="button"
                      className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
                      onClick={() => void loadMore()}
                      disabled={loadingMore}
                    >
                      {loadingMore ? "Loading players..." : "Load more players"}
                    </button>
                  </div>
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
    <section className="mx-3.5 mt-2.5 flex items-center gap-3 rounded-[14px] border border-slate-200 bg-white p-3 lg:mx-0 lg:mt-0 lg:mb-4">
      {/* Purple is the accent, not the surface. It was a full-bleed purple block,
          which left the solid purple Challenge buttons with nothing to stand out
          against. The rank tile keeps the colour; the card does not. */}
      {/* Pale, not solid: this is a label, not a button, and a fourth purple
          block would undo the point of calming the screen down. */}
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px] bg-violet-50 text-sm font-black tabular-nums text-violet-700">
        {ranking.ladderPosition ?? ranking.rank}
      </span>

      <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-slate-100 text-xs font-black text-slate-500">
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

      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-1.5">
          <span className="truncate text-sm font-bold">{ranking.full_name}</span>
          <span className="ml-auto shrink-0 text-[13px] font-bold tabular-nums text-violet-700">
            {ranking.ratingLabel}
          </span>
        </span>
        <span className="mt-0.5 block truncate text-xs leading-[1.35] text-slate-500">
          NTRP {ranking.ntrpLabel} · UTR {ranking.utrLabel} · {recordLabel(ranking)}
          {/* Without this, a 0W-0L record beside a 7.000 rating reads as a bug
              rather than as a rating nothing has tested yet. */}
          {Number(ranking.matches_played || 0) > 0 ? null : (
            <EstimateFlag />
          )}
        </span>
      </span>
    </section>
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
      className={`grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full text-xs font-black ${
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

/**
 * "Est." is an abbreviation with no obvious meaning, so it has to be able to
 * explain itself rather than sit there decoratively.
 *
 * The visible pill stays small; the tap target is padded out to 44px, which is
 * why the button carries negative margin — it must not change the row's height
 * or push the text it sits beside.
 */
const ESTIMATE_EXPLANATION = "Estimated rating — play 3 matches to set your rating.";

function EstimateFlag() {
  const [open, setOpen] = useState(false);

  return (
    <span className="relative inline-flex align-middle">
      <button
        type="button"
        aria-label={ESTIMATE_EXPLANATION}
        aria-expanded={open}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((current) => !current);
        }}
        onBlur={() => setOpen(false)}
        className="-my-3 ml-1.5 inline-flex min-h-[44px] min-w-[44px] items-center justify-center px-1"
      >
        <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-600">
          <Flag size={11} aria-hidden="true" />
          Est.
        </span>
      </button>
      {open ? (
        <span
          role="tooltip"
          className="absolute bottom-full left-0 z-30 mb-1 w-56 rounded-lg bg-slate-900 px-3 py-2 text-[11px] font-semibold leading-snug text-white shadow-lg"
        >
          {ESTIMATE_EXPLANATION}
        </span>
      ) : null}
    </span>
  );
}

function Badge({ children, tone = "violet" }: { children: React.ReactNode; tone?: "violet" | "green" | "blue" | "gray" }) {
  const classes = {
    violet: "bg-violet-50 text-violet-700",
    green: "bg-emerald-50 text-emerald-700",
    blue: "bg-sky-50 text-sky-700",
    // slate-500 on slate-100 measured 4.34:1 — below AA. slate-600 is 6.92:1.
    // Foreground only; the background tint is unchanged.
    gray: "bg-slate-100 text-slate-600",
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
            {[ranking.distanceLabel, ranking.primaryCourt].filter(Boolean).join(" · ")}
          </span>
        </span>
      </span>
      <span className="text-center"><Badge>TPR {ranking.ratingLabel}</Badge></span>
      <span className="text-center"><Badge tone="green">{ranking.ntrpLabel}</Badge></span>
      <span className="text-center"><Badge tone="blue">{ranking.utrLabel}</Badge></span>
      <span className="text-center text-sm font-black tabular-nums">{recordLabel(ranking)}</span>
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
      className={`flex min-h-[66px] w-full items-center gap-2 px-3 py-2.5 text-left${viewer ? " ladder-row-you" : ""}`}
      onClick={onSelect}
      onKeyDown={(event) => clickOnKeyboard(event, onSelect)}
    >
      {/* slate-400 measured 2.56:1 on white — far below AA. slate-500 is 4.76:1.
          Colour only; size and weight unchanged. */}
      <span className="w-5 shrink-0 text-right text-[13px] font-bold tabular-nums text-slate-500">
        {ranking.ladderPosition ?? ranking.rank}
      </span>
      <Avatar ranking={ranking} photoUrl={photoUrl} />
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-1.5">
          <span className="truncate text-sm font-bold">{ranking.full_name}</span>
          {viewer ? (
            <span className="shrink-0 text-[10px] font-black uppercase tracking-[0.05em] text-violet-700">You</span>
          ) : null}
          <span className="ml-auto shrink-0 text-[13px] font-bold tabular-nums text-violet-700">
            {ranking.ratingLabel}
          </span>
        </span>
        {/* Always renders, so rows stay a uniform height. A player with no
            result shows their standing rather than collapsing the line. */}
        <span className="ladder-meta mt-0.5 flex items-center text-xs leading-[1.35] text-slate-500">
          <span className="truncate">{rowMeta(ranking)}</span>
          {Number(ranking.matches_played || 0) > 0 ? null : <EstimateFlag />}
        </span>
      </span>
      {/* Your row has no Challenge button, and without a spacer the rating slid
          to the container edge and broke the one column the eye actually scans.
          A spacer, not a disabled button — a disabled button invites a tap that
          does nothing. */}
      <span className="flex w-[78px] shrink-0 justify-end" aria-hidden={viewer}>
        {viewer ? null : (
          <button
            type="button"
            className="min-h-[32px] w-full rounded-[10px] border border-violet-500 bg-transparent px-1.5 py-1.5 text-[11px] font-bold text-violet-700"
            onClick={(event) => {
              event.stopPropagation();
              onChallenge();
            }}
          >
            Challenge
          </button>
        )}
      </span>
    </div>
  );
}
