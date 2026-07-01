import { useEffect, useMemo, useState } from "react";
import Autocomplete from "react-google-autocomplete";
import { Link, useParams } from "react-router-dom";
import { CalendarDays, Mail, Phone, Trophy, Users, X } from "lucide-react";

import {
  type League,
  type LeagueFixture,
  type LeagueMatchNeed,
  type LeagueMatchSuggestion,
  type LeaguePlayer,
  type LeagueResultOpponent,
  type LeagueStanding,
  acceptLeagueMatchSuggestion,
  acceptLeagueMatchNeedPreview,
  createLeagueResult,
  createLeagueMatchNeed,
  getLeagueFixtures,
  getLeagueMatchNeeds,
  getLeaguePlayers,
  getLeagueResultOpponents,
  getLeagueStandings,
  previewLeagueMatchNeed,
  sendLeagueMatchNeedInvites,
} from "../api/leagues";
import MainLayout from "../components/MainLayout";
import { useAuth } from "../context/AuthContext";
import { getStoredAuthToken } from "../services/authToken";

import "./LeaguesPage.css";

type TabKey = "standings" | "players" | "results" | "pending";
type NeedFlowStep = "idle" | "precheck" | "accept" | "invite";

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: "standings", label: "Standings" },
  { key: "players", label: "Players" },
  { key: "results", label: "Results" },
  { key: "pending", label: "Pending" },
];

const displayValue = (value: unknown) => {
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
};

const formatDate = (value?: string | null) => {
  if (!value) return "Date TBD";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

const formatTime = (value?: string | null) => {
  if (!value) return "Time TBD";
  const date = value.includes("T") ? new Date(value) : new Date(`2000-01-01T${value}`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
};

const formatNeedSummary = (need?: LeagueMatchNeed | null) => {
  if (!need) return "Match need";
  const date = formatDate(need.start_date_time);
  const time = formatTime(need.start_date_time);
  return `${date} · ${time} · ${need.location_text || "Location TBD"}`;
};

const getPendingOpponent = (fixture: LeagueFixture, userId?: number | string | null) => {
  if (String(fixture.player1_id) === String(userId)) return fixture.player2_name || "Opponent";
  if (String(fixture.player2_id) === String(userId)) return fixture.player1_name || "Opponent";
  return `${fixture.player1_name || "Player 1"} vs ${fixture.player2_name || "Player 2"}`;
};

const todayInputValue = () => new Date().toISOString().slice(0, 10);
const inviteMessageMaxLength = 160;

const buildInviteMessage = (need: LeagueMatchNeed | null, fallbackLocation: string) => {
  const location = need?.location_text || fallbackLocation;
  const message = `Hey, I'm looking for a match on ${formatDate(need?.start_date_time)} at ${formatTime(need?.start_date_time)} at ${location}. Let me know if you're interested!`;
  return message.length <= inviteMessageMaxLength ? message : `${message.slice(0, inviteMessageMaxLength - 3).trim()}...`;
};

const normalizeIdentity = (value: unknown) => String(value ?? "").trim().toLowerCase();

const LeagueDetailPage = () => {
  const { id } = useParams();
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
  const userId = user?.id ?? user?.user_id ?? user?.player_id ?? user?.profile?.id ?? user?.profile?.user_id;
  const currentUserIdentities = useMemo(() => new Set([
    normalizeIdentity(userId),
    normalizeIdentity(user?.email),
    normalizeIdentity(user?.profile?.email),
    normalizeIdentity(user?.full_name),
    normalizeIdentity(user?.profile?.full_name),
    normalizeIdentity(user?.name),
  ].filter(Boolean)), [user, userId]);

  const [activeTab, setActiveTab] = useState<TabKey>("standings");
  const [league, setLeague] = useState<League | null>(null);
  const [standings, setStandings] = useState<LeagueStanding[]>([]);
  const [players, setPlayers] = useState<LeaguePlayer[]>([]);
  const [results, setResults] = useState<LeagueFixture[]>([]);
  const [pending, setPending] = useState<LeagueFixture[]>([]);
  const [matchNeeds, setMatchNeeds] = useState<LeagueMatchNeed[]>([]);
  const [suggestions, setSuggestions] = useState<LeagueMatchSuggestion[]>([]);
  const [needFlowStep, setNeedFlowStep] = useState<NeedFlowStep>("idle");
  const [postedNeed, setPostedNeed] = useState<LeagueMatchNeed | null>(null);
  const [selectedSuggestionId, setSelectedSuggestionId] = useState<number | string | null>(null);
  const [acceptMessage, setAcceptMessage] = useState("");
  const [inviteMessage, setInviteMessage] = useState("");
  const [selectedInviteIds, setSelectedInviteIds] = useState<Array<number | string>>([]);
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isNeedDrawerOpen, setNeedDrawerOpen] = useState(false);
  const [needDate, setNeedDate] = useState(todayInputValue);
  const [needTime, setNeedTime] = useState("");
  const [needLocation, setNeedLocation] = useState("Penmar Courts");
  const [needLatitude, setNeedLatitude] = useState<number | null>(null);
  const [needLongitude, setNeedLongitude] = useState<number | null>(null);
  const [shareWithLeagueOnly, setShareWithLeagueOnly] = useState(true);
  const [needSubmitting, setNeedSubmitting] = useState(false);
  const [needError, setNeedError] = useState<string | null>(null);
  const [isScoreDrawerOpen, setScoreDrawerOpen] = useState(false);
  const [resultOpponents, setResultOpponents] = useState<LeagueResultOpponent[]>([]);
  const [scoreOpponentId, setScoreOpponentId] = useState("");
  const [scoreDate, setScoreDate] = useState(todayInputValue);
  const [scoreFormat, setScoreFormat] = useState<"single" | "bo3">("single");
  const [scoreLocation, setScoreLocation] = useState("Penmar Courts");
  const [scoreLatitude, setScoreLatitude] = useState<number | null>(null);
  const [scoreLongitude, setScoreLongitude] = useState<number | null>(null);
  const [scoreSets, setScoreSets] = useState([
    { kind: "set" as const, you: 0, opp: 0 },
    { kind: "set" as const, you: 0, opp: 0 },
    { kind: "set" as const, you: 0, opp: 0 },
  ]);
  const [scoreSubmitting, setScoreSubmitting] = useState(false);
  const [scoreError, setScoreError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    Promise.all([
      getLeagueStandings({ leagueId: id, token, signal: controller.signal }),
      getLeaguePlayers({ leagueId: id, token, signal: controller.signal }),
      getLeagueFixtures({ leagueId: id, token, status: "confirmed", signal: controller.signal }),
      getLeagueFixtures({ leagueId: id, token, status: "scheduled", mine: true, signal: controller.signal }),
      getLeagueMatchNeeds({ leagueId: id, token, signal: controller.signal }),
    ])
      .then(([standingsResponse, playersResponse, resultsResponse, pendingResponse, needsResponse]) => {
        setLeague(standingsResponse.league ?? playersResponse.league);
        setStandings(standingsResponse.standings ?? []);
        setPlayers(playersResponse.players ?? []);
        setResults(resultsResponse.fixtures ?? []);
        setPending(pendingResponse.fixtures ?? []);
        setMatchNeeds(needsResponse.myNeeds ?? []);
        setSuggestions(needsResponse.suggestions ?? []);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Failed to load league");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [id, token]);

  const pendingSummary = pending.slice(0, 2).map((fixture) => getPendingOpponent(fixture, userId)).join(" · ");
  const pendingCount = pending.length + matchNeeds.length;
  const selectedSuggestion = suggestions.find((suggestion) => suggestion.id === selectedSuggestionId) ?? suggestions[0];
  const invitePlayers = players.filter((player) => {
    const playerIdentities = [
      normalizeIdentity(player.player_id),
      normalizeIdentity(player.email),
      normalizeIdentity(player.full_name),
    ].filter(Boolean);
    return !playerIdentities.some((identity) => currentUserIdentities.has(identity));
  });
  const showNeedFlow = !loading && !error && needFlowStep !== "idle";

  const openNeedDrawer = () => {
    setNeedDrawerOpen(true);
    setNeedError(null);
  };

  const returnToNeedForm = () => {
    setNeedFlowStep("idle");
    setNeedDrawerOpen(true);
    setNeedError(null);
  };

  const buildNeedPayload = () => {
    return {
      date: needDate,
      time: needTime,
      location: needLocation,
      latitude: needLatitude,
      longitude: needLongitude,
      visibility: shareWithLeagueOnly ? "league" as const : "open" as const,
      timezone: "America/Los_Angeles",
    };
  };

  const handlePreviewNeed = async () => {
    if (!id) return;
    setNeedSubmitting(true);
    setNeedError(null);
    setPostedNeed(null);
    try {
      const response = await previewLeagueMatchNeed({
        leagueId: id,
        token,
        body: buildNeedPayload(),
      });
      const nextSuggestions = response.suggestions ?? [];
      setPostedNeed(response.draft);
      setSuggestions(nextSuggestions);
      setSelectedSuggestionId(nextSuggestions[0]?.id ?? null);
      setAcceptMessage("");
      setNeedDrawerOpen(false);
      setNeedFlowStep("precheck");
    } catch (err) {
      setNeedError(err instanceof Error ? err.message : "Failed to check existing matches");
    } finally {
      setNeedSubmitting(false);
    }
  };

  const handleNeedPlaceSelected = (place: google.maps.places.PlaceResult | null) => {
    const latitude = place?.geometry?.location?.lat?.();
    const longitude = place?.geometry?.location?.lng?.();
    const label = place?.formatted_address || place?.name || needLocation;

    if (label) setNeedLocation(label);
    if (typeof latitude === "number" && Number.isFinite(latitude)) setNeedLatitude(latitude);
    if (typeof longitude === "number" && Number.isFinite(longitude)) setNeedLongitude(longitude);
  };

  const handleAcceptSuggestion = async (suggestionId: number | string) => {
    setNeedSubmitting(true);
    setNeedError(null);
    try {
      const suggestion = suggestions.find((item) => String(item.id) === String(suggestionId));
      if (postedNeed?.id && !String(suggestionId).startsWith("preview-")) {
        await acceptLeagueMatchSuggestion({ suggestionId, token });
      } else if (id && suggestion?.suggested_match_id) {
        await acceptLeagueMatchNeedPreview({
          leagueId: id,
          suggestedMatchId: suggestion.suggested_match_id,
          token,
          message: acceptMessage,
        });
      } else {
        throw new Error("Missing match suggestion");
      }
      setSuggestions((current) => current.filter((item) => item.id !== suggestionId));
      if (postedNeed?.id) {
        setMatchNeeds((current) => current.filter((need) => String(need.id) !== String(postedNeed.id)));
      }
      setPostedNeed(null);
      setNeedFlowStep("idle");
      setActiveTab("pending");
    } catch (err) {
      setNeedError(err instanceof Error ? err.message : "Failed to accept suggestion");
    } finally {
      setNeedSubmitting(false);
    }
  };

  const handlePostAnyway = async () => {
    if (!id) return;
    setNeedSubmitting(true);
    setInviteError(null);
    setNeedError(null);
    try {
      const response = await createLeagueMatchNeed({
        leagueId: id,
        token,
        body: buildNeedPayload(),
      });
      setPostedNeed(response.match);
      setMatchNeeds((current) => [response.match, ...current]);
      setSelectedInviteIds(invitePlayers.slice(0, 1).map((player) => player.player_id));
      setInviteMessage(buildInviteMessage(response.match, needLocation));
      setNeedFlowStep("invite");
    } catch (err) {
      setNeedError(err instanceof Error ? err.message : "Failed to post match need");
    } finally {
      setNeedSubmitting(false);
    }
  };

  const handleSendInvites = async () => {
    if (!id || !postedNeed) return;
    if (inviteMessage.length > inviteMessageMaxLength) {
      setInviteError(`Message must be ${inviteMessageMaxLength} characters or fewer.`);
      return;
    }
    setInviteSubmitting(true);
    setInviteError(null);
    try {
      await sendLeagueMatchNeedInvites({
        leagueId: id,
        matchId: postedNeed.id,
        token,
        body: {
          player_ids: selectedInviteIds,
          message: inviteMessage,
        },
      });
      setNeedFlowStep("idle");
      setActiveTab("pending");
    } catch (err) {
      const data = (err as { data?: { error?: string; maxLength?: number } })?.data;
      if (data?.error === "message_too_long") {
        setInviteError(`Message must be ${data.maxLength || inviteMessageMaxLength} characters or fewer.`);
      } else if (data?.error === "no_invitees") {
        setInviteError("Choose at least one league player to invite.");
      } else {
        setInviteError(err instanceof Error ? err.message : "Failed to send invites");
      }
    } finally {
      setInviteSubmitting(false);
    }
  };

  const openScoreDrawer = async () => {
    if (!id) return;
    setScoreDrawerOpen(true);
    setScoreError(null);
    try {
      const response = await getLeagueResultOpponents({ leagueId: id, token });
      const opponents = response.opponents ?? [];
      setResultOpponents(opponents);
      setScoreOpponentId(opponents[0]?.player_id ? String(opponents[0].player_id) : "");
    } catch (err) {
      setScoreError(err instanceof Error ? err.message : "Failed to load league opponents");
      setResultOpponents([]);
    }
  };

  const handleScorePlaceSelected = (place: google.maps.places.PlaceResult | null) => {
    const latitude = place?.geometry?.location?.lat?.();
    const longitude = place?.geometry?.location?.lng?.();
    const label = place?.formatted_address || place?.name || scoreLocation;

    if (label) setScoreLocation(label);
    if (typeof latitude === "number" && Number.isFinite(latitude)) setScoreLatitude(latitude);
    if (typeof longitude === "number" && Number.isFinite(longitude)) setScoreLongitude(longitude);
  };

  const updateScoreSet = (index: number, side: "you" | "opp", value: string) => {
    const nextValue = Math.max(0, Number.parseInt(value || "0", 10) || 0);
    setScoreSets((current) => current.map((set, setIndex) => (
      setIndex === index ? { ...set, [side]: nextValue } : set
    )));
  };

  const buildScoreString = (sets: typeof scoreSets) => (
    sets
      .filter((set) => set.you !== 0 || set.opp !== 0)
      .map((set) => `${set.you}-${set.opp}`)
      .join(" ")
  );

  const handleSubmitScore = async () => {
    if (!id || !scoreOpponentId) return;
    setScoreSubmitting(true);
    setScoreError(null);
    try {
      const activeSets = scoreSets
        .slice(0, scoreFormat === "single" ? 1 : 3)
        .filter((set) => set.you !== 0 || set.opp !== 0);
      await createLeagueResult({
        leagueId: id,
        token,
        body: {
          player_b: scoreOpponentId,
          played_at: scoreDate,
          location: scoreLocation,
          latitude: scoreLatitude,
          longitude: scoreLongitude,
          format: scoreFormat,
          retired: false,
          sets: activeSets,
          score_string: buildScoreString(activeSets),
        },
      });
      setScoreDrawerOpen(false);
      setActiveTab("results");
    } catch (err) {
      const data = (err as { data?: { errors?: string[] } })?.data;
      setScoreError(data?.errors?.join(", ") || (err instanceof Error ? err.message : "Failed to submit score"));
    } finally {
      setScoreSubmitting(false);
    }
  };

  return (
    <MainLayout pageClassName="leagues-shell" hideMobileNewMatch>
      <section className="league-detail">
        <Link className="league-detail__back" to="/leagues">Back to leagues</Link>
        <header className="league-detail__header">
          <div>
            <p className="leagues-page__eyebrow">Flex league</p>
            <h1>{league?.name || "League"}</h1>
            <p>{players.length ? `${players.length} active players` : "League details"}</p>
          </div>
          <div className="league-detail__actions">
            <button type="button" onClick={openNeedDrawer}>Need a Match</button>
            <button type="button" onClick={openScoreDrawer}>Add Score</button>
          </div>
        </header>

        {pendingCount ? (
          <div className="league-detail__pending-callout">
            <div>
              <strong>You have {pendingCount} match{pendingCount === 1 ? "" : "es"} to play</strong>
              <span>{pendingSummary || `${matchNeeds.length} open match need${matchNeeds.length === 1 ? "" : "s"}`}</span>
            </div>
            <button type="button" onClick={() => setActiveTab("pending")}>View</button>
          </div>
        ) : null}

        {!showNeedFlow ? (
          <nav className="league-detail__tabs" aria-label="League detail tabs">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={activeTab === tab.key ? "active" : ""}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        ) : null}

        {loading ? <div className="leagues-page__state">Loading league...</div> : null}
        {error ? <div className="leagues-page__state leagues-page__state--error">{error}</div> : null}

        {showNeedFlow && needFlowStep === "precheck" ? (
          <div className="league-need-flow">
            <header className="league-need-flow__header">
              <h2>{suggestions.length ? "Wait!" : "Review match need"}</h2>
              <p>
                {suggestions.length
                  ? `${suggestions.length} player${suggestions.length === 1 ? "" : "s"} already looking near this time`
                  : "No close matches found. Review before posting."}
              </p>
            </header>

            <section className="league-need-flow__summary">
              <span>Your match need:</span>
              <strong>{formatDate(postedNeed?.start_date_time)}</strong>
              <p>{formatTime(postedNeed?.start_date_time)} · {postedNeed?.location_text || "Location TBD"}</p>
            </section>

            <section className="league-need-flow__section">
              <h3>Suggested matches:</h3>
              {suggestions.map((suggestion) => {
                const isSelected = String(suggestion.id) === String(selectedSuggestion?.id);
                return (
                  <button
                    className={`league-need-suggestion${isSelected ? " active" : ""}`}
                    key={suggestion.id}
                    type="button"
                    onClick={() => setSelectedSuggestionId(suggestion.id)}
                  >
                    <strong>{suggestion.player_name || "League player"}</strong>
                    <span>
                      {suggestion.time_variance_minutes !== undefined ? `${suggestion.time_variance_minutes} min apart` : "Similar time"}
                      {suggestion.distance_miles !== null && suggestion.distance_miles !== undefined ? ` · ${suggestion.distance_miles} mi` : ""}
                    </span>
                  </button>
                );
              })}
              {!suggestions.length ? <div className="league-detail__empty">No matching open needs within 4 hours and 5 miles.</div> : null}
            </section>

            {needError ? <p className="league-need-error">{needError}</p> : null}

            <div className="league-need-flow__actions league-need-flow__actions--stacked">
              <div>
                <button type="button" onClick={returnToNeedForm}>Back</button>
                <button type="button" disabled={!selectedSuggestion} onClick={() => setNeedFlowStep("accept")}>
                  View & Connect
                </button>
              </div>
              <button
                type="button"
                className="league-need-flow__outline"
                disabled={needSubmitting}
                onClick={handlePostAnyway}
              >
                {needSubmitting ? "Posting..." : suggestions.length ? "Post Anyway" : "Post Match Need"}
              </button>
            </div>
          </div>
        ) : null}

        {showNeedFlow && needFlowStep === "accept" && selectedSuggestion ? (
          <div className="league-need-flow">
            <header className="league-need-flow__header">
              <h2>Accept Match</h2>
              <p>Connect with {selectedSuggestion.player_name || "league player"}</p>
            </header>

            <section className="league-need-flow__summary">
              <span>League:</span>
              <strong>{league?.name || "League"}</strong>
            </section>
            <section className="league-need-flow__summary">
              <span>Your match:</span>
              <strong>{formatDate(postedNeed?.start_date_time)}</strong>
              <p>{formatTime(postedNeed?.start_date_time)} · {postedNeed?.location_text || "Location TBD"}</p>
            </section>
            <section className="league-need-flow__summary">
              <span>Opponent:</span>
              <strong>{selectedSuggestion.player_name || "League player"}</strong>
              <p>
                {selectedSuggestion.player_skill ? `TRP ${selectedSuggestion.player_skill}` : "League player"}
                {selectedSuggestion.has_played_before ? " · Played before" : ""}
              </p>
            </section>

            <label className="league-need-field">
              <span>Optional message (160 char)</span>
              <textarea
                maxLength={160}
                value={acceptMessage}
                placeholder={`Hey ${selectedSuggestion.player_name || "there"}, excited to play!`}
                onChange={(event) => setAcceptMessage(event.target.value)}
              />
            </label>

            {needError ? <p className="league-need-error">{needError}</p> : null}

            <div className="league-need-flow__actions">
              <button type="button" onClick={() => setNeedFlowStep("precheck")}>Back</button>
              <button type="button" disabled={needSubmitting} onClick={() => handleAcceptSuggestion(selectedSuggestion.id)}>
                {needSubmitting ? "Accepting..." : "Accept"}
              </button>
            </div>
          </div>
        ) : null}

        {showNeedFlow && needFlowStep === "invite" ? (
          <div className="league-need-flow">
            <header className="league-need-flow__header">
              <h2>Invite Players</h2>
              <p>Post your match need</p>
            </header>

            <div className="league-need-flow__success">
              <strong>Match need posted</strong>
              <span>{formatNeedSummary(postedNeed)}</span>
            </div>

            <section className="league-need-flow__section">
              <h3>Still need to play (unplayed):</h3>
              {invitePlayers.map((player) => {
                const isChecked = selectedInviteIds.some((idValue) => String(idValue) === String(player.player_id));
                return (
                  <label className="league-need-invitee" key={player.player_id}>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(event) => {
                        setSelectedInviteIds((current) => (
                          event.target.checked
                            ? [...current, player.player_id]
                            : current.filter((idValue) => String(idValue) !== String(player.player_id))
                        ));
                      }}
                    />
                    <span>{player.full_name || `Player ${player.player_id}`}</span>
                  </label>
                );
              })}
              {!invitePlayers.length ? <div className="league-detail__empty">No league players available to invite.</div> : null}
            </section>

            <label className="league-need-field">
              <span>Message template</span>
              <textarea
                maxLength={inviteMessageMaxLength}
                value={inviteMessage}
                onChange={(event) => setInviteMessage(event.target.value)}
              />
            </label>
            <p className="league-need-tip">{inviteMessage.length}/{inviteMessageMaxLength} characters</p>
            {inviteError ? <p className="league-need-error">{inviteError}</p> : null}

            <div className="league-need-flow__actions">
              <button type="button" onClick={() => (suggestions.length ? setNeedFlowStep("precheck") : setNeedFlowStep("idle"))}>Back</button>
              <button
                type="button"
                disabled={!selectedInviteIds.length || inviteSubmitting}
                onClick={handleSendInvites}
              >
                {inviteSubmitting ? "Sending..." : "Send Invites"}
              </button>
            </div>
          </div>
        ) : null}

        {!showNeedFlow && !loading && !error && activeTab === "standings" ? (
          <div className="league-table-wrap">
            <table className="league-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Player</th>
                  <th>MP</th>
                  <th>W-L</th>
                  <th>GD</th>
                  <th>GW</th>
                  <th>GL</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((row) => (
                  <tr key={row.player_id}>
                    <td>{row.rank}</td>
                    <td>{displayValue(row.full_name)}</td>
                    <td>{row.matches_played}</td>
                    <td>{row.wins}-{row.losses}</td>
                    <td>{row.game_differential}</td>
                    <td>{row.games_for}</td>
                    <td>{row.games_against}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!standings.length ? <div className="league-detail__empty">No standings yet.</div> : null}
          </div>
        ) : null}

        {!showNeedFlow && !loading && !error && activeTab === "players" ? (
          <div className="league-table-wrap">
            <table className="league-table league-table--players">
              <thead>
                <tr>
                  <th>Player</th>
                  <th>TRP</th>
                  <th>NTRP</th>
                  <th>UTR</th>
                  <th>Contact</th>
                </tr>
              </thead>
              <tbody>
                {players.map((player) => (
                  <tr key={player.player_id}>
                    <td>{displayValue(player.full_name)}</td>
                    <td className="league-table__rating">{displayValue(player.current_rating)}</td>
                    <td>{displayValue(player.usta_rating)}</td>
                    <td>{displayValue(player.uta_rating)}</td>
                    <td>
                      <div className="league-contact">
                        {player.phone ? <a href={`tel:${player.phone}`}><Phone size={13} />{player.phone}</a> : null}
                        {player.email ? <a href={`mailto:${player.email}`}><Mail size={13} />{player.email}</a> : null}
                        {!player.phone && !player.email ? "-" : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!players.length ? <div className="league-detail__empty">No active players yet.</div> : null}
          </div>
        ) : null}

        {!showNeedFlow && !loading && !error && activeTab === "results" ? (
          <div className="league-list">
            {results.map((fixture) => (
              <article className="league-list__item" key={fixture.id}>
                <Trophy size={16} />
                <div>
                  <h2>{fixture.player1_name || "Player 1"} vs {fixture.player2_name || "Player 2"}</h2>
                  <p>{displayValue(fixture.score)} · {formatDate(fixture.played_date)}</p>
                </div>
              </article>
            ))}
            {!results.length ? <div className="league-detail__empty">No results posted yet.</div> : null}
          </div>
        ) : null}

        {!showNeedFlow && !loading && !error && activeTab === "pending" ? (
          <div className="league-list">
            {suggestions.map((suggestion) => (
              <article className="league-list__item league-list__item--suggestion" key={suggestion.id}>
                <Trophy size={16} />
                <div>
                  <h2>{suggestion.player_name || "League player"} wants to play</h2>
                  <p>
                    {suggestion.match_date || "Date TBD"} · {suggestion.match_time || "Time TBD"} · {suggestion.match_location || "Location TBD"}
                    {suggestion.time_variance_minutes !== undefined ? ` · ${suggestion.time_variance_minutes} min apart` : ""}
                  </p>
                  <button type="button" onClick={() => handleAcceptSuggestion(suggestion.id)}>
                    Accept match
                  </button>
                </div>
              </article>
            ))}
            {matchNeeds.map((need) => (
              <article className="league-list__item league-list__item--pending" key={need.id}>
                <CalendarDays size={16} />
                <div>
                  <h2>Open match need</h2>
                  <p>
                    {formatDate(need.start_date_time)} · {need.location_text || "Location TBD"} · {need.league_visibility === "open" ? "Open visibility" : "League only"}
                  </p>
                </div>
              </article>
            ))}
            {pending.map((fixture) => (
              <article className="league-list__item league-list__item--pending" key={fixture.id}>
                <CalendarDays size={16} />
                <div>
                  <h2>{getPendingOpponent(fixture, userId)}</h2>
                  <p>Match #{fixture.match_number ?? fixture.id} · pending score</p>
                </div>
              </article>
            ))}
            {!pending.length && !matchNeeds.length && !suggestions.length ? (
              <div className="league-detail__empty">
                <Users size={20} />
                No pending matches.
              </div>
            ) : null}
          </div>
        ) : null}

        {isNeedDrawerOpen ? (
          <div className="league-need-drawer" role="dialog" aria-modal="true" aria-label="Need a match">
            <div className="league-need-drawer__backdrop" onClick={() => setNeedDrawerOpen(false)} />
            <div className="league-need-drawer__panel">
              <div className="league-need-drawer__header">
                <div>
                  <h2>Need a match?</h2>
                  <p>Post your availability and find opponents</p>
                </div>
                <button type="button" aria-label="Close" onClick={() => setNeedDrawerOpen(false)}>
                  <X size={20} />
                </button>
              </div>

              <label className="league-need-field">
                <span>Date</span>
                <input type="date" value={needDate} onChange={(event) => setNeedDate(event.target.value)} />
              </label>
              <label className="league-need-field">
                <span>Time</span>
                <input type="time" value={needTime} onChange={(event) => setNeedTime(event.target.value)} />
              </label>
              <label className="league-need-field">
                <span>Location</span>
                <Autocomplete
                  apiKey={import.meta.env.VITE_GOOGLE_API_KEY || undefined}
                  placeholder="Search court or address"
                  value={needLocation}
                  onChange={(event) => {
                    setNeedLocation(event.target.value);
                    setNeedLatitude(null);
                    setNeedLongitude(null);
                  }}
                  onPlaceSelected={handleNeedPlaceSelected}
                  options={{
                    types: ["geocode", "establishment"],
                    fields: ["formatted_address", "geometry", "name", "address_components"],
                    componentRestrictions: { country: "us" },
                  }}
                />
              </label>
              <label className="league-need-check">
                <input
                  type="checkbox"
                  checked={shareWithLeagueOnly}
                  onChange={(event) => setShareWithLeagueOnly(event.target.checked)}
                />
                <span>Share with league members only</span>
              </label>

              {needError ? <p className="league-need-error">{needError}</p> : null}
              {!import.meta.env.VITE_GOOGLE_API_KEY ? (
                <p className="league-need-tip">Add `VITE_GOOGLE_API_KEY` to enable Google location suggestions.</p>
              ) : null}
              <p className="league-need-tip">We'll check for existing matches before posting.</p>

              <div className="league-need-drawer__actions">
                <button type="button" onClick={() => setNeedDrawerOpen(false)}>Cancel</button>
                <button type="button" disabled={!needDate || !needTime || !needLocation || needSubmitting} onClick={handlePreviewNeed}>
                  {needSubmitting ? "Checking..." : "Next"}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {isScoreDrawerOpen ? (
          <div className="league-need-drawer" role="dialog" aria-modal="true" aria-label="Add score">
            <div className="league-need-drawer__backdrop" onClick={() => setScoreDrawerOpen(false)} />
            <div className="league-need-drawer__panel">
              <div className="league-need-drawer__header">
                <div>
                  <h2>Add score</h2>
                  <p>Submit a league result for opponent confirmation</p>
                </div>
                <button type="button" aria-label="Close" onClick={() => setScoreDrawerOpen(false)}>
                  <X size={20} />
                </button>
              </div>

              <label className="league-need-field">
                <span>Opponent</span>
                <select value={scoreOpponentId} onChange={(event) => setScoreOpponentId(event.target.value)}>
                  {resultOpponents.map((opponent) => (
                    <option key={opponent.player_id} value={opponent.player_id}>
                      {opponent.full_name || `Player ${opponent.player_id}`}
                    </option>
                  ))}
                </select>
              </label>
              <label className="league-need-field">
                <span>Date played</span>
                <input type="date" value={scoreDate} onChange={(event) => setScoreDate(event.target.value)} />
              </label>
              <label className="league-need-field">
                <span>Location</span>
                <Autocomplete
                  apiKey={import.meta.env.VITE_GOOGLE_API_KEY || undefined}
                  placeholder="Search court or address"
                  value={scoreLocation}
                  onChange={(event) => {
                    setScoreLocation(event.target.value);
                    setScoreLatitude(null);
                    setScoreLongitude(null);
                  }}
                  onPlaceSelected={handleScorePlaceSelected}
                  options={{
                    types: ["geocode", "establishment"],
                    fields: ["formatted_address", "geometry", "name", "address_components"],
                    componentRestrictions: { country: "us" },
                  }}
                />
              </label>

              <div className="league-score-format">
                <button
                  type="button"
                  className={scoreFormat === "single" ? "active" : ""}
                  onClick={() => setScoreFormat("single")}
                >
                  1 set
                </button>
                <button
                  type="button"
                  className={scoreFormat === "bo3" ? "active" : ""}
                  onClick={() => setScoreFormat("bo3")}
                >
                  Best of 3
                </button>
              </div>

              {scoreSets.slice(0, scoreFormat === "single" ? 1 : 3).map((set, index) => (
                <div className="league-score-set" key={index}>
                  <h3>Set {index + 1}</h3>
                  <label>
                    <span>You</span>
                    <input
                      type="number"
                      min="0"
                      value={set.you}
                      onChange={(event) => updateScoreSet(index, "you", event.target.value)}
                    />
                  </label>
                  <label>
                    <span>Opponent</span>
                    <input
                      type="number"
                      min="0"
                      value={set.opp}
                      onChange={(event) => updateScoreSet(index, "opp", event.target.value)}
                    />
                  </label>
                </div>
              ))}

              {scoreError ? <p className="league-need-error">{scoreError}</p> : null}
              {!resultOpponents.length ? (
                <p className="league-need-tip">No available league opponents. Players already recorded against you are filtered out.</p>
              ) : (
                <p className="league-need-tip">Opponent receives a confirmation message before result counts.</p>
              )}

              <div className="league-need-drawer__actions">
                <button type="button" onClick={() => setScoreDrawerOpen(false)}>Cancel</button>
                <button
                  type="button"
                  disabled={!scoreOpponentId || !scoreDate || !scoreLocation || scoreSubmitting}
                  onClick={handleSubmitScore}
                >
                  {scoreSubmitting ? "Submitting..." : "Submit score"}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </section>
    </MainLayout>
  );
};

export default LeagueDetailPage;
