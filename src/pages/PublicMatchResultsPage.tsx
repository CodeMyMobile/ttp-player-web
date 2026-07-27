import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Trophy, BarChart3, Search, RefreshCw, Swords } from "lucide-react";
import { buildApiUrl } from "../api/config";
import { getPlayerPersonalDetails } from "../api/playerProfile";
import { getStoredAuthToken } from "../services/authToken";
import { shouldShowEstimateBadge } from "../utils/ratingBadges";
import { deriveNtrp } from "../utils/ratingConversions";
import { useAuth } from "../context/AuthContext";
import { useChallenge } from "../hooks/useChallenge";
import MainLayout from "../components/MainLayout";

type Ranking = {
  rank: number;
  user_id: number | string;
  full_name: string;
  current_rating: number | null;
  self_rated_seed: number | null;
  rating_change: number | null;
  matches_played: number;
  wins: number;
  losses: number;
  is_provisional: boolean;
  is_estimate: boolean;
  usta_rating?: string | number | null;
  uta_rating?: string | number | null;
  // Backend-computed conversions from the TRP — preferred over the entered ratings
  // so this page and the league dashboard show the same values.
  calculated_ntrp?: string | number | null;
  calculated_utr?: string | number | null;
  rating_gender?: string | null;
  rating_leagues?: string | null;
};

type ViewKey = "around" | "near" | "top50";

// "Near my level" window, in TRP — tight enough to surface true peers, not a wide band.
const NEAR_LEVEL_BAND = 0.1;

const AVATAR_COLORS = [
  "bg-violet-500",
  "bg-purple-600",
  "bg-indigo-500",
  "bg-fuchsia-500",
  "bg-blue-500",
  "bg-emerald-500",
];

const leagueLabels: Record<string, string> = {
  sum45: "Summer 4.5",
  sum35: "Summer 3.5",
  "4.25": "Spring 4.25",
  s40: "Spring 4.0",
  s35: "Spring 3.5",
  w35: "Women's 3.5",
  Winter: "Winter",
  m: "Multi-league",
};

const leagueOrder = ["sum45", "sum35", "4.25", "s40", "s35", "Winter", "w35", "m"];

const initials = (name: string) => (
  name.trim().split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "TP"
);

const toNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const formatRating = (value: unknown, fallback = "-") => {
  const parsed = toNumber(value);
  return parsed === null ? fallback : parsed.toFixed(3);
};

// Signed 3-decimal difference, e.g. "+0.042" / "-0.031". Used for gaps only.
const formatSignedDiff = (delta: number) => `${delta >= 0 ? "+" : "-"}${Math.abs(delta).toFixed(3)}`;

const estimateNtrp = (ranking: Ranking) =>
  deriveNtrp(ranking.calculated_ntrp ?? ranking.usta_rating, ranking.current_rating, ranking.rating_gender).value ?? "-";

const displayLeague = (ranking: Ranking) => {
  const tags = String(ranking.rating_leagues || "").split(/\s+/).filter(Boolean);
  const tag = tags[tags.length - 1];
  return leagueLabels[tag] || tag || "Open";
};

const matchesLeague = (ranking: Ranking, league: string) => {
  if (league === "all") return true;
  return String(ranking.rating_leagues || "").split(/\s+/).includes(league);
};

const norm = (value: unknown) => String(value ?? "").trim().toLowerCase();

type ViewerGroups = { id: Set<string>; email: Set<string>; name: Set<string> };

// The account id and the ranking user_id are different id-spaces (account id can be
// "1" while ranking rows use player ids), so no single criterion always finds the viewer.
// Keep id, email, and name — but GROUPED by reliability so the row lookup can try them in
// order (see viewerResolution) instead of a flat OR that a name collision poisons.
const buildViewerGroups = (user: unknown): ViewerGroups => {
  const u = (user ?? {}) as Record<string, unknown> & { profile?: Record<string, unknown> };
  const p = (u.profile ?? {}) as Record<string, unknown>;
  const group = (values: unknown[]) => new Set(values.map(norm).filter(Boolean));
  return {
    id: group([u.id, u.user_id, u.player_id, p.id, p.user_id]),
    email: group([u.email, p.email]),
    name: group([u.full_name, u.name, p.full_name]),
  };
};

// NTRP → TRP so a signed-in player who has no ranked TRP yet can still anchor
// "Near my level" off their profile rating. Inverse of NTRP = 3.5 + (trp-5)*0.5.
const ntrpToTrp = (ntrp: unknown): number | null => {
  const n = toNumber(ntrp);
  return n === null ? null : 5 + (n - 3.5) * 2;
};

const readViewerNtrp = (user: unknown): unknown => {
  const u = (user ?? {}) as Record<string, unknown> & { profile?: Record<string, unknown> };
  const p = (u.profile ?? {}) as Record<string, unknown>;
  return u.skillLevel ?? p.usta_rating ?? u.usta_rating ?? p.skill_level ?? u.skill_level ?? p.ntrp ?? u.ntrp;
};

const readAuthToken = (user: unknown): string | undefined => {
  const u = (user ?? {}) as Record<string, unknown> & { session?: Record<string, unknown> };
  const s = (u.session ?? {}) as Record<string, unknown>;
  return (
    (s.access_token as string) ??
    (u.access_token as string) ??
    (u.token as string) ??
    getStoredAuthToken({ preferScheme: "token" }) ??
    undefined
  );
};

export default function PublicMatchResultsPage() {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const challenge = useChallenge();

  const [rankings, setRankings] = useState<Ranking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gender, setGender] = useState<"all" | "M" | "F">("all");
  const [league, setLeague] = useState("all");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<ViewKey | null>(null);
  // Rating seed points for the signed-in viewer only — a second, independent fetch.
  // Null (never set, errored, or absent) means: render the standing card without the
  // progress metric. It must never block or error the card.
  const [seed, setSeed] = useState<{ start: number | null; current: number | null } | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    // NOTE: this returns the ENTIRE roster in one unparameterised call, already sorted
    // in rank order. Percentile (rank / rankings.length) and the "Around me" window both
    // depend on the whole list being present in memory. If this endpoint is ever
    // paginated, both break and will need a server-provided `total` plus a window
    // parameter (offset / aroundUserId) on the request.
    fetch(buildApiUrl("/match-results/rankings"))
      .then(async (response) => {
        const data = await response.json().catch(() => null);
        if (!response.ok) throw new Error(data?.error || "Failed to load rankings");
        return data;
      })
      .then((data) => {
        if (!alive) return;
        setRankings(Array.isArray(data?.rankings) ? data.rankings : []);
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

  // Second, independent fetch: the viewer's own rating seed points (starting/current)
  // for the "progress since seed" metric. Skipped entirely when signed out. Fails soft —
  // any error leaves `seed` null and the card renders without the metric.
  useEffect(() => {
    if (!isAuthenticated) {
      setSeed(null);
      return;
    }
    const token = readAuthToken(user);
    if (!token) {
      setSeed(null);
      return;
    }
    const controller = new AbortController();
    getPlayerPersonalDetails({ token, signal: controller.signal })
      .then((res) => {
        if (controller.signal.aborted) return;
        setSeed({
          start: toNumber((res as { starting_rating?: unknown })?.starting_rating),
          current: toNumber((res as { current_rating?: unknown })?.current_rating),
        });
      })
      .catch(() => {
        if (!controller.signal.aborted) setSeed(null);
      });
    return () => controller.abort();
  }, [isAuthenticated, user]);

  const viewerGroups = useMemo<ViewerGroups>(
    () =>
      isAuthenticated
        ? buildViewerGroups(user)
        : { id: new Set<string>(), email: new Set<string>(), name: new Set<string>() },
    [isAuthenticated, user],
  );

  // Task 6 (tiered): try each criterion in order of reliability — id, then email, then
  // name — and resolve at the FIRST tier that yields exactly one row. A tier with 2+ rows
  // (or all tiers empty) is not-found. This keeps all three criteria and the ambiguity
  // guard, but stops a name collision (two "Paul Cochrane"s) from discarding an
  // unambiguous id/email match. Attributing a stranger's standing is worse than no card.
  const viewerResolution = useMemo(() => {
    const empty = { row: null as Ranking | null, tier: null as string | null, ambiguousTier: null as string | null, count: 0 };
    if (rankings.length === 0) return empty;
    const tiers: { key: string; match: (ranking: Ranking) => boolean }[] = [
      { key: "id", match: (ranking) => viewerGroups.id.has(norm(ranking.user_id)) },
      // Structurally inert today: rankings carry no email field, so this tier never
      // matches — the effective order is id → name. Kept for when the payload adds email.
      {
        key: "email",
        match: (ranking) => viewerGroups.email.has(norm(ranking.user_id)) || viewerGroups.email.has(norm(ranking.full_name)),
      },
      { key: "name", match: (ranking) => viewerGroups.name.has(norm(ranking.full_name)) },
    ];
    for (const tier of tiers) {
      const matches = rankings.filter(tier.match);
      if (matches.length === 1) return { row: matches[0], tier: tier.key, ambiguousTier: null, count: 1 };
      if (matches.length >= 2) return { row: null, tier: null, ambiguousTier: tier.key, count: matches.length };
      // zero at this tier → fall through to the next, less-reliable one
    }
    return empty;
  }, [rankings, viewerGroups]);

  const myRow = viewerResolution.row;

  useEffect(() => {
    if (viewerResolution.ambiguousTier) {
      console.warn(
        `[ladder] viewer identity ambiguous at the '${viewerResolution.ambiguousTier}' tier (${viewerResolution.count} rows) — treating as not-in-ladder to avoid claiming a stranger's standing.`,
      );
    } else if (viewerResolution.row && viewerResolution.tier) {
      console.info(`[ladder] viewer resolved via the '${viewerResolution.tier}' tier → #${viewerResolution.row.rank}.`);
    }
  }, [viewerResolution]);

  const isMe = (ranking: Ranking) => myRow != null && ranking.user_id === myRow.user_id;

  // Anchor for "Near my level": the viewer's ranked TRP if present, else derived from
  // their profile NTRP so a signed-in player who isn't ranked yet can still use it.
  const myRating = useMemo(() => {
    const ranked = toNumber(myRow?.current_rating);
    if (ranked !== null) return ranked;
    return isAuthenticated ? ntrpToTrp(readViewerNtrp(user)) : null;
  }, [myRow, isAuthenticated, user]);

  const canNearMyLevel = isAuthenticated && myRating !== null;

  // The viewer's own ranked TRP (present whenever myRow exists) — used for row gaps.
  const myTrp = toNumber(myRow?.current_rating);
  const total = rankings.length;

  const leagues = useMemo(() => {
    const found = new Set<string>();
    rankings.forEach((ranking) => {
      String(ranking.rating_leagues || "").split(/\s+/).filter(Boolean).forEach((tag) => found.add(tag));
    });
    return leagueOrder.filter((tag) => found.has(tag));
  }, [rankings]);

  const stats = useMemo(
    () => ({
      players: rankings.length,
      matches: rankings.reduce((sum, ranking) => sum + Number(ranking.wins || 0), 0),
    }),
    [rankings],
  );

  // Default to "Around me" when the viewer is on the ladder, else "Top 50".
  const effectiveView: ViewKey = view ?? (myRow ? "around" : "top50");

  // Standing card: progress since the seed rating (lifetime, not recent form). Omitted
  // when there's no seed, no current, or no movement — never render a +0.000 / flat.
  const progressSinceSeed = useMemo(() => {
    if (!seed) return null;
    const { start, current } = seed;
    if (start === null || current === null || start === current) return null;
    return current - start;
  }, [seed]);

  // Standing card gap statements — drawn from the immediately adjacent rows in the
  // UNFILTERED, rank-ordered array. Edges (rank 1 / last) render only the valid half.
  const neighbours = useMemo(() => {
    if (!myRow) return { above: null as Ranking | null, below: null as Ranking | null };
    const idx = rankings.indexOf(myRow);
    return {
      above: idx > 0 ? rankings[idx - 1] : null,
      below: idx >= 0 && idx < rankings.length - 1 ? rankings[idx + 1] : null,
    };
  }, [rankings, myRow]);

  // Filter FIRST: gender / league / search apply to the full rank-ordered array, then the
  // view windows the filtered pool. Otherwise a cohort filter would gut the Around-me
  // window. Pool preserves rank order, so ranks stay global + non-contiguous throughout.
  const pool = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rankings.filter(
      (ranking) =>
        (gender === "all" || ranking.rating_gender === gender) &&
        matchesLeague(ranking, league) &&
        (!query || ranking.full_name.toLowerCase().includes(query)),
    );
  }, [rankings, gender, league, search]);

  const { rows, caption, selfAppend } = useMemo(() => {
    if (effectiveView === "near" && myRating !== null) {
      const band = pool.filter((ranking) => {
        const rating = toNumber(ranking.current_rating);
        return rating !== null && Math.abs(rating - myRating) <= NEAR_LEVEL_BAND;
      });
      let shown = band;
      if (band.length > 20) {
        shown = [...band]
          .sort(
            (a, b) =>
              Math.abs((toNumber(a.current_rating) ?? myRating) - myRating) -
              Math.abs((toNumber(b.current_rating) ?? myRating) - myRating),
          )
          .slice(0, 20)
          .sort((a, b) => a.rank - b.rank);
      }
      return {
        rows: shown,
        caption: `${band.length} within ±${NEAR_LEVEL_BAND.toFixed(2)} TRP · showing ${shown.length}`,
        selfAppend: null as Ranking | null,
      };
    }

    if (effectiveView === "around" && myRow) {
      // Centre on the viewer's rank INSERTION POINT in the filtered pool, not their row
      // index — so the window still works when the filter excludes the viewer entirely
      // (e.g. a man filtering to Women). insertAt = how many filtered rows outrank them.
      const insertAt = pool.filter((ranking) => ranking.rank < myRow.rank).length;
      const windowSize = 11; // viewer ±5
      let start = Math.max(0, insertAt - 5);
      let end = start + windowSize;
      if (end > pool.length) {
        end = pool.length;
        start = Math.max(0, end - windowSize);
      }
      const windowRows = pool.slice(start, end); // fewer than 11 in pool → shows all
      const caption = windowRows.length
        ? `Ranks #${windowRows[0].rank}–#${windowRows[windowRows.length - 1].rank}`
        : "";
      return { rows: windowRows, caption, selfAppend: null as Ranking | null };
    }

    // Top 50 — the top 50 of the filtered pool. Append the viewer's own row when they're
    // in the pool but fall outside the top 50, so their spot stays visible.
    const base = pool.slice(0, 50);
    const poolHasMe = myRow ? pool.some((ranking) => ranking.user_id === myRow.user_id) : false;
    const selfAppend =
      myRow && poolHasMe && !base.some((ranking) => ranking.user_id === myRow.user_id) ? myRow : null;
    return { rows: base, caption: "Top 50", selfAppend };
  }, [effectiveView, pool, myRating, myRow]);

  const showGap = myRow != null && myTrp !== null;

  const gapFor = (ranking: Ranking): number | null => {
    if (!showGap || isMe(ranking)) return null;
    const rating = toNumber(ranking.current_rating);
    return rating === null ? null : rating - (myTrp as number);
  };

  const selectView = (next: ViewKey) => {
    setView(next);
    setSearch(""); // switching views resets any active search
  };

  const openProfile = (ranking: Ranking) => navigate(`/players/${ranking.user_id}`);

  const startChallenge = (ranking: Ranking) => {
    const ntrp = estimateNtrp(ranking);
    challenge({
      id: ranking.user_id,
      name: ranking.full_name,
      ntrp: ntrp === "-" ? undefined : ntrp,
    });
  };

  const showViewChips = Boolean(myRow) || canNearMyLevel;
  const rosterReady = !loading && !error && rankings.length > 0;

  return (
    <MainLayout>
      <div className="bg-[#f7f4ff] text-slate-900">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 pt-5 sm:px-6">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-violet-500 text-white shadow-lg shadow-violet-500/20">
            <Trophy className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight">West LA Ladder</h1>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Public player rankings</p>
          </div>
          {/* The five stat cards were demoted to this one quiet line. */}
          <div className="ml-auto hidden text-sm font-semibold text-slate-400 sm:block">
            {stats.matches} matches · {stats.players} players
          </div>
        </div>

      <main className="mx-auto max-w-5xl px-4 py-5 sm:px-6">
        {/* Standing card / not-in-ladder state — signed-out viewers get neither. */}
        {rosterReady && myRow ? (
          <StandingCard
            row={myRow}
            total={total}
            progress={progressSinceSeed}
            above={neighbours.above}
            below={neighbours.below}
            myTrp={myTrp}
          />
        ) : rosterReady && isAuthenticated ? (
          <NotInLadder />
        ) : null}

        <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
            <div className="space-y-3">
              {showViewChips ? (
                <FilterRow label="View">
                  {myRow ? (
                    <FilterButton active={effectiveView === "around"} onClick={() => selectView("around")}>
                      📍 Around me
                    </FilterButton>
                  ) : null}
                  {canNearMyLevel ? (
                    <FilterButton active={effectiveView === "near"} onClick={() => selectView("near")}>
                      🎯 Near my level
                    </FilterButton>
                  ) : null}
                  <FilterButton active={effectiveView === "top50"} onClick={() => selectView("top50")}>
                    🏆 Top 50
                  </FilterButton>
                </FilterRow>
              ) : null}
              <FilterRow label="Gender">
                <FilterButton active={gender === "all"} onClick={() => setGender("all")}>All</FilterButton>
                <FilterButton active={gender === "M"} onClick={() => setGender("M")}>Men</FilterButton>
                <FilterButton active={gender === "F"} onClick={() => setGender("F")}>Women</FilterButton>
              </FilterRow>
              <FilterRow label="League">
                <FilterButton active={league === "all"} onClick={() => setLeague("all")}>All</FilterButton>
                {leagues.map((tag) => (
                  <FilterButton key={tag} active={league === tag} onClick={() => setLeague(tag)}>
                    {leagueLabels[tag] || tag}
                  </FilterButton>
                ))}
              </FilterRow>
            </div>
            <label className="flex min-w-0 items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 focus-within:ring-2 focus-within:ring-violet-500/30 lg:w-72">
              <Search className="h-4 w-4 shrink-0 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search player"
                className="w-full bg-transparent text-sm font-semibold text-slate-700 outline-none placeholder:text-slate-400"
              />
            </label>
          </div>
        </section>

        <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-violet-500" />
              <h2 className="font-black">Ladder</h2>
            </div>
            <div className="flex items-center gap-3">
              {rosterReady && caption ? (
                <span className="text-xs font-bold uppercase tracking-wide text-slate-400">{caption}</span>
              ) : null}
              {loading ? <RefreshCw className="h-4 w-4 animate-spin text-slate-400" /> : null}
            </div>
          </div>

          {error ? (
            <div className="p-8 text-center text-sm font-semibold text-rose-600">{error}</div>
          ) : loading ? (
            <div className="p-8 text-center text-sm font-semibold text-slate-400">Loading rankings...</div>
          ) : (
            <>
              <div className="hidden overflow-x-auto lg:block">
                <table className="w-full border-collapse text-left">
                  <thead className="bg-slate-50 text-[11px] font-black uppercase tracking-wide text-slate-400">
                    <tr>
                      <th className="px-5 py-3">#</th>
                      <th className="px-5 py-3">Player</th>
                      <th className="px-5 py-3 text-center">Rating</th>
                      {showGap ? <th className="px-5 py-3 text-center">vs you</th> : null}
                      <th className="px-5 py-3 text-center">NTRP~</th>
                      <th className="px-5 py-3 text-center">W-L</th>
                      <th className="px-5 py-3 text-right"> </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.map((ranking, index) => (
                      <RankingRow
                        key={ranking.user_id}
                        ranking={ranking}
                        index={index}
                        isMe={isMe(ranking)}
                        gap={gapFor(ranking)}
                        showGap={showGap}
                        onOpen={() => openProfile(ranking)}
                        onChallenge={() => startChallenge(ranking)}
                      />
                    ))}
                    {selfAppend ? (
                      <>
                        <tr>
                          <td colSpan={showGap ? 7 : 6} className="bg-slate-50 px-5 py-2 text-[11px] font-black uppercase tracking-wide text-slate-400">
                            Your position
                          </td>
                        </tr>
                        <RankingRow
                          ranking={selfAppend}
                          index={rows.length}
                          isMe
                          gap={null}
                          showGap={showGap}
                          onOpen={() => openProfile(selfAppend)}
                          onChallenge={() => startChallenge(selfAppend)}
                        />
                      </>
                    ) : null}
                  </tbody>
                </table>
              </div>

              <div className="divide-y divide-slate-100 lg:hidden">
                {rows.map((ranking, index) => (
                  <RankingCard
                    key={ranking.user_id}
                    ranking={ranking}
                    index={index}
                    isMe={isMe(ranking)}
                    gap={gapFor(ranking)}
                    onOpen={() => openProfile(ranking)}
                    onChallenge={() => startChallenge(ranking)}
                  />
                ))}
                {selfAppend ? (
                  <>
                    <div className="bg-slate-50 px-4 py-2 text-[11px] font-black uppercase tracking-wide text-slate-400">
                      Your position
                    </div>
                    <RankingCard
                      ranking={selfAppend}
                      index={rows.length}
                      isMe
                      gap={null}
                      onOpen={() => openProfile(selfAppend)}
                      onChallenge={() => startChallenge(selfAppend)}
                    />
                  </>
                ) : null}
              </div>

              {!rows.length && !selfAppend ? (
                <div className="p-8 text-center text-sm font-semibold text-slate-400">No players match these filters.</div>
              ) : null}
            </>
          )}
        </section>

        <p className="mt-4 text-center text-xs font-semibold text-slate-400">
          Tap any row to open a profile. Tap <span className="text-violet-600">Challenge</span> to start a match.
        </p>
      </main>
      </div>
    </MainLayout>
  );
}

function StandingCard({
  row,
  total,
  progress,
  above,
  below,
  myTrp,
}: {
  row: Ranking;
  total: number;
  progress: number | null;
  above: Ranking | null;
  below: Ranking | null;
  myTrp: number | null;
}) {
  // Ceil, not round: rank 412/1024 is 40.23%, and "Top 40%" would be a false claim.
  // Ceil is truthful and puts rank 1 at "Top 1%" without special-casing.
  const percentile = total > 0 ? Math.ceil((row.rank / total) * 100) : null;
  const gapTo = (other: Ranking | null): number | null => {
    if (!other || myTrp === null) return null;
    const rating = toNumber(other.current_rating);
    return rating === null ? null : rating - myTrp;
  };
  const gapAbove = gapTo(above);
  const gapBelow = gapTo(below);

  return (
    <section className="rounded-2xl border border-violet-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
        <div>
          <div className="text-[11px] font-black uppercase tracking-wide text-violet-500">Your standing</div>
          <div className="mt-1 text-5xl font-black leading-none tabular-nums text-slate-900">#{row.rank}</div>
          <div className="mt-1 text-xs font-semibold text-slate-400">of {total} ranked</div>
        </div>
        {percentile !== null ? (
          <Metric label="Standing" value={`Top ${percentile}%`} />
        ) : null}
        <Metric label="Rating" value={formatRating(row.current_rating)} />
        {progress !== null ? (
          <Metric
            label="Since your starting rating"
            value={formatSignedDiff(progress)}
            valueClassName={progress >= 0 ? "text-emerald-600" : "text-rose-600"}
          />
        ) : null}
        <Metric
          label="Record"
          value={`${row.wins ?? 0}-${row.losses ?? 0}`}
          note={`${row.matches_played ?? 0} played`}
        />
      </div>

      {above || below ? (
        <div className="mt-4 space-y-1.5 border-t border-slate-100 pt-3 text-sm font-semibold text-slate-500">
          {above ? (
            <p>
              Beat <span className="font-black text-slate-800">{above.full_name}</span> to take #{above.rank}
              {gapAbove !== null ? (
                <span className="ml-1 font-black tabular-nums text-slate-400">({formatSignedDiff(gapAbove)})</span>
              ) : null}
            </p>
          ) : null}
          {below ? (
            <p>
              Lose to <span className="font-black text-slate-800">{below.full_name}</span> and drop to #{below.rank}
              {gapBelow !== null ? (
                <span className="ml-1 font-black tabular-nums text-slate-400">({formatSignedDiff(gapBelow)})</span>
              ) : null}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function Metric({
  label,
  value,
  note,
  valueClassName = "text-slate-900",
}: {
  label: string;
  value: string;
  note?: string;
  valueClassName?: string;
}) {
  return (
    <div>
      <div className="text-[11px] font-black uppercase tracking-wide text-slate-400">{label}</div>
      <div className={`mt-1 text-xl font-black tabular-nums ${valueClassName}`}>{value}</div>
      {note ? <div className="text-xs font-semibold text-slate-400">{note}</div> : null}
    </div>
  );
}

function NotInLadder() {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-violet-50 text-violet-500">
        <Trophy className="h-6 w-6" />
      </div>
      <h2 className="mt-3 text-lg font-black text-slate-900">Claim your spot on the ladder</h2>
      <p className="mx-auto mt-1 max-w-sm text-sm font-semibold text-slate-500">
        Play a league match to get ranked — once your result is in, you'll show up here with your standing
        and the players right around you.
      </p>
    </section>
  );
}

function FilterRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-[11px] font-black uppercase tracking-wide text-slate-400">{label}</div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-4 py-2 text-sm font-black transition-colors ${
        active
          ? "border-violet-500 bg-violet-500 text-white shadow-sm shadow-violet-500/20"
          : "border-slate-200 bg-white text-slate-500 hover:border-violet-300 hover:text-violet-600"
      }`}
    >
      {children}
    </button>
  );
}

function Avatar({ name, index }: { name: string; index: number }) {
  return (
    <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-full text-sm font-black text-white ${AVATAR_COLORS[index % AVATAR_COLORS.length]}`}>
      {initials(name)}
    </div>
  );
}

function RankBadge({ rank }: { rank: number | null | undefined }) {
  // Flat, neutral rank number — no gold/silver/bronze medals. Em dash when absent.
  const label = Number.isFinite(rank) ? rank : "—";
  return <span className="inline-grid h-8 w-8 place-items-center text-sm font-black tabular-nums text-slate-500">{label}</span>;
}

function GapPill({ gap }: { gap: number }) {
  return (
    <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-black tabular-nums text-slate-500">
      {formatSignedDiff(gap)}
    </span>
  );
}

function ChallengeButton({ onChallenge }: { onChallenge: () => void }) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onChallenge();
      }}
      className="inline-flex items-center gap-1.5 rounded-lg border border-violet-500 px-3 py-1.5 text-xs font-black text-violet-600 transition-colors hover:bg-violet-50"
    >
      <Swords className="h-3.5 w-3.5" />
      Challenge
    </button>
  );
}

function YouTag() {
  return <span className="rounded-full bg-violet-500 px-2 py-0.5 text-[10px] font-black text-white">You</span>;
}

function RankingRow({
  ranking,
  index,
  isMe,
  gap,
  showGap,
  onOpen,
  onChallenge,
}: {
  ranking: Ranking;
  index: number;
  isMe: boolean;
  gap: number | null;
  showGap: boolean;
  onOpen: () => void;
  onChallenge: () => void;
}) {
  return (
    <tr
      onClick={onOpen}
      className={`cursor-pointer transition-colors ${isMe ? "bg-violet-50 hover:bg-violet-100/70" : "hover:bg-slate-50"}`}
    >
      <td className="px-5 py-4"><RankBadge rank={ranking.rank} /></td>
      <td className="px-5 py-4">
        <div className="flex items-center gap-3">
          <Avatar name={ranking.full_name} index={index} />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="truncate font-black text-slate-900">{ranking.full_name}</p>
              {isMe ? <YouTag /> : null}
              {shouldShowEstimateBadge(ranking) ? <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-black text-amber-700">Est.</span> : null}
            </div>
            <p className="text-sm font-semibold text-slate-400">{displayLeague(ranking)}</p>
          </div>
        </div>
      </td>
      <td className="px-5 py-4 text-center"><span className="rounded-lg bg-violet-50 px-3 py-1 font-black tabular-nums text-violet-600">{formatRating(ranking.current_rating)}</span></td>
      {showGap ? (
        <td className="px-5 py-4 text-center">{gap !== null ? <GapPill gap={gap} /> : <span className="text-slate-300">—</span>}</td>
      ) : null}
      <td className="px-5 py-4 text-center"><span className="rounded-lg bg-emerald-50 px-3 py-1 font-black tabular-nums text-emerald-600">{estimateNtrp(ranking)}</span></td>
      <td className="px-5 py-4 text-center font-black tabular-nums text-slate-700">{ranking.wins}-{ranking.losses}</td>
      <td className="px-5 py-4 text-right">{isMe ? null : <ChallengeButton onChallenge={onChallenge} />}</td>
    </tr>
  );
}

function RankingCard({
  ranking,
  index,
  isMe,
  gap,
  onOpen,
  onChallenge,
}: {
  ranking: Ranking;
  index: number;
  isMe: boolean;
  gap: number | null;
  onOpen: () => void;
  onChallenge: () => void;
}) {
  return (
    <div onClick={onOpen} className={`cursor-pointer p-4 ${isMe ? "bg-violet-50" : ""}`}>
      <div className="flex items-center gap-3">
        <RankBadge rank={ranking.rank} />
        <Avatar name={ranking.full_name} index={index} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate font-black text-slate-900">{ranking.full_name}</p>
            {isMe ? <YouTag /> : null}
            {shouldShowEstimateBadge(ranking) ? <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-black text-amber-700">Est.</span> : null}
          </div>
          <p className="text-sm font-semibold text-slate-400">{displayLeague(ranking)}</p>
        </div>
        <div className="text-right">
          <p className="rounded-lg bg-violet-50 px-2.5 py-1 font-black text-violet-600">{formatRating(ranking.current_rating)}</p>
          <p className="mt-1 text-xs font-bold text-slate-400">{ranking.wins}-{ranking.losses}</p>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <div className="rounded-xl bg-emerald-50 px-2 py-1 text-center text-xs font-black text-emerald-600">NTRP {estimateNtrp(ranking)}</div>
        {gap !== null ? (
          <div className="rounded-xl bg-slate-100 px-2 py-1 text-center text-xs font-black tabular-nums text-slate-500">vs you {formatSignedDiff(gap)}</div>
        ) : null}
        <div className="ml-auto">
          {isMe ? <span className="text-xs font-black text-violet-500">This is you</span> : <ChallengeButton onChallenge={onChallenge} />}
        </div>
      </div>
    </div>
  );
}
