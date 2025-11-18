import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { Calendar, Filter, MapPin, MessageCircle, Search, Star, Users } from "lucide-react";
import MainLayout from "../components/MainLayout";
import { colors, typography } from "../lib/theme";
import { extractMatches, getBrowseMatches } from "../api/matches";
import type { MatchApiRecord, MatchEntry, MatchRelationship } from "../types/match";
import { getStoredAuthToken } from "../services/authToken";

import "./BrowseMatchesPage.css";

const distanceOptions = ["3 mi", "5 mi", "10 mi", "15 mi", "All"];
const tabs = ["My Matches", "Hosting", "Open", "Today", "Tomorrow", "Weekend", "Drafts", "Archived"];

const relationshipLabel: Record<string, string> = {
  host: "Hosting",
  participant: "Joined",
};

const parseRelationship = (value: string | undefined): MatchRelationship => {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "host" || normalized === "hosting") return "host";
  if (normalized === "participant" || normalized === "joined" || normalized === "player") return "participant";
  return "viewer";
};

const formatDateLabel = (value?: string | number) => {
  if (!value) return "Schedule to be announced";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  return date.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const pickStartTime = (match: MatchApiRecord) =>
  match.start_date_time ||
  match.startTime ||
  match.start_time ||
  match.start ||
  match.start_date ||
  match.startDate ||
  match.date ||
  match.schedule;

const pickLocation = (match: MatchApiRecord) =>
  match.location_name ||
  match.locationName ||
  match.location ||
  match.venue ||
  match.court ||
  match.address ||
  "Location to be announced";

const formatDistance = (value: MatchApiRecord["distance"]) => {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "number") {
    return `${value.toFixed(1)} miles away`;
  }
  const numeric = Number.parseFloat(value as string);
  if (Number.isFinite(numeric)) {
    return `${numeric.toFixed(1)} miles away`;
  }
  return String(value);
};

const pickDistance = (match: MatchApiRecord) =>
  formatDistance(match.distance ?? match.distance_in_miles ?? match.distance_miles ?? match.distance_mi);

const pickCounts = (match: MatchApiRecord) => {
  const playersJoined =
    match.players_joined ?? match.players_joined_count ?? match.current_players ?? match.joined_players ?? match.joined ?? 0;
  const totalSpots =
    match.totalSpots ??
    match.total_players ??
    match.player_limit ??
    match.capacity ??
    (typeof match.playersNeeded === "number" ? playersJoined + match.playersNeeded : playersJoined);
  const playersNeeded = match.playersNeeded ?? (totalSpots > playersJoined ? totalSpots - playersJoined : 0);
  return { playersJoined, totalSpots: Math.max(totalSpots, playersJoined), playersNeeded };
};

const pickLevel = (match: MatchApiRecord) => {
  const summary =
    match.level_summary ?? match.level ?? match.rating ?? match.suggested_rating ?? match.level_min ?? match.min_level;
  const detail = match.level_detail ?? match.level_max ?? match.max_level;

  if (!summary) return undefined;
  const summaryLabel = typeof summary === "number" ? summary.toFixed(1) : String(summary);
  const detailLabel =
    typeof detail === "number"
      ? `Suggested NTRP ${detail.toFixed(1)}`
      : detail
        ? String(detail)
        : `Suggested NTRP ${summaryLabel}`;
  return { summary: summaryLabel, detail: detailLabel };
};

const normalizeAccess = (value?: string) => {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return "Open";
  if (normalized.startsWith("priv")) return "Private";
  if (normalized.startsWith("open")) return "Open";
  if (normalized.startsWith("host")) return "Private";
  return "Open";
};

const mapMatchToEntry = (match: MatchApiRecord): MatchEntry => {
  const { playersJoined, totalSpots, playersNeeded } = pickCounts(match);
  const access = normalizeAccess(match.access ?? match.access_type ?? match.visibility ?? match.status);
  return {
    id: String(match.id ?? match.match_id ?? crypto.randomUUID()),
    access,
    relationship: parseRelationship(match.relationship ?? match.user_relationship ?? match.user_role ?? match.role),
    startDisplay: formatDateLabel(pickStartTime(match)),
    location: pickLocation(match),
    distance: pickDistance(match),
    playersJoined,
    playersNeeded,
    totalSpots,
    level: pickLevel(match),
  };
};

const BrowseMatchesPage = () => {
  const navigate = useNavigate();
  const [selectedDistance, setSelectedDistance] = useState(distanceOptions[1]);
  const [selectedTab, setSelectedTab] = useState(tabs[0]);
  const [matches, setMatches] = useState<MatchEntry[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const themeVars = useMemo(
    () =>
      ({
        "--matches-distance-bg": colors.filterChipBg,
        "--matches-distance-hover": colors.filterChipHover,
        "--matches-distance-selected-bg": colors.availableBg,
        "--matches-distance-selected-border": colors.primarySuccess,
        "--matches-distance-selected-text": colors.availableText,
        "--matches-text": colors.primaryText,
        "--matches-muted": colors.secondaryText,
        "--matches-border": colors.border,
        "--matches-surface": colors.surface,
        "--matches-success": colors.primarySuccess,
        "--matches-font": typography.fontFamily,
      }) as CSSProperties,
    [],
  );

  const loadMatches = useCallback(
    async (signal?: AbortSignal) => {
      setStatus("loading");
      setError(null);
      try {
        const token = getStoredAuthToken();
        const response = await getBrowseMatches({ token, signal });
        const matchesPayload = extractMatches(response as MatchApiRecord[] | { [key: string]: unknown });
        const normalized = matchesPayload.map((item) => mapMatchToEntry(item as MatchApiRecord));
        setMatches(normalized);
        setStatus("ready");
      } catch (err) {
        if (signal?.aborted) return;
        setStatus("error");
        setError(err instanceof Error ? err.message : "Unable to load matches.");
      }
    },
    [],
  );

  useEffect(() => {
    const controller = new AbortController();
    void loadMatches(controller.signal);
    return () => controller.abort();
  }, [loadMatches]);

  return (
    <MainLayout>
      <div className="matches-page" style={themeVars}>
        <header className="matches-hero">
          <div className="matches-hero__text">
            <h1 className="matches-hero__title">Browse Local Matches</h1>
            <p className="matches-hero__subtitle">See what's nearby and jump back in.</p>
          </div>
          <div className="matches-hero__actions">
            <button
              type="button"
              className="matches-create-btn"
              onClick={() => navigate("/matches/create")}
            >
              + Create Match
            </button>
            <button type="button" className="matches-filter-btn">
              <Filter size={18} aria-hidden="true" />
              Filters
            </button>
          </div>
        </header>

        <section className="location-panel">
          <div className="location-panel__chips" role="group" aria-label="Distance from your current location">
            <button type="button" className="distance-chip distance-chip--location" aria-label="Selected location">
              <MapPin size={16} aria-hidden="true" />
              Franklin Canyon Courts
            </button>
            {distanceOptions.map((option) => (
              <button
                key={option}
                type="button"
                className={`distance-chip${selectedDistance === option ? " selected" : ""}`}
                onClick={() => setSelectedDistance(option)}
                aria-pressed={selectedDistance === option}
              >
                {option}
              </button>
            ))}
          </div>
        </section>

        <section className="matches-main">
          <div className="matches-toolbar">
            <nav className="matches-tabs" aria-label="Match filters">
              {tabs.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  className={`tab${selectedTab === tab ? " active" : ""}`}
                  onClick={() => setSelectedTab(tab)}
                  aria-pressed={selectedTab === tab}
                >
                  {tab}
                </button>
              ))}
            </nav>
            <div className="toolbar-actions">
              <div className="search-field">
                <Search size={16} aria-hidden="true" />
                <input type="search" placeholder="Search matches" aria-label="Search matches" />
              </div>
            </div>
          </div>

          <div className="matches-grid">
            {status !== "ready" ? (
              <div className={`matches-state${status === "error" ? " matches-state--error" : ""}`}>
                <p className="matches-state__title">
                  {status === "loading"
                    ? "Loading matches near you..."
                    : error ?? "We couldn’t load matches right now."}
                </p>
                {status === "error" ? (
                  <button type="button" className="matches-state__action" onClick={() => loadMatches()}>
                    Retry
                  </button>
                ) : null}
              </div>
            ) : matches.length === 0 ? (
              <div className="matches-state">
                <p className="matches-state__title">No matches available right now.</p>
                <p className="matches-state__subtitle">
                  Try adjusting your filters or check back soon to see new sessions near you.
                </p>
              </div>
            ) : (
              matches.map((match) => {
                const isHost = match.relationship === "host";
                const isParticipant = match.relationship === "participant";
                const isFull = match.playersJoined >= match.totalSpots;
                const spotsAvailable = Math.max(match.totalSpots - match.playersJoined, 0);
                const playersNeeded = match.playersNeeded ?? spotsAvailable;
                const availabilityLabel = isFull
                  ? "Match is full"
                  : `${spotsAvailable} spot${spotsAvailable === 1 ? "" : "s"} available`;
                const playersLabel = `${match.playersJoined}/${match.totalSpots} players`;
                const roleLabel = relationshipLabel[match.relationship] ?? null;

                return (
                  <article key={match.id} className="match-card">
                    <header className="match-card__header">
                      <div className="match-pills">
                        <span className={`match-status-pill ${match.access.toLowerCase()}`}>{match.access}</span>
                        {roleLabel ? <span className="match-status-pill subtle">{roleLabel}</span> : null}
                      </div>
                      {!isFull && playersNeeded > 0 ? (
                        <span className="match-needed">{playersNeeded} needed</span>
                      ) : null}
                    </header>

                    <div className="match-card__body">
                      <div className="match-detail">
                        <Calendar size={18} aria-hidden="true" />
                        <p className="match-detail__primary">{match.startDisplay}</p>
                      </div>
                      <div className="match-detail">
                        <MapPin size={18} aria-hidden="true" />
                        <div>
                          <p className="match-detail__primary">{match.location}</p>
                          {match.distance ? <p className="match-detail__secondary">{match.distance}</p> : null}
                        </div>
                      </div>
                      <div className="match-detail">
                        <Users size={18} aria-hidden="true" />
                        <div>
                          <p className="match-detail__primary">{playersLabel}</p>
                          <p className="match-detail__secondary">{availabilityLabel}</p>
                        </div>
                      </div>
                      {match.access === "Open" && match.level ? (
                        <div className="match-detail">
                          <Star size={18} aria-hidden="true" />
                          <div>
                            <p className="match-detail__primary">Skill level: {match.level.summary}</p>
                            {match.level.detail ? (
                              <p className="match-detail__secondary">{match.level.detail}</p>
                            ) : null}
                          </div>
                        </div>
                      ) : null}
                    </div>

                    <footer className="match-card__footer">
                      {isHost ? (
                        <>
                          <button
                            type="button"
                            className="match-action primary"
                            onClick={() => navigate(`/matches/${match.id}`)}
                          >
                            View &amp; manage
                          </button>
                          <button type="button" className="match-action" disabled>
                            <MessageCircle size={16} aria-hidden="true" />
                            Message group
                          </button>
                        </>
                      ) : isParticipant ? (
                        <>
                          <button
                            type="button"
                            className="match-action"
                            onClick={() => navigate(`/matches/${match.id}`)}
                          >
                            View match
                          </button>
                          <button type="button" className="match-action primary">
                            <MessageCircle size={16} aria-hidden="true" />
                            Message group
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          className="match-action primary"
                          onClick={() => navigate(`/matches/${match.id}`)}
                        >
                          View match
                        </button>
                      )}
                    </footer>
                  </article>
                );
              })
            )}
          </div>
        </section>
      </div>
    </MainLayout>
  );
};

export default BrowseMatchesPage;
