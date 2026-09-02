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
import {
  buildContactLinks,
  buildContactMessage,
  buildVCardFile,
  canSaveAllContacts,
  canShowContact,
  formatPhoneDisplay,
  sharedContactCount,
  vCardFileName,
  type ContactablePlayer,
} from "./contactSheet";
import { isContactSheetEnabled } from "./contactSheetFlag";
import { sizedImageUrl } from "../../utils/playerImage";
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
  /** Players tab toolbar action. No log-a-score counterpart: a roster screen
   *  implies no finished match. */
  onNeedMatch?: () => void;
  /** Viewer's own name and availability, for the outreach message. */
  viewerName?: string;
  viewerAvailability?: string | null;
  /** Overrides the feature gate. Injected by tests; production reads the flag. */
  contactSheetEnabled?: boolean;
  /** Overrides touch detection. Injected by tests; production reads the media query. */
  pointerCoarse?: boolean;
}

/** Roster player as the contact helpers want it — ratings ride along for the vCard name. */
const toContactable = (player: RosterPlayer): ContactablePlayer => ({
  playerId: player.playerId,
  name: player.name,
  phone: player.phone,
  shareContact: player.shareContact,
  rating: player.rating,
  ntrp: player.ntrp,
  utr: player.utr,
});

/** Downloads the .vcf entirely client-side — no round trip, no server copy of the roster. */
const saveAllContacts = (players: RosterPlayer[], leagueName: string) => {
  const file = buildVCardFile(players.map(toContactable), leagueName);
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
  onNeedMatch,
  viewerName,
  viewerAvailability,
  contactSheetEnabled: contactSheetEnabledProp,
  pointerCoarse: pointerCoarseProp,
}: LeagueTabsProps) => {
  // Which row last had its number copied, for the transient chip state.
  const [copiedPlayerId, setCopiedPlayerId] = useState<string | null>(null);
  const [liveMessage, setLiveMessage] = useState("");

  const copyNumber = (playerId: string, e164: string) => {
    void navigator.clipboard?.writeText(e164).then(() => {
      setCopiedPlayerId(playerId);
      setLiveMessage("Number copied");
      setTimeout(() => setCopiedPlayerId(null), 1400);
    }).catch(() => setCopiedPlayerId(null));
  };
  const detectedCoarse = usePointerCoarse();
  const pointerCoarse = pointerCoarseProp ?? detectedCoarse;
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
          <span className="ptab-count">{data.roster.length} players</span>
          {contactSheetEnabled && canSaveAllContacts(data.roster.map(toContactable)) ? (
            <button
              type="button"
              className="btn ghost"
              onClick={() => saveAllContacts(data.roster, leagueName)}
            >
              Save all contacts
            </button>
          ) : null}
          {/* Desktop only — on mobile the sticky bottom bar already carries it,
              and two of the same button on one screen is one too many. */}
          {onNeedMatch ? (
            <button type="button" className="btn ptab-need-match" onClick={onNeedMatch}>
              Need a match
            </button>
          ) : null}
        </div>

        <div className="pg">
          {data.roster.map((player) => {
            const contactable = contactSheetEnabled && canShowContact(toContactable(player));
            const body = buildContactMessage({
              recipientName: player.name,
              senderName: viewerName || "",
              leagueName,
            });
            // Links are only built for a player who consented, so a withheld
            // number never reaches an href, an aria-label, or the DOM at all.
            const links = contactable ? buildContactLinks(player.phone, body) : null;
            const e164 = links ? links.tel.replace("tel:", "") : null;
            const copied = copiedPlayerId === player.playerId;

            return (
              <div className="pcard" key={player.playerId}>
                {player.profileImageUrl ? (
                  <img
                    className="av av-photo"
                    src={sizedImageUrl(player.profileImageUrl, { size: 40 })}
                    alt=""
                    loading="lazy"
                    width={40}
                    height={40}
                  />
                ) : (
                  <span className={`av${contactable ? "" : " av-muted"}`}>{player.initials}</span>
                )}
                <span className="pinfo">
                  <span className="nm">{player.name}</span>
                  {/* All three ratings on one line, on both platforms; the record
                      gets its own line below so neither has to be dropped. */}
                  <span className="rt">
                    {player.rating === null ? "TPR —" : `TPR ${player.rating.toFixed(1)}`}
                    {player.ntrp ? ` · NTRP ${player.ntrpEstimated ? "~" : ""}${player.ntrp}` : ""}
                    {player.utr ? ` · UTR ${player.utrEstimated ? "~" : ""}${player.utr}` : " · UTR unrated"}
                  </span>
                  <span className="rec-line">
                    <span className={recordClass(player.wins, player.losses)}>
                      {player.wins}–{player.losses}
                    </span>
                  </span>
                  {links ? (
                    <span className="tel">{formatPhoneDisplay(player.phone)}</span>
                  ) : (
                    <span className="tel tel-none">Number not shared</span>
                  )}
                </span>

                <span className="chans">
                  {links && e164 ? (
                    pointerCoarse ? (
                      <>
                        <a className="chan-chip" href={links.sms} aria-label={`Text ${player.name}`}>
                          <Icon name="message-circle" />
                        </a>
                        <a className="chan-chip" href={links.tel} aria-label={`Call ${player.name}`}>
                          <Icon name="phone" />
                        </a>
                        <a
                          className="chan-chip"
                          href={links.whatsapp}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`WhatsApp ${player.name}`}
                        >
                          <Icon name="brand-whatsapp" />
                        </a>
                      </>
                    ) : (
                      <>
                        {/* sms: and tel: are dead on a fine pointer, so those two
                            slots are replaced rather than greyed out. */}
                        <button
                          type="button"
                          className={`chan-chip${copied ? " chan-chip-done" : ""}`}
                          onClick={() => copyNumber(player.playerId, e164)}
                          aria-label={`Copy number for ${player.name}`}
                          title={copied ? "Copied" : "Copy number"}
                        >
                          <Icon name={copied ? "check" : "copy"} />
                        </button>
                        <a
                          className="chan-chip"
                          href={links.whatsapp}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`WhatsApp ${player.name}`}
                          title="WhatsApp"
                        >
                          <Icon name="brand-whatsapp" />
                        </a>
                        <button
                          type="button"
                          className="chan-chip"
                          onClick={() => onProposeMatch?.(player.playerId)}
                          aria-label={`Propose a match with ${player.name}`}
                          title="Propose a match"
                        >
                          <Icon name="calendar-plus" />
                        </button>
                      </>
                    )
                  ) : (
                    /* No consent, or no number: the in-app route is the only one left. */
                    <button
                      type="button"
                      className="chan-chip"
                      onClick={() => onProposeMatch?.(player.playerId)}
                      aria-label={`Propose a match with ${player.name}`}
                      title="Propose a match"
                    >
                      <Icon name="calendar-plus" />
                    </button>
                  )}
                </span>
              </div>
            );
          })}
        </div>

        {contactSheetEnabled ? (
          <p className="ptab-note">
            {sharedContactCount(data.roster.map(toContactable))} of {data.roster.length} players
            share a number with this division. The rest can be reached with a match invite.
          </p>
        ) : null}

        <span className="sr-live" role="status" aria-live="polite">{liveMessage}</span>
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
