import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CalendarDays, ChevronRight, Pin, Star, Trophy, Users } from "lucide-react";
import { Link } from "react-router-dom";

import {
  getLeagueMatchNeeds,
  type League,
  type LeagueMatchNeed,
  type LeagueMatchSuggestion,
  listMyLeagues,
} from "../api/leagues";
import MainLayout from "../components/MainLayout";
import { useAuth } from "../context/AuthContext";
import { getStoredAuthToken } from "../services/authToken";
import { formatLeagueDate, formatLeagueTime } from "./leagueDetailTime";

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

type LeagueNeedItem = LeagueMatchNeed & {
  league_id: number | string;
  league_name?: string;
};

type LeagueSuggestionItem = LeagueMatchSuggestion & {
  league_id: number | string;
  league_name?: string;
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
  // Per-league "players looking" counts (open match-need suggestions). listMyLeagues
  // doesn't carry a count, so we fetch needs per league — best-effort, badge only.
  const [lookingCounts, setLookingCounts] = useState<Record<string, number>>({});
  const [myMatchNeeds, setMyMatchNeeds] = useState<LeagueNeedItem[]>([]);
  const [allMatchNeeds, setAllMatchNeeds] = useState<LeagueNeedItem[]>([]);
  const [recommendedNeeds, setRecommendedNeeds] = useState<LeagueSuggestionItem[]>([]);

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
          const [personal, all] = await Promise.all([
            getLeagueMatchNeeds({ leagueId: league.id, token, signal: controller.signal }),
            getLeagueMatchNeeds({ leagueId: league.id, token, scope: "all", signal: controller.signal }),
          ]);
          return {
            league,
            myNeeds: (personal.myNeeds ?? []).map((need) => ({
              ...need,
              league_id: league.id,
              league_name: league.name,
            })),
            suggestions: (personal.suggestions ?? []).map((suggestion) => ({
              ...suggestion,
              league_id: league.id,
              league_name: league.name,
            })),
            needs: (all.needs ?? []).map((need) => ({
              ...need,
              league_id: league.id,
              league_name: league.name,
            })),
          };
        } catch {
          return { league, myNeeds: [], suggestions: [], needs: [] };
        }
      }),
    ).then((entries) => {
      if (controller.signal.aborted) return;
      setMyMatchNeeds(entries.flatMap((entry) => entry.myNeeds));
      setRecommendedNeeds(entries.flatMap((entry) => entry.suggestions));
      setAllMatchNeeds(entries.flatMap((entry) => entry.needs));
      setLookingCounts(Object.fromEntries(
        entries.map((entry) => [
          String(entry.league.id),
          entry.needs.length || entry.suggestions.length,
        ]),
      ));
    });
    return () => controller.abort();
  }, [leagues, token]);

  const sortedRecommendedNeeds = useMemo(() => [...recommendedNeeds].sort((a, b) => {
    const aVariance = typeof a.time_variance_minutes === "number" ? a.time_variance_minutes : Number.POSITIVE_INFINITY;
    const bVariance = typeof b.time_variance_minutes === "number" ? b.time_variance_minutes : Number.POSITIVE_INFINITY;
    if (aVariance !== bVariance) return aVariance - bVariance;
    return Number(a.distance_miles || Number.POSITIVE_INFINITY) - Number(b.distance_miles || Number.POSITIVE_INFINITY);
  }), [recommendedNeeds]);

  const sortedAllMatchNeeds = useMemo(() => [...allMatchNeeds].sort((a, b) => {
    if (a.has_played_before !== b.has_played_before) return a.has_played_before ? 1 : -1;
    const aDistance = Number(a.distance_miles);
    const bDistance = Number(b.distance_miles);
    const aDistanceValue = Number.isFinite(aDistance) ? aDistance : Number.POSITIVE_INFINITY;
    const bDistanceValue = Number.isFinite(bDistance) ? bDistance : Number.POSITIVE_INFINITY;
    if (aDistanceValue !== bDistanceValue) return aDistanceValue - bDistanceValue;
    return new Date(a.start_date_time || 0).getTime() - new Date(b.start_date_time || 0).getTime();
  }), [allMatchNeeds]);

  return (
    <MainLayout pageClassName="leagues-shell" hideMobileNewMatch>
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

        {!loading && !error ? (
          <section className="match-needs-browser match-needs-browser--leagues" aria-label="League match needs">
            <div className="match-browser-header">
              <div>
                <h2>Match Browser</h2>
                <p>All active flex league match requests</p>
              </div>
              {leagues[0] ? <Link to={`/leagues/${leagues[0].id}`}>+ Post yours</Link> : null}
            </div>

            <div className="match-needs-section">
              <div className="match-needs-section__head">
                <Pin size={19} />
                <h2>My posted availability</h2>
                <span>{myMatchNeeds.length} active</span>
              </div>
              {myMatchNeeds.length ? (
                <div className="my-availability-list">
                  {myMatchNeeds.slice(0, 3).map((need) => (
                    <Link className="my-availability-card" to={`/leagues/${need.league_id}`} key={`${need.league_id}-${need.id}`}>
                      <strong>{formatLeagueDate(need.start_date_time, need.timezone)} · {formatLeagueTime(need.start_date_time, need.timezone)}</strong>
                      <p>{need.location_text || need.match_location || need.location || "Location TBD"}</p>
                      <span>Live • {need.league_name || "Flex League"}</span>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="match-needs-empty match-needs-empty--compact">
                  <p>You have not posted availability yet.</p>
                </div>
              )}
            </div>

            <div className="match-needs-section">
              <div className="match-needs-section__head match-needs-section__head--recommended">
                <Star size={19} />
                <h2>Recommended matches</h2>
                <span>{sortedRecommendedNeeds.length} perfect fit{sortedRecommendedNeeds.length === 1 ? "" : "s"}</span>
              </div>
              <p className="match-needs-section__sub">These players are looking at times that match your availability.</p>
              {sortedRecommendedNeeds.length ? (
                <div className="recommended-grid">
                  {sortedRecommendedNeeds.slice(0, 6).map((suggestion) => (
                    <Link className="recommended-match-card" to={`/leagues/${suggestion.league_id}`} key={`${suggestion.league_id}-${suggestion.id}`}>
                      <span className="recommended-match-card__badge">Matches your time</span>
                      <strong>{suggestion.player_name || "League player"}</strong>
                      {suggestion.player_skill ? <span className="recommended-match-card__rating">TRP {suggestion.player_skill}</span> : null}
                      <span className="recommended-match-card__time">
                        {formatLeagueDate(suggestion.match_date, suggestion.timezone)} · {formatLeagueTime(suggestion.match_time, suggestion.timezone)}
                      </span>
                      <span className="recommended-match-card__location">{suggestion.match_location || "Location TBD"}</span>
                      <span className="recommended-match-card__meta">
                        {suggestion.distance_miles !== null && suggestion.distance_miles !== undefined ? `${suggestion.distance_miles} mi` : "Distance TBD"}
                        {suggestion.league_name ? ` • ${suggestion.league_name}` : ""}
                      </span>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="match-needs-empty match-needs-empty--compact">
                  <p>No recommended matches yet.</p>
                </div>
              )}
            </div>

            <div className="match-needs-section">
              <div className="match-needs-section__head">
                <Users size={19} />
                <h2>All players looking for matches</h2>
                <span>{sortedAllMatchNeeds.length} total</span>
              </div>
              <p className="match-needs-results">Showing <strong>{sortedAllMatchNeeds.length}</strong> player{sortedAllMatchNeeds.length === 1 ? "" : "s"}</p>
              {sortedAllMatchNeeds.length ? (
                <div className="all-players-list">
                  {sortedAllMatchNeeds.slice(0, 6).map((need) => (
                    <Link className="player-list-item" to={`/leagues/${need.league_id}`} key={`${need.league_id}-${need.id}`}>
                      <span className="player-list-info">
                        <strong>{need.player_name || "League player"}</strong>
                        {need.player_skill ? <span>TRP {need.player_skill}</span> : null}
                        <small>
                          {formatLeagueDate(need.start_date_time, need.timezone)} · {formatLeagueTime(need.start_date_time, need.timezone)}
                          {" · "}{need.match_location || need.location || need.location_text || "Location TBD"}
                          {need.distance_miles !== null && need.distance_miles !== undefined ? ` · ${need.distance_miles} mi` : ""}
                          {need.league_name ? ` · ${need.league_name}` : ""}
                        </small>
                      </span>
                      <ArrowRight size={18} />
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="match-needs-empty match-needs-empty--compact">
                  <p>No other players have active match requests right now.</p>
                </div>
              )}
            </div>
          </section>
        ) : null}

        {!loading && !error && leagues.length === 0 ? (
          <div className="leagues-page__empty">
            <Trophy size={30} />
            <h2>No leagues yet</h2>
            <p>Your active flex leagues will appear here after a coach or admin adds you.</p>
          </div>
        ) : null}

        <div className="leagues-page__grid">
          {leagues.map((league) => (
            <Link className="league-card" to={`/leagues/${league.id}`} key={league.id}>
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
