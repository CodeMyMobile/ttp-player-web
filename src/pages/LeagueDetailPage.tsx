import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CalendarDays, Mail, Phone, Trophy, Users } from "lucide-react";

import {
  type League,
  type LeagueFixture,
  type LeaguePlayer,
  type LeagueStanding,
  getLeagueFixtures,
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    ])
      .then(([standingsResponse, playersResponse, resultsResponse, pendingResponse]) => {
        setLeague(standingsResponse.league ?? playersResponse.league);
        setStandings(standingsResponse.standings ?? []);
        setPlayers(playersResponse.players ?? []);
        setResults(resultsResponse.fixtures ?? []);
        setPending(pendingResponse.fixtures ?? []);
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
            <button type="button" disabled>Need a Match</button>
            <button type="button" disabled>Add Score</button>
          </div>
        </header>

        {pending.length ? (
          <div className="league-detail__pending-callout">
            <div>
              <strong>You have {pending.length} match{pending.length === 1 ? "" : "es"} to play</strong>
              <span>{pendingSummary}</span>
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
            {pending.map((fixture) => (
              <article className="league-list__item league-list__item--pending" key={fixture.id}>
                <CalendarDays size={16} />
                <div>
                  <h2>{getPendingOpponent(fixture, userId)}</h2>
                  <p>Match #{fixture.match_number ?? fixture.id} · pending score</p>
                </div>
              </article>
            ))}
            {!pending.length ? (
              <div className="league-detail__empty">
                <Users size={20} />
                No pending matches.
              </div>
            ) : null}
          </div>
        ) : null}
      </section>
    </MainLayout>
  );
};

export default LeagueDetailPage;
