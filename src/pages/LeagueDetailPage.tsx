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
  type LeagueStanding,
  acceptLeagueMatchSuggestion,
  createLeagueMatchNeed,
  getLeagueFixtures,
  getLeagueMatchNeeds,
  getLeaguePlayers,
  getLeagueStandings,
} from "../api/leagues";
import MainLayout from "../components/MainLayout";
import { useAuth } from "../context/AuthContext";
import { getStoredAuthToken } from "../services/authToken";

import "./LeaguesPage.css";

type TabKey = "standings" | "players" | "results" | "pending";

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

const getPendingOpponent = (fixture: LeagueFixture, userId?: number | string | null) => {
  if (String(fixture.player1_id) === String(userId)) return fixture.player2_name || "Opponent";
  if (String(fixture.player2_id) === String(userId)) return fixture.player1_name || "Opponent";
  return `${fixture.player1_name || "Player 1"} vs ${fixture.player2_name || "Player 2"}`;
};

const todayInputValue = () => new Date().toISOString().slice(0, 10);

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

  const [activeTab, setActiveTab] = useState<TabKey>("standings");
  const [league, setLeague] = useState<League | null>(null);
  const [standings, setStandings] = useState<LeagueStanding[]>([]);
  const [players, setPlayers] = useState<LeaguePlayer[]>([]);
  const [results, setResults] = useState<LeagueFixture[]>([]);
  const [pending, setPending] = useState<LeagueFixture[]>([]);
  const [matchNeeds, setMatchNeeds] = useState<LeagueMatchNeed[]>([]);
  const [suggestions, setSuggestions] = useState<LeagueMatchSuggestion[]>([]);
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

  const handleSubmitNeed = async () => {
    if (!id) return;
    setNeedSubmitting(true);
    setNeedError(null);
    try {
      const response = await createLeagueMatchNeed({
        leagueId: id,
        token,
        body: {
          date: needDate,
          time: needTime,
          location: needLocation,
          latitude: needLatitude,
          longitude: needLongitude,
          visibility: shareWithLeagueOnly ? "league" : "open",
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Los_Angeles",
        },
      });
      setMatchNeeds((current) => [response.match, ...current]);
      setSuggestions(response.suggestions ?? []);
      setNeedDrawerOpen(false);
      setActiveTab("pending");
    } catch (err) {
      setNeedError(err instanceof Error ? err.message : "Failed to post match need");
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
    try {
      await acceptLeagueMatchSuggestion({ suggestionId, token });
      setSuggestions((current) => current.filter((suggestion) => suggestion.id !== suggestionId));
      setMatchNeeds([]);
      setActiveTab("pending");
    } catch (err) {
      setNeedError(err instanceof Error ? err.message : "Failed to accept suggestion");
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
            <button type="button" onClick={() => setNeedDrawerOpen(true)}>Need a Match</button>
            <button type="button" disabled>Add Score</button>
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

        {loading ? <div className="leagues-page__state">Loading league...</div> : null}
        {error ? <div className="leagues-page__state leagues-page__state--error">{error}</div> : null}

        {!loading && !error && activeTab === "standings" ? (
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

        {!loading && !error && activeTab === "players" ? (
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

        {!loading && !error && activeTab === "results" ? (
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

        {!loading && !error && activeTab === "pending" ? (
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
                <button type="button" disabled={!needDate || !needTime || !needLocation || needSubmitting} onClick={handleSubmitNeed}>
                  {needSubmitting ? "Checking..." : "Next"}
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
