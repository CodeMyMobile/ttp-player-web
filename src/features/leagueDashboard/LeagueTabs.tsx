// Standings / Players / Results / Pending tabs.
//
// Controlled by the page (so the pending banner's "View" can jump here).
//  - Standings: rank-movement ▲/▼ + streak flame, viewer row highlighted, legend.
//  - Players: colored record + contact quick-action.
//  - Results: winner in bold (no colour badge).
//  - Pending: dashed rows + Schedule action.
//
// W–L colour rule (standings + players): GREEN when wins>losses, RED when
// losses>wins, neutral otherwise.

import Icon from "./Icon";
import type { LeagueData, StandingRow, TabKey } from "./types";

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: "standings", label: "Standings" },
  { key: "players", label: "Players" },
  { key: "results", label: "Results" },
  { key: "pending", label: "Pending" },
];

const recordClass = (wins: number, losses: number): string =>
  wins > losses ? "rec-w" : losses > wins ? "rec-l" : "rec-0";

// Rank-movement / streak cell for a standings row.
const TrendCell = ({ row }: { row: StandingRow }) => {
  if (row.streak) {
    return (
      <span className="trend flat">
        <Icon name="flame" className="flame" />
        {row.streak}
      </span>
    );
  }
  if (row.trend.dir === "up") {
    return <span className="trend up">▲{row.trend.value}</span>;
  }
  if (row.trend.dir === "down") {
    return <span className="trend down">▼{row.trend.value}</span>;
  }
  if (row.trend.value !== undefined) {
    return <span className="trend flat">{row.trend.value}</span>;
  }
  return <span className="trend flat">–</span>;
};

interface LeagueTabsProps {
  data: LeagueData;
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  onSchedule: (pendingId: string) => void;
}

// A roster player's contact string is a phone or email — link out accordingly.
const contactHref = (contact: string) =>
  contact.includes("@") ? `mailto:${contact}` : `sms:${contact.replace(/[^\d+]/g, "")}`;

const LeagueTabs = ({ data, activeTab, onTabChange, onSchedule }: LeagueTabsProps) => (
  <>
    <div className="tabs" role="tablist" aria-label="League detail">
      {TABS.map((tab) => (
        <button
          key={tab.key}
          type="button"
          role="tab"
          aria-selected={activeTab === tab.key}
          className={`tab${activeTab === tab.key ? " on" : ""}`}
          onClick={() => onTabChange(tab.key)}
        >
          {tab.label}
        </button>
      ))}
    </div>

    {activeTab === "standings" ? (
      <section className="panel card">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th className="rk">#</th>
                <th>Player</th>
                <th className="num">MP</th>
                <th className="num">W–L</th>
                <th className="num">GD</th>
                <th className="num col-opt">GW</th>
                <th className="num col-opt">GL</th>
              </tr>
            </thead>
            <tbody>
              {data.standings.map((rowData) => (
                <tr key={rowData.playerId} className={rowData.isYou ? "you-row" : undefined}>
                  <td className="rk">{rowData.rank}</td>
                  <td>
                    <div className="pl">
                      <span className="av">{rowData.initials}</span>
                      {rowData.name}
                      {rowData.isYou ? <span className="you-tag">you</span> : null}{" "}
                      <TrendCell row={rowData} />
                    </div>
                  </td>
                  <td className="num">{rowData.matchesPlayed}</td>
                  <td className="num">
                    <span className={recordClass(rowData.wins, rowData.losses)}>
                      {rowData.wins}–{rowData.losses}
                    </span>
                  </td>
                  <td className="num">
                    {rowData.gameDiff > 0 ? "+" : rowData.gameDiff < 0 ? "−" : ""}
                    {Math.abs(rowData.gameDiff) || 0}
                  </td>
                  <td className="num col-opt">{rowData.gamesWon}</td>
                  <td className="num col-opt">{rowData.gamesLost}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="legend">
          <span>
            <span className="trend up">▲</span>
            <span className="trend down">▼</span> rank change this week
          </span>
          <span>
            <Icon name="flame" className="flame" /> win streak
          </span>
        </div>
      </section>
    ) : null}

    {activeTab === "players" ? (
      <section className="panel">
        <div className="pg">
          {data.roster.map((player) => (
            <div className="pcard" key={player.playerId}>
              <span className="av">{player.initials}</span>
              <div className="pinfo">
                <div className="nm">{player.name}</div>
                <div className="rt">
                  TRP {player.rating.toFixed(1)} ·{" "}
                  <span className={recordClass(player.wins, player.losses)}>
                    {player.wins}–{player.losses}
                  </span>
                </div>
              </div>
              {player.contact ? (
                <a
                  className="contact"
                  aria-label={`Contact ${player.name}`}
                  href={contactHref(player.contact)}
                >
                  <Icon name="message-circle" />
                </a>
              ) : (
                <button type="button" className="contact" aria-label={`Contact ${player.name}`} disabled>
                  <Icon name="message-circle" />
                </button>
              )}
            </div>
          ))}
        </div>
      </section>
    ) : null}

    {activeTab === "results" ? (
      <section className="panel">
        {data.results.length ? (
          data.results.map((result) => (
            <div className="list-row" key={result.id}>
              <span className="winner">{result.winnerName}</span>
              <span className="meta">def.</span>
              <span className="loser">{result.loserName}</span>
              <span className="score" style={{ marginLeft: 12 }}>
                {result.score}
              </span>
              <span className="spacer meta">{result.playedAgo}</span>
            </div>
          ))
        ) : (
          <div className="list-empty">No results posted yet.</div>
        )}
      </section>
    ) : null}

    {activeTab === "pending" ? (
      <section className="panel">
        {data.pending.length ? (
          data.pending.map((match) => (
            <div className="list-row pending" key={match.id}>
              <Icon name="clock" style={{ color: "var(--ink-3)", fontSize: 17 }} />
              <span className="who">{match.player1}</span>
              <span className="meta">vs</span>
              <span className="who">{match.player2}</span>
              <span className="spacer" />
              <button
                type="button"
                className="btn ghost"
                style={{ fontSize: 12.5, padding: "7px 12px" }}
                onClick={() => onSchedule(match.id)}
              >
                Schedule
              </button>
            </div>
          ))
        ) : (
          <div className="list-empty">No pending matches.</div>
        )}
      </section>
    ) : null}
  </>
);

export default LeagueTabs;
