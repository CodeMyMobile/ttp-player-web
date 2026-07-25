import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Trophy, BarChart3, Search, RefreshCw, Swords } from "lucide-react";
import { buildApiUrl } from "../api/config";
import { shouldShowEstimateBadge } from "../utils/ratingBadges";
import { deriveNtrp } from "../utils/ratingConversions";
import { useAuth } from "../context/AuthContext";
import { useAuthDrawer } from "../context/AuthDrawerContext";
import { canChallenge } from "../utils/challengeEntitlement";
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

// "Near my level" window, in TRP. NTRP moves ~0.5 per 1.0 TRP, so ±1.0 TRP ≈ ±0.5 NTRP.
const NEAR_LEVEL_TRP = 1.0;

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

// The account id and the ranking user_id are different id-spaces (account id can be
// "1" while ranking rows use player ids), so a single-id compare misses the viewer.
// Match by id OR full name OR email — mirrors the league dashboard's viewer matching.
const buildViewerIdentities = (user: unknown): Set<string> => {
  const u = (user ?? {}) as Record<string, unknown> & { profile?: Record<string, unknown> };
  const p = (u.profile ?? {}) as Record<string, unknown>;
  return new Set(
    [
      u.id, u.user_id, u.player_id, p.id, p.user_id,
      u.full_name, u.name, p.full_name,
      u.email, p.email,
    ]
      .map(norm)
      .filter(Boolean),
  );
};

const matchesViewer = (identities: Set<string>, ...candidates: unknown[]) =>
  candidates.map(norm).filter(Boolean).some((value) => identities.has(value));

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

export default function PublicMatchResultsPage() {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const { openAuth } = useAuthDrawer();

  const [rankings, setRankings] = useState<Ranking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gender, setGender] = useState<"all" | "M" | "F">("all");
  const [league, setLeague] = useState("all");
  const [search, setSearch] = useState("");
  const [nearMyLevel, setNearMyLevel] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
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

  const viewerIdentities = useMemo(
    () => (isAuthenticated ? buildViewerIdentities(user) : new Set<string>()),
    [isAuthenticated, user],
  );
  const isMe = (ranking: Ranking) =>
    viewerIdentities.size > 0 && matchesViewer(viewerIdentities, ranking.user_id, ranking.full_name);

  // Rating that powers "Near my level": the viewer's ranked TRP if they're on the
  // ladder, else derived from their profile NTRP so signed-in players can still use it.
  const myRating = useMemo(() => {
    const mine = rankings.find((ranking) => matchesViewer(viewerIdentities, ranking.user_id, ranking.full_name));
    const ranked = toNumber(mine?.current_rating);
    if (ranked !== null) return ranked;
    return isAuthenticated ? ntrpToTrp(readViewerNtrp(user)) : null;
  }, [rankings, viewerIdentities, isAuthenticated, user]);

  const canNearMyLevel = isAuthenticated && myRating !== null;

  const leagues = useMemo(() => {
    const found = new Set<string>();
    rankings.forEach((ranking) => {
      String(ranking.rating_leagues || "").split(/\s+/).filter(Boolean).forEach((tag) => found.add(tag));
    });
    return leagueOrder.filter((tag) => found.has(tag));
  }, [rankings]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rankings.filter((ranking) => {
      const genderOk = gender === "all" || ranking.rating_gender === gender;
      const leagueOk = matchesLeague(ranking, league);
      const searchOk = !query || ranking.full_name.toLowerCase().includes(query);
      const rating = toNumber(ranking.current_rating);
      const nearOk =
        !nearMyLevel || !canNearMyLevel || (rating !== null && Math.abs(rating - (myRating ?? 0)) <= NEAR_LEVEL_TRP);
      return genderOk && leagueOk && searchOk && nearOk;
    });
  }, [rankings, gender, league, search, nearMyLevel, canNearMyLevel, myRating]);

  const stats = useMemo(
    () => ({
      players: rankings.length,
      matches: rankings.reduce((sum, ranking) => sum + Number(ranking.wins || 0), 0),
    }),
    [rankings],
  );

  const topThree = filtered.slice(0, 3);

  const openProfile = (ranking: Ranking) => navigate(`/players/${ranking.user_id}`);

  // Single entry point for starting a challenge: entitlement gate → sign-in gate →
  // hand off to the existing match-request flow with the opponent pre-passed.
  // (The composer consumes `challengeOpponent` to prefill the invitee in PR C.)
  const startChallenge = (ranking: Ranking) => {
    if (!canChallenge({ isAuthenticated })) return;
    const ntrp = estimateNtrp(ranking);
    const challengeOpponent = {
      id: ranking.user_id,
      name: ranking.full_name,
      ntrp: ntrp === "-" ? undefined : ntrp,
    };
    const launch = () => navigate("/matches", { state: { openNewMatch: true, challengeOpponent } });
    if (!isAuthenticated) {
      openAuth({
        mode: "signup",
        reason: `Sign in or create an account to challenge ${ranking.full_name}.`,
        onSuccess: launch,
      });
      return;
    }
    launch();
  };

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
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
            <div className="space-y-3">
              {canNearMyLevel ? (
                <FilterRow label="For you">
                  <FilterButton active={nearMyLevel} onClick={() => setNearMyLevel(true)}>🎯 Near my level</FilterButton>
                  <FilterButton active={!nearMyLevel} onClick={() => setNearMyLevel(false)}>All levels</FilterButton>
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

        {topThree.length ? (
          <section className="mt-5 grid gap-3 md:grid-cols-3">
            {topThree.map((ranking, index) => (
              <button
                key={ranking.user_id}
                type="button"
                onClick={() => openProfile(ranking)}
                className="rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-colors hover:border-violet-300 hover:bg-violet-50/40"
              >
                <div className="flex items-center justify-between">
                  <span className="text-2xl">{index === 0 ? "🏆" : index === 1 ? "🥈" : "🥉"}</span>
                  <span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-black text-violet-600">
                    {formatRating(ranking.current_rating)}
                  </span>
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <Avatar name={ranking.full_name} index={index} />
                  <div className="min-w-0">
                    <p className="truncate font-black text-slate-900">{ranking.full_name}</p>
                    <p className="text-sm font-semibold text-slate-400">{displayLeague(ranking)}</p>
                  </div>
                </div>
              </button>
            ))}
          </section>
        ) : null}

        <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-violet-500" />
              <h2 className="font-black">Ladder</h2>
            </div>
            {loading ? <RefreshCw className="h-4 w-4 animate-spin text-slate-400" /> : null}
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
                      <th className="px-5 py-3 text-center">NTRP~</th>
                      <th className="px-5 py-3 text-center">W-L</th>
                      <th className="px-5 py-3 text-right"> </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filtered.map((ranking, index) => (
                      <RankingRow
                        key={ranking.user_id}
                        ranking={ranking}
                        index={index}
                        isMe={isMe(ranking)}
                        onOpen={() => openProfile(ranking)}
                        onChallenge={() => startChallenge(ranking)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="divide-y divide-slate-100 lg:hidden">
                {filtered.map((ranking, index) => (
                  <RankingCard
                    key={ranking.user_id}
                    ranking={ranking}
                    index={index}
                    isMe={isMe(ranking)}
                    onOpen={() => openProfile(ranking)}
                    onChallenge={() => startChallenge(ranking)}
                  />
                ))}
              </div>

              {!filtered.length ? (
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

function RankBadge({ rank }: { rank: number }) {
  const classes = rank === 1
    ? "bg-amber-100 text-amber-700"
    : rank === 2
      ? "bg-slate-100 text-slate-600"
      : rank === 3
        ? "bg-orange-100 text-orange-700"
        : "bg-transparent text-slate-300";
  return <span className={`inline-grid h-8 w-8 place-items-center rounded-lg text-sm font-black ${classes}`}>{rank}</span>;
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
  onOpen,
  onChallenge,
}: {
  ranking: Ranking;
  index: number;
  isMe: boolean;
  onOpen: () => void;
  onChallenge: () => void;
}) {
  const rank = index + 1;
  return (
    <tr
      onClick={onOpen}
      className={`cursor-pointer transition-colors ${isMe ? "bg-violet-50 hover:bg-violet-100/70" : "hover:bg-slate-50"}`}
    >
      <td className="px-5 py-4"><RankBadge rank={rank} /></td>
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
  onOpen,
  onChallenge,
}: {
  ranking: Ranking;
  index: number;
  isMe: boolean;
  onOpen: () => void;
  onChallenge: () => void;
}) {
  const rank = index + 1;
  return (
    <div onClick={onOpen} className={`cursor-pointer p-4 ${isMe ? "bg-violet-50" : ""}`}>
      <div className="flex items-center gap-3">
        <RankBadge rank={rank} />
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
        <div className="ml-auto">
          {isMe ? <span className="text-xs font-black text-violet-500">This is you</span> : <ChallengeButton onChallenge={onChallenge} />}
        </div>
      </div>
    </div>
  );
}
