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

import React, { useState } from "react";

import Icon from "./Icon";
import PlayerContactSheet from "./PlayerContactSheet";
import {
  buildVCardFile,
  canSaveAllContacts,
  canShowContact,
  vCardFileName,
  type ContactablePlayer,
} from "./contactSheet";
import { isContactSheetEnabled } from "./contactSheetFlag";
import { usePointerCoarse } from "./usePointerCoarse";
import type { LeagueData, RosterPlayer, StandingRow, TabKey } from "./types";

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: "ladder", label: "Ladder" },
  { key: "standings", label: "Standings" },
  { key: "players", label: "Players" },
  { key: "results", label: "Results" },
  { key: "pending", label: "Pending" },
];

// W–L colour rule — GREEN when wins>losses, RED when losses>wins, else neutral.
// Exported so the mobile StandingsPreview reuses the exact same correctness rule.
export const recordClass = (wins: number, losses: number): string =>
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
  onChallenge?: (playerId: string) => void;
  // Mobile: the SectionNav is the tab bar, so omit the internal `.tabs` bar and
  // render only the active panel (avoids showing two tab strips).
  hideTabBar?: boolean;
  /** Opens the match-create flow with this roster player pre-selected. */
  onProposeMatch?: (playerId: string) => void;
  /** Desktop primary actions — the mobile sticky bar's pair, in the tab header. */
  onLogScore?: () => void;
  onNeedMatch?: () => void;
  /** Viewer's own name and availability, for the outreach message. */
  viewerName?: string;
  viewerAvailability?: string | null;
  /** Overrides the feature gate. Injected by tests; production reads the flag. */
  contactSheetEnabled?: boolean;
}

/** Roster player as the contact helpers want it — the level label doubles as the vCard suffix. */
const toContactable = (player: RosterPlayer): ContactablePlayer => ({
  playerId: player.playerId,
  name: player.name,
  phone: player.phone,
  shareContact: player.shareContact,
  levelLabel: player.rating === null ? null : player.rating.toFixed(1),
});

/** Downloads the .vcf entirely client-side — no round trip, no server copy of the roster. */
const saveAllContacts = (players: RosterPlayer[], leagueName: string) => {
  const file = buildVCardFile(players.map(toContactable));
  if (!file) return;
  const url = URL.createObjectURL(new Blob([file], { type: "text/vcard;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = vCardFileName(leagueName);
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};

const LeagueTabs = ({
  data,
  activeTab,
  onTabChange,
  onSchedule,
  onChallenge,
  hideTabBar,
  onProposeMatch,
  onLogScore,
  onNeedMatch,
  viewerName,
  viewerAvailability,
  contactSheetEnabled: contactSheetEnabledProp,
}: LeagueTabsProps) => {
  // One row open at a time — opening a second closes the first.
  const [expandedPlayerId, setExpandedPlayerId] = useState<string | null>(null);
  const pointerCoarse = usePointerCoarse();
  const contactSheetEnabled = contactSheetEnabledProp ?? isContactSheetEnabled();
  const leagueName = data.summary.name || "league";

  return (
  <>
    {hideTabBar ? null : (
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
    )}

    {activeTab === "ladder" ? (
      <section className="panel card ladder-panel">
        <div className="ladder-head">
          <div>
            <div className="eyebrow">Rated players</div>
            <h2>League ladder</h2>
          </div>
          <span>{data.ladder.length} rated</span>
        </div>
        {data.ladder.length ? (
          <div className="ladder-list">
            {data.ladder.map((row) => (
              <div className={`ladder-row${row.isViewer ? " you-row" : ""}`} key={row.playerId}>
                <span className="ladder-rank">#{row.rank}</span>
                <span className="av">{row.initials}</span>
                <div className="ladder-player">
                  <div className="pl">
                    <span className="pl-nm">{row.name}</span>
                    {row.isViewer ? <span className="you-tag">you</span> : null}
                  </div>
                  <div className="rt">
                    {row.ratingType} {row.ratingLabel}
                    {row.ntrpLabel !== "-" && row.ratingType !== "NTRP" ? ` · NTRP ${row.ntrpLabel}` : ""}
                    {row.utrLabel !== "-" && row.ratingType !== "UTR" ? ` · UTR ${row.utrLabel}` : ""}
                    {row.ratingBadge ? ` · ${row.ratingBadge}` : ""}
                  </div>
                </div>
                <span className={recordClass(row.wins, row.losses)}>{row.recordLabel}</span>
                <button
                  type="button"
                  className="btn"
                  disabled={row.isViewer}
                  onClick={() => onChallenge?.(row.playerId)}
                >
                  Challenge
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="list-empty">No rated players yet.</div>
        )}
      </section>
    ) : null}

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
                      <span className="pl-nm">{rowData.name}</span>
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
        <div className="ptab-head">
          <div className="ptab-head-actions">
            {onLogScore ? (
              <button type="button" className="btn" onClick={onLogScore}>
                Log a Score
              </button>
            ) : null}
            {onNeedMatch ? (
              <button type="button" className="btn ghost" onClick={onNeedMatch}>
                Need a Match
              </button>
            ) : null}
          </div>
          {contactSheetEnabled && canSaveAllContacts(data.roster.map(toContactable)) ? (
            <button
              type="button"
              className="btn ghost ptab-save-all"
              onClick={() => saveAllContacts(data.roster, leagueName)}
            >
              <Icon name="download" /> Save all contacts
            </button>
          ) : null}
        </div>
        <div className="pg">
          {data.roster.map((player) => {
            const contactable = contactSheetEnabled && canShowContact(toContactable(player));
            const expanded = expandedPlayerId === player.playerId;
            const sheetId = `pcontact-${player.playerId}`;
            return (
              <div className={`pcard${expanded ? " open" : ""}`} key={player.playerId}>
                {/* The whole row is the control, not just a trailing icon. */}
                <button
                  type="button"
                  className="pcard-row"
                  aria-expanded={expanded}
                  aria-controls={contactable ? sheetId : undefined}
                  onClick={() => setExpandedPlayerId(expanded ? null : player.playerId)}
                >
                  <span className="av">{player.initials}</span>
                  <span className="pinfo">
                    <span className="nm">{player.name}</span>
                    <span className="rt">
                      {player.rating === null ? "TPR —" : `TPR ${player.rating.toFixed(1)}`}
                      {player.ntrp ? ` · NTRP ${player.ntrpEstimated ? "~" : ""}${player.ntrp}` : ""}
                      {player.utr ? ` · UTR ${player.utrEstimated ? "~" : ""}${player.utr}` : " · UTR unrated"}
                      {" · "}
                      <span className={recordClass(player.wins, player.losses)}>
                        {player.wins}–{player.losses}
                      </span>
                    </span>
                  </span>
                  <Icon name={expanded ? "chevron-up" : "chevron-down"} className="pcard-chevron" />
                </button>
                {expanded ? (
                  contactable && player.phone ? (
                    <PlayerContactSheet
                      id={sheetId}
                      playerName={player.name}
                      phone={player.phone}
                      leagueName={leagueName}
                      senderName={viewerName || ""}
                      senderAvailability={viewerAvailability}
                      pointerCoarse={pointerCoarse}
                      onProposeMatch={() => onProposeMatch?.(player.playerId)}
                    />
                  ) : (
                    /* No consent, or no number: the in-app route is still open, and
                       nothing about the number reaches the DOM. */
                    <div className="pcontact" role="region" aria-label={`Contact ${player.name}`}>
                      <button
                        type="button"
                        className="pcontact-propose"
                        onClick={() => onProposeMatch?.(player.playerId)}
                      >
                        <Icon name="ball-tennis" />
                        Propose a match in app
                        <Icon name="arrow-right" className="pcontact-propose-go" />
                      </button>
                    </div>
                  )
                ) : null}
              </div>
            );
          })}
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
};

export default LeagueTabs;
