import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowRight, CalendarDays, MapPin, Pin, Star, Users } from "lucide-react";

import {
  getLeagueMatchNeeds,
  isLeagueSlotAvailable,
  type League,
  type LeagueMatchNeed,
  type LeagueMatchSuggestion,
} from "../api/leagues";
import MainLayout from "../components/MainLayout";
import { useAuth } from "../context/AuthContext";
import { getStoredAuthToken } from "../services/authToken";
import { formatLeagueDate as formatDate, formatLeagueTime as formatTime, isFutureLeagueItem as isFutureItem } from "./leagueDetailTime";

import "./LeaguesPage.css";

type NeedSortKey = "recommended" | "distance" | "soonest" | "rating";
type NeedTimeFilter = "any" | "this_week" | "next_week";

const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
const matchNeedsPageSize = 6;

const MatchBrowserPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
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

  const [league, setLeague] = useState<League | null>(null);
  const [myNeeds, setMyNeeds] = useState<LeagueMatchNeed[]>([]);
  const [suggestions, setSuggestions] = useState<LeagueMatchSuggestion[]>([]);
  const [allMatchNeeds, setAllMatchNeeds] = useState<LeagueMatchNeed[]>([]);
  // Filters removed from the UI — the list keeps the default "recommended" order, all times.
  const [needSort] = useState<NeedSortKey>("recommended");
  const [needTimeFilter] = useState<NeedTimeFilter>("any");
  const [needPage, setNeedPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    // The default call returns { league, myNeeds, suggestions }; scope=all returns
    // { league, needs }. Both are needed to populate all three sections.
    Promise.all([
      getLeagueMatchNeeds({ leagueId: id, token, signal: controller.signal }),
      getLeagueMatchNeeds({ leagueId: id, token, scope: "all", signal: controller.signal }),
    ])
      .then(([personal, all]) => {
        if (controller.signal.aborted) return;
        setLeague(personal.league ?? all.league ?? null);
        setMyNeeds(personal.myNeeds ?? []);
        setSuggestions(personal.suggestions ?? []);
        setAllMatchNeeds(all.needs ?? personal.needs ?? []);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Failed to load match browser");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [id, token]);

  const futureMyNeeds = useMemo(() => myNeeds.filter(isFutureItem), [myNeeds]);
  const futureSuggestions = useMemo(() => suggestions.filter(isFutureItem), [suggestions]);
  const visibleMatchNeeds = useMemo(() => [...allMatchNeeds.filter(isFutureItem)].sort((a, b) => {
    if (a.has_played_before !== b.has_played_before) return a.has_played_before ? 1 : -1;
    const aVariance = typeof a.time_variance_minutes === "number" ? a.time_variance_minutes : Number.POSITIVE_INFINITY;
    const bVariance = typeof b.time_variance_minutes === "number" ? b.time_variance_minutes : Number.POSITIVE_INFINITY;
    if (aVariance !== bVariance) return aVariance - bVariance;
    const aDistance = Number(a.distance_miles);
    const bDistance = Number(b.distance_miles);
    const aDistanceValue = Number.isFinite(aDistance) ? aDistance : Number.POSITIVE_INFINITY;
    const bDistanceValue = Number.isFinite(bDistance) ? bDistance : Number.POSITIVE_INFINITY;
    return aDistanceValue - bDistanceValue;
  }), [allMatchNeeds]);

  const filteredMatchNeeds = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const thisWeekEnd = startOfToday + oneWeekMs;
    const nextWeekEnd = startOfToday + (oneWeekMs * 2);
    const filtered = visibleMatchNeeds.filter((need) => {
      if (needTimeFilter === "any") return true;
      const start = need.start_date_time ? new Date(need.start_date_time).getTime() : NaN;
      if (!Number.isFinite(start)) return false;
      if (needTimeFilter === "this_week") return start >= startOfToday && start < thisWeekEnd;
      return start >= thisWeekEnd && start < nextWeekEnd;
    });

    return filtered.sort((a, b) => {
      if (needSort === "soonest") {
        return new Date(a.start_date_time || 0).getTime() - new Date(b.start_date_time || 0).getTime();
      }
      if (needSort === "rating") {
        return Number(b.player_skill || 0) - Number(a.player_skill || 0);
      }
      if (needSort === "distance") {
        const aDistance = Number(a.distance_miles);
        const bDistance = Number(b.distance_miles);
        return (Number.isFinite(aDistance) ? aDistance : Number.POSITIVE_INFINITY) -
          (Number.isFinite(bDistance) ? bDistance : Number.POSITIVE_INFINITY);
      }
      if (a.has_played_before !== b.has_played_before) return a.has_played_before ? 1 : -1;
      const aVariance = typeof a.time_variance_minutes === "number" ? a.time_variance_minutes : Number.POSITIVE_INFINITY;
      const bVariance = typeof b.time_variance_minutes === "number" ? b.time_variance_minutes : Number.POSITIVE_INFINITY;
      if (aVariance !== bVariance) return aVariance - bVariance;
      return Number(a.distance_miles || Number.POSITIVE_INFINITY) - Number(b.distance_miles || Number.POSITIVE_INFINITY);
    });
  }, [needSort, needTimeFilter, visibleMatchNeeds]);

  const totalNeedPages = Math.max(1, Math.ceil(filteredMatchNeeds.length / matchNeedsPageSize));
  const pagedMatchNeeds = filteredMatchNeeds.slice((needPage - 1) * matchNeedsPageSize, needPage * matchNeedsPageSize);

  useEffect(() => {
    setNeedPage(1);
  }, [needSort, needTimeFilter, visibleMatchNeeds.length]);

  useEffect(() => {
    if (needPage > totalNeedPages) setNeedPage(totalNeedPages);
  }, [needPage, totalNeedPages]);

  // "Post yours" opens the multi-slot availability flow; the quick single-slot
  // drawer still lives on LeagueDetailPage's "Need a Match". Connecting hands off
  // to LeagueDetailPage via router state.
  const goPost = () => navigate(`/leagues/${id}/post-availability`);
  const goConnectSuggestion = (suggestionId: number | string) =>
    navigate(`/leagues/${id}`, { state: { acceptSuggestionId: suggestionId } });
  const goConnectNeed = (needId: number | string) =>
    navigate(`/leagues/${id}`, { state: { acceptNeedId: needId } });

  return (
    <MainLayout
      pageClassName="leagues-shell"
      hideMobileNewMatch
      hideMobileLocation
      hideMobileNotifications
      onMobileBack={() => navigate(`/leagues/${id}/dashboard`)}
    >
      <section className="league-detail">
        <Link className="league-detail__back match-browser__back" to={`/leagues/${id}/dashboard`}>
          ← Back to dashboard
        </Link>

        {loading ? <div className="leagues-page__state">Loading match browser...</div> : null}
        {error ? <div className="leagues-page__state leagues-page__state--error">{error}</div> : null}

        {!loading && !error ? (
          <section className="match-needs-browser" aria-label="Match needs browser">
            <div className="match-browser-header">
              <div>
                <h2>Match Browser</h2>
                <p>{league?.name || "Flex League"}</p>
              </div>
              <button type="button" onClick={goPost}>+ Post yours</button>
            </div>

            <div className="match-needs-section">
              <div className="match-needs-section__head">
                <Pin size={19} />
                <h2>My posted availability</h2>
                <span>{futureMyNeeds.length} active</span>
              </div>
              {futureMyNeeds.length ? (
                <div className="my-availability-list">
                  {futureMyNeeds.map((need) => (
                    <article className="my-availability-card" key={need.id}>
                      <strong>{formatDate(need.start_date_time, need.timezone)} · {formatTime(need.start_date_time, need.timezone)}</strong>
                      <p>{need.location_text || need.match_location || need.location || "Location TBD"}</p>
                      <span>Live • {need.league_visibility === "open" ? "Open" : "League only"}</span>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="match-needs-empty">
                  <CalendarDays size={24} />
                  <p>You have not posted availability yet.</p>
                  <button type="button" onClick={goPost}>Post yours</button>
                </div>
              )}
            </div>

            <div className="match-needs-section">
              <div className="match-needs-section__head match-needs-section__head--recommended">
                <Star size={19} />
                <h2>Recommended matches</h2>
                <span>{futureSuggestions.length} perfect fit{futureSuggestions.length === 1 ? "" : "s"}</span>
              </div>
              <p className="match-needs-section__sub">These players are looking at times that match your availability.</p>
              {futureSuggestions.length ? (
                <div className="recommended-grid">
                  {futureSuggestions.map((suggestion) => {
                    const available = isLeagueSlotAvailable(suggestion);
                    return (
                    <button
                      type="button"
                      className="recommended-match-card"
                      key={suggestion.id}
                      disabled={!available}
                      onClick={() => available && goConnectSuggestion(suggestion.id)}
                    >
                      <span className="recommended-match-card__badge">{available ? "Matches your time" : "Full"}</span>
                      <strong>{suggestion.player_name || "League player"}</strong>
                      {suggestion.player_skill ? <span className="recommended-match-card__rating">TRP {suggestion.player_skill}</span> : null}
                      <span className="recommended-match-card__time">
                        {formatDate(suggestion.match_date, suggestion.timezone)} · {formatTime(suggestion.match_time, suggestion.timezone)}
                      </span>
                      <span className="recommended-match-card__location">{suggestion.match_location || "Location TBD"}</span>
                      <span className="recommended-match-card__meta">
                        {suggestion.distance_miles !== null && suggestion.distance_miles !== undefined ? `${suggestion.distance_miles} mi` : "Distance TBD"}
                        {suggestion.has_played_before === false ? " · New opponent" : ""}
                      </span>
                    </button>
                    );
                  })}
                </div>
              ) : (
                <div className="match-needs-empty match-needs-empty--compact">
                  <p>No upcoming matches near your posted availability yet.</p>
                </div>
              )}
            </div>

            <div className="match-needs-section">
              <div className="match-needs-section__head">
                <Users size={19} />
                <h2>All players looking for matches</h2>
                <span>{visibleMatchNeeds.length} total</span>
              </div>
              {filteredMatchNeeds.length ? (
                <div className="all-players-list">
                  {pagedMatchNeeds.map((need) => {
                    const location = need.match_location || need.location || need.location_text || "Location TBD";
                    const available = isLeagueSlotAvailable(need);
                    return (
                      <button
                        type="button"
                        className="player-list-item"
                        key={need.id}
                        disabled={!available}
                        onClick={() => available && goConnectNeed(need.id)}
                      >
                        <span className="player-list-info">
                          <strong>
                            {need.player_name || "League player"}
                            {!available ? <em className="league-full-badge">Full</em> : null}
                          </strong>
                          {need.player_skill ? <span>TRP {need.player_skill}</span> : null}
                          <small>
                            {formatDate(need.start_date_time, need.timezone)} · {formatTime(need.start_date_time, need.timezone)}
                            {" · "}{location}
                            {need.distance_miles !== null && need.distance_miles !== undefined ? ` · ${need.distance_miles} mi` : ""}
                          </small>
                        </span>
                        <ArrowRight size={18} />
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="match-needs-empty match-needs-empty--compact">
                  <MapPin size={22} />
                  <p>No upcoming matches from other players in this league.</p>
                </div>
              )}
              {totalNeedPages > 1 ? (
                <div className="match-needs-pagination" aria-label="Match needs pagination">
                  {Array.from({ length: totalNeedPages }, (_, index) => index + 1).map((page) => (
                    <button
                      type="button"
                      className={page === needPage ? "active" : ""}
                      key={page}
                      onClick={() => setNeedPage(page)}
                    >
                      {page}
                    </button>
                  ))}
                  <button
                    type="button"
                    disabled={needPage >= totalNeedPages}
                    onClick={() => setNeedPage((page) => Math.min(page + 1, totalNeedPages))}
                  >
                    Next →
                  </button>
                </div>
              ) : null}
              <button type="button" className="players-looking__post" onClick={goPost}>
                Post your availability
              </button>
            </div>
          </section>
        ) : null}
      </section>
    </MainLayout>
  );
};

export default MatchBrowserPage;
