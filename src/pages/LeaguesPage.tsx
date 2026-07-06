import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronRight, Trophy, Users } from "lucide-react";
import { Link } from "react-router-dom";

import { getLeagueMatchNeeds, type League, listMyLeagues } from "../api/leagues";
import { isFutureLeagueItem } from "./leagueDetailTime";
import MainLayout from "../components/MainLayout";
import { useAuth } from "../context/AuthContext";
import { getStoredAuthToken } from "../services/authToken";

import "./LeaguesPage.css";

const formatDate = (value?: string) => {
  if (!value) return "Dates TBD";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

const formatRange = (league: League) => {
  const start = formatDate(league.start_date);
  const end = formatDate(league.deadline);
  if (start === "Dates TBD" && end === "Dates TBD") return "Dates TBD";
  return `${start} - ${end}`;
};

const LeaguesPage = () => {
  const { user } = useAuth();
  const token = useMemo(
    () =>
      user?.session?.access_token ??
      user?.access_token ??
      user?.token ??
      getStoredAuthToken({ preferScheme: "token" }) ??
      undefined,
    [user],
  );
  const [leagues, setLeagues] = useState<League[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Per-league "players looking" counts (open match needs) for the card badge.
  // listMyLeagues doesn't carry a count, so fetch needs per league — best-effort.
  const [lookingCounts, setLookingCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    listMyLeagues({ token, signal: controller.signal })
      .then((response) => setLeagues(response.leagues ?? []))
      .catch((err) => {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Failed to load leagues");
        setLeagues([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [token]);

  useEffect(() => {
    if (!leagues.length) {
      setLookingCounts({});
      return;
    }
    const controller = new AbortController();
    Promise.all(
      leagues.map(async (league) => {
        try {
          // "needs" (all open) can be empty even when players are looking, so fall
          // back to the recommended "suggestions" count.
          const [personal, all] = await Promise.all([
            getLeagueMatchNeeds({ leagueId: league.id, token, signal: controller.signal }),
            getLeagueMatchNeeds({ leagueId: league.id, token, scope: "all", signal: controller.signal }),
          ]);
          const count =
            (all.needs ?? []).filter(isFutureLeagueItem).length ||
            (personal.suggestions ?? []).filter(isFutureLeagueItem).length;
          return [String(league.id), count] as const;
        } catch {
          return [String(league.id), 0] as const;
        }
      }),
    ).then((entries) => {
      if (controller.signal.aborted) return;
      setLookingCounts(Object.fromEntries(entries));
    });
    return () => controller.abort();
  }, [leagues, token]);

  return (
    <MainLayout pageClassName="leagues-shell" mobileChrome="home" hideMobileNewMatch>
      <section className="leagues-page">
        <header className="leagues-page__header">
          <div>
            <p className="leagues-page__eyebrow">Match play</p>
            <h1>My Leagues</h1>
            <p>Manage flex league standings, opponents, results, and matches.</p>
          </div>
        </header>

        {loading ? <div className="leagues-page__state">Loading leagues...</div> : null}
        {error ? <div className="leagues-page__state leagues-page__state--error">{error}</div> : null}

        {!loading && !error && leagues.length === 0 ? (
          <div className="leagues-page__empty">
            <Trophy size={30} />
            <h2>No leagues yet</h2>
            <p>Your active flex leagues will appear here after a coach or admin adds you.</p>
          </div>
        ) : null}

        <div className="leagues-page__grid">
          {leagues.map((league) => (
            <Link className="league-card" to={`/leagues/${league.id}/dashboard`} key={league.id}>
              <div className="league-card__main">
                <span className="league-card__icon">
                  <Trophy size={18} />
                </span>
                <div>
                  <h2>{league.name}</h2>
                  <p>
                    {[league.skill_band, league.gender, league.status].filter(Boolean).join(" · ") || "Flex league"}
                  </p>
                  {lookingCounts[String(league.id)] > 0 ? (
                    <span className="league-card__looking">
                      🎾 {lookingCounts[String(league.id)]} looking
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="league-card__meta">
                <span>
                  <CalendarDays size={14} />
                  {formatRange(league)}
                </span>
                <span>
                  <Users size={14} />
                  {league.membership_status ?? "active"}
                </span>
              </div>
              <ChevronRight className="league-card__arrow" size={18} />
            </Link>
          ))}
        </div>
      </section>
    </MainLayout>
  );
};

export default LeaguesPage;
