import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Autocomplete from "react-google-autocomplete";
import {
  Activity,
  ArrowDown,
  ArrowUp,
  BarChart3,
  Clock,
  MapPin,
  Search,
  ShieldCheck,
  Swords,
  Trophy,
  Users,
} from "lucide-react";

import { buildApiUrl } from "../api/config";
import type { ConnectIntent } from "../types/matchPlay";
import { shouldShowEstimateBadge } from "../utils/ratingBadges";
import { deriveNtrp, deriveUtr } from "../utils/ratingConversions";

export type Ranking = {
  rank: number;
  user_id: number | string;
  full_name: string;
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
  initials: string;
  ratingNumber: number;
  ratingLabel: string;
  ntrpLabel: string;
  utrLabel: string;
  primaryCourt: string;
  courtArea: string;
  availability: string[];
  avatarClass: string;
  avatarToneClass: string;
  distanceMiles: number | null;
  distanceLabel: string | null;
};

export type RankingsUrlFilters = {
  nearLat?: number | null;
  nearLng?: number | null;
  radiusMiles?: number | null;
};

const WEST_LA_COURTS = [
  { name: "Cheviot Hills", area: "Rancho Park" },
  { name: "Westwood Rec", area: "Westwood" },
  { name: "Penmar Recreation Center", area: "Venice" },
  { name: "Stoner Park", area: "Sawtelle" },
  { name: "Mar Vista Courts", area: "Mar Vista" },
  { name: "Santa Monica Tennis Center", area: "Santa Monica" },
];

const AVAILABILITY = [
  "Weekday evenings",
  "Weekend mornings",
  "Tue/Thu evenings",
  "Lunch hits",
  "Flexible weekends",
  "Early mornings",
];

const AVATAR_CLASSES = [
  ["bg-violet-100", "text-violet-700"],
  ["bg-emerald-100", "text-emerald-700"],
  ["bg-sky-100", "text-sky-700"],
  ["bg-rose-100", "text-rose-700"],
  ["bg-amber-100", "text-amber-700"],
  ["bg-indigo-100", "text-indigo-700"],
];

const toNumber = (value: unknown): number | null => {
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
      const courtArea = ranking.court_area || backendCourt?.area || fallbackCourt.area;
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
        courtArea,
        availability: [
          AVAILABILITY[seed % AVAILABILITY.length],
          AVAILABILITY[(seed + 2) % AVAILABILITY.length],
        ],
        avatarClass: avatar[0],
        avatarToneClass: avatar[1],
        distanceMiles,
        distanceLabel: formatDistance(distanceMiles),
      };
    })
    .sort((a, b) => Number(a.rank) - Number(b.rank));

export const getSuggestedRankings = (
  rankings: DecoratedRanking[],
  viewer?: DecoratedRanking | null,
  limit = 3,
) => {
  if (!viewer) return rankings.slice(0, limit);
  return rankings
    .filter((ranking) => String(ranking.user_id) !== String(viewer.user_id))
    .map((ranking) => ({ ranking, delta: Math.abs(ranking.ratingNumber - viewer.ratingNumber) }))
    .sort((a, b) => a.delta - b.delta || Number(a.ranking.rank) - Number(b.ranking.rank))
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
    suggestedAvailability: ranking.availability,
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
  const [rankings, setRankings] = useState<Ranking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [locationSearch, setLocationSearch] = useState("");
  const [locationKey, setLocationKey] = useState(0);
  const [nearLat, setNearLat] = useState<number | null>(null);
  const [nearLng, setNearLng] = useState<number | null>(null);
  const [radiusMiles, setRadiusMiles] = useState(10);
  const [selectedId, setSelectedId] = useState<string | null>(null);

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
        setSelectedId(String(next.find((row: Ranking) => /michael joaquin/i.test(row.full_name))?.user_id ?? next[3]?.user_id ?? next[0]?.user_id ?? ""));
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

  const decorated = useMemo(() => decorateRankings(rankings), [rankings]);
  const viewer = useMemo(
    () => decorated.find((ranking) => String(ranking.user_id) === selectedId) ?? decorated[3] ?? decorated[0] ?? null,
    [decorated, selectedId],
  );

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

  const selected = useMemo(
    () => decorated.find((ranking) => String(ranking.user_id) === selectedId) ?? viewer,
    [decorated, selectedId, viewer],
  );

  const openChallenge = (ranking: DecoratedRanking) => {
    navigate("/matches/create", { state: buildChallengeState(ranking) });
  };

  return (
    <div className="min-h-screen bg-[#f4f2fb] text-[#1f2033]">
      <main className="mx-auto max-w-6xl px-4 py-5 sm:px-6 lg:grid lg:grid-cols-[minmax(0,1fr)_330px] lg:gap-5">
        <div className="min-w-0">
          <header className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-violet-500 text-white">
                <Trophy size={22} />
              </div>
              <div>
                <h1 className="text-xl font-black tracking-tight">West LA Ladder</h1>
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Public player rankings</p>
              </div>
              {viewer ? (
                <div className="ml-auto hidden items-center gap-2 sm:flex">
                  <span className="rounded-full bg-violet-50 px-3 py-1.5 text-xs font-bold text-violet-700">Viewing rank #{viewer.rank}</span>
                  <Avatar ranking={viewer} />
                </div>
              ) : null}
            </div>
          </header>

          <section className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <StatCard label="Players" value={stats.players} icon={<Users size={16} />} />
            <StatCard label="Active" value={stats.active} icon={<Activity size={16} />} />
            <StatCard label="Results" value={stats.matches} icon={<ShieldCheck size={16} />} />
            <StatCard label="Top TRP" value={stats.topRating} icon={<BarChart3 size={16} />} />
          </section>

          <section className="mt-4 rounded-2xl bg-white p-3 shadow-sm">
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_150px_auto] md:items-end">
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
                  }}
                  onPlaceSelected={(place) => {
                    const lat = place?.geometry?.location?.lat?.();
                    const lng = place?.geometry?.location?.lng?.();
                    setLocationSearch(place?.formatted_address || place?.name || "");
                    setNearLat(typeof lat === "number" && Number.isFinite(lat) ? lat : null);
                    setNearLng(typeof lng === "number" && Number.isFinite(lng) ? lng : null);
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
                <span className="mb-1 block text-[11px] font-black uppercase tracking-[0.12em] text-slate-400">Radius</span>
                <select
                  value={radiusMiles}
                  onChange={(event) => setRadiusMiles(Number(event.target.value))}
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
                  setLocationKey((key) => key + 1);
                }}
              >
                Reset
              </button>
            </div>
            {nearLat !== null && nearLng !== null ? (
              <div className="mt-2 text-xs font-bold text-slate-400">
                Showing players within {radiusMiles} mi of {locationSearch || "selected location"}.
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
                    onClick={() => setSelectedId(String(ranking.user_id))}
                    onKeyDown={(event) => clickOnKeyboard(event, () => setSelectedId(String(ranking.user_id)))}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar ranking={ranking} />
                      <div className="min-w-0">
                        <div className="truncate text-sm font-black">{ranking.full_name}</div>
                        <div className="text-xs font-semibold text-slate-400">#{ranking.rank} · TRP {ranking.ratingLabel}</div>
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
                      selected={String(ranking.user_id) === String(selected?.user_id)}
                      viewer={String(ranking.user_id) === String(viewer?.user_id)}
                      onSelect={() => setSelectedId(String(ranking.user_id))}
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
                      onSelect={() => setSelectedId(String(ranking.user_id))}
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

        <aside className="mt-5 lg:sticky lg:top-5 lg:mt-0 lg:self-start">
          <ProfilePanel ranking={selected} viewer={viewer} onChallenge={selected ? () => openChallenge(selected) : undefined} />
        </aside>
      </main>
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

function Avatar({ ranking }: { ranking: DecoratedRanking }) {
  return (
    <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-xs font-black ${ranking.avatarClass} ${ranking.avatarToneClass}`}>
      {ranking.initials}
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
  selected,
  viewer,
  onSelect,
  onChallenge,
}: {
  ranking: DecoratedRanking;
  selected: boolean;
  viewer: boolean;
  onSelect: () => void;
  onChallenge: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      className={`grid w-full grid-cols-[54px_minmax(0,1fr)_92px_82px_82px_80px_100px] items-center px-4 py-3 text-left transition ${
        selected ? "bg-violet-50" : "hover:bg-[#faf9fe]"
      }`}
      onClick={onSelect}
      onKeyDown={(event) => clickOnKeyboard(event, onSelect)}
    >
      <RankValue rank={ranking.rank} />
      <span className="flex min-w-0 items-center gap-3">
        <Avatar ranking={ranking} />
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
  onSelect,
  onChallenge,
}: {
  ranking: DecoratedRanking;
  viewer: boolean;
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
        <RankValue rank={ranking.rank} />
        <Avatar ranking={ranking} />
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

function ProfilePanel({
  ranking,
  viewer,
  onChallenge,
}: {
  ranking?: DecoratedRanking | null;
  viewer?: DecoratedRanking | null;
  onChallenge?: () => void;
}) {
  if (!ranking) {
    return (
      <section className="rounded-2xl bg-white p-5 text-sm font-bold text-slate-400 shadow-sm">
        Select a player.
      </section>
    );
  }
  const isViewer = String(ranking.user_id) === String(viewer?.user_id);
  const delta = viewer ? ranking.ratingNumber - viewer.ratingNumber : null;

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <Avatar ranking={ranking} />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-lg font-black">{ranking.full_name}</h2>
          <p className="text-sm font-semibold text-slate-400">
            Rank #{ranking.rank} · {ranking.distanceLabel ? `${ranking.distanceLabel} away` : ranking.courtArea}
          </p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2">
        <Metric label="Rating" value={ranking.ratingLabel} tone="violet" />
        <Metric label="NTRP" value={ranking.ntrpLabel} tone="green" />
        <Metric label="UTR" value={ranking.utrLabel} tone="blue" />
        <Metric label="Record" value={`${ranking.wins}-${ranking.losses}`} tone="gray" />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <ProfileChip icon={<MapPin size={13} />}>{ranking.primaryCourt}</ProfileChip>
        {ranking.availability.map((item) => (
          <ProfileChip key={item} icon={<Clock size={13} />}>{item}</ProfileChip>
        ))}
      </div>

      {delta !== null && !isViewer ? (
        <div className="mt-4 rounded-xl bg-violet-50 p-3 text-sm font-bold text-violet-800">
          {Math.abs(delta).toFixed(3)} {delta >= 0 ? "above" : "below"} your rating.
        </div>
      ) : null}

      <button
        type="button"
        disabled={isViewer || !onChallenge}
        onClick={onChallenge}
        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Swords size={16} />
        Challenge
      </button>
    </section>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone: "violet" | "green" | "blue" | "gray" }) {
  const classes = {
    violet: "bg-violet-50 text-violet-800",
    green: "bg-emerald-50 text-emerald-800",
    blue: "bg-sky-50 text-sky-800",
    gray: "bg-slate-100 text-slate-800",
  };
  return (
    <div className={`rounded-xl p-3 ${classes[tone]}`}>
      <div className="text-[10px] font-black uppercase tracking-[0.12em] opacity-70">{label}</div>
      <div className="mt-1 text-xl font-black tabular-nums">{value}</div>
    </div>
  );
}

function ProfileChip({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-[#f4f2fb] px-3 py-1.5 text-xs font-bold text-slate-500">
      {icon}
      {children}
    </span>
  );
}
