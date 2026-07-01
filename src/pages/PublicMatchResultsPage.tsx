import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Trophy, BarChart3, Users, Activity, Search, RefreshCw } from "lucide-react";
import { buildApiUrl } from "../api/config";
import { shouldShowEstimateBadge } from "../utils/ratingBadges";

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
  rating_gender?: string | null;
  rating_leagues?: string | null;
};

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

const estimateNtrp = (ranking: Ranking) => {
  const direct = toNumber(ranking.usta_rating);
  if (direct !== null && direct > 0 && direct <= 7) return direct.toFixed(2);
  const rating = toNumber(ranking.current_rating);
  if (rating === null) return "-";
  const base = ranking.rating_gender === "F" ? 4.5 : 5.0;
  const ntrp = Math.max(2.5, Math.min(6.0, Math.round((3.5 + (rating - base) * 0.5) * 4) / 4));
  return ntrp.toFixed(2);
};

const estimateUtr = (ranking: Ranking) => {
  const direct = toNumber(ranking.uta_rating);
  if (direct !== null && direct > 0) return direct.toFixed(1);
  const rating = toNumber(ranking.current_rating);
  return rating === null ? "-" : (Math.round((rating * 2 - 5) * 10) / 10).toFixed(1);
};

const displayLeague = (ranking: Ranking) => {
  const tags = String(ranking.rating_leagues || "").split(/\s+/).filter(Boolean);
  const tag = tags[tags.length - 1];
  return leagueLabels[tag] || tag || "Open";
};

const matchesLeague = (ranking: Ranking, league: string) => {
  if (league === "all") return true;
  return String(ranking.rating_leagues || "").split(/\s+/).includes(league);
};

export default function PublicMatchResultsPage() {
  const [rankings, setRankings] = useState<Ranking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gender, setGender] = useState<"all" | "M" | "F">("all");
  const [league, setLeague] = useState("all");
  const [search, setSearch] = useState("");

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
      return genderOk && leagueOk && searchOk;
    });
  }, [rankings, gender, league, search]);

  const stats = useMemo(() => {
    const active = rankings.filter((ranking) => Number(ranking.matches_played || 0) > 0).length;
    return {
      players: rankings.length,
      matches: rankings.reduce((sum, ranking) => sum + Number(ranking.wins || 0), 0),
      men: rankings.filter((ranking) => ranking.rating_gender === "M").length,
      women: rankings.filter((ranking) => ranking.rating_gender === "F").length,
      active,
    };
  }, [rankings]);

  const topThree = filtered.slice(0, 3);

  return (
    <div className="min-h-screen bg-[#f7f4ff] text-slate-900">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-4 sm:px-6">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-violet-500 text-white shadow-lg shadow-violet-500/20">
            <Trophy className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight">West LA Ladder</h1>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Public player rankings</p>
          </div>
          <div className="ml-auto hidden text-sm font-semibold text-slate-400 sm:block">
            {stats.matches} matches · {stats.players} players
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6">
        <div className="grid grid-cols-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm sm:grid-cols-5">
          {[
            ["Players", stats.players],
            ["Matches", stats.matches],
            ["Men", stats.men],
            ["Women", stats.women],
            ["Active", stats.active],
          ].map(([label, value]) => (
            <div key={label} className="border-b border-r border-slate-100 px-4 py-4 text-center last:border-r-0 sm:border-b-0">
              <div className="text-2xl font-black text-violet-500">{value}</div>
              <div className="mt-1 text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</div>
            </div>
          ))}
        </div>

        <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
            <div className="space-y-3">
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
              <div key={ranking.user_id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
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
              </div>
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
                      <th className="px-5 py-3 text-center">UTR~</th>
                      <th className="px-5 py-3 text-center">W-L</th>
                      <th className="px-5 py-3 text-center">Change</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filtered.map((ranking, index) => (
                      <RankingRow key={ranking.user_id} ranking={ranking} index={index} />
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="divide-y divide-slate-100 lg:hidden">
                {filtered.map((ranking, index) => (
                  <RankingCard key={ranking.user_id} ranking={ranking} index={index} />
                ))}
              </div>

              {!filtered.length ? (
                <div className="p-8 text-center text-sm font-semibold text-slate-400">No players match these filters.</div>
              ) : null}
            </>
          )}
        </section>
      </main>
    </div>
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

function ChangeValue({ value }: { value: number | null }) {
  const parsed = toNumber(value);
  const color = parsed === null || Math.abs(parsed) < 0.001
    ? "text-slate-400"
    : parsed > 0
      ? "text-emerald-600"
      : "text-rose-600";
  const label = parsed === null ? "-" : `${parsed > 0 ? "+" : ""}${parsed.toFixed(3)}`;
  return <span className={`font-black tabular-nums ${color}`}>{label}</span>;
}

function RankingRow({ ranking, index }: { ranking: Ranking; index: number }) {
  const rank = index + 1;
  return (
    <tr className="transition-colors hover:bg-slate-50">
      <td className="px-5 py-4"><RankBadge rank={rank} /></td>
      <td className="px-5 py-4">
        <div className="flex items-center gap-3">
          <Avatar name={ranking.full_name} index={index} />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="truncate font-black text-slate-900">{ranking.full_name}</p>
              {shouldShowEstimateBadge(ranking) ? <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-black text-amber-700">Est.</span> : null}
            </div>
            <p className="text-sm font-semibold text-slate-400">{displayLeague(ranking)}</p>
          </div>
        </div>
      </td>
      <td className="px-5 py-4 text-center"><span className="rounded-lg bg-violet-50 px-3 py-1 font-black tabular-nums text-violet-600">{formatRating(ranking.current_rating)}</span></td>
      <td className="px-5 py-4 text-center"><span className="rounded-lg bg-emerald-50 px-3 py-1 font-black tabular-nums text-emerald-600">{estimateNtrp(ranking)}</span></td>
      <td className="px-5 py-4 text-center"><span className="rounded-lg bg-blue-50 px-3 py-1 font-black tabular-nums text-blue-600">{estimateUtr(ranking)}</span></td>
      <td className="px-5 py-4 text-center font-black tabular-nums text-slate-700">{ranking.wins}-{ranking.losses}</td>
      <td className="px-5 py-4 text-center"><ChangeValue value={ranking.rating_change} /></td>
    </tr>
  );
}

function RankingCard({ ranking, index }: { ranking: Ranking; index: number }) {
  const rank = index + 1;
  return (
    <div className="p-4">
      <div className="flex items-center gap-3">
        <RankBadge rank={rank} />
        <Avatar name={ranking.full_name} index={index} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate font-black text-slate-900">{ranking.full_name}</p>
            {shouldShowEstimateBadge(ranking) ? <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-black text-amber-700">Est.</span> : null}
          </div>
          <p className="text-sm font-semibold text-slate-400">{displayLeague(ranking)}</p>
        </div>
        <div className="text-right">
          <p className="rounded-lg bg-violet-50 px-2.5 py-1 font-black text-violet-600">{formatRating(ranking.current_rating)}</p>
          <p className="mt-1 text-xs font-bold text-slate-400">{ranking.wins}-{ranking.losses}</p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs font-black">
        <div className="rounded-xl bg-emerald-50 p-2 text-emerald-600">NTRP {estimateNtrp(ranking)}</div>
        <div className="rounded-xl bg-blue-50 p-2 text-blue-600">UTR {estimateUtr(ranking)}</div>
        <div className="rounded-xl bg-slate-50 p-2"><ChangeValue value={ranking.rating_change} /></div>
      </div>
    </div>
  );
}
