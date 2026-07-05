// Compact standings preview — mobile Overview only, below the hero. NEVER the
// full table (3–5 rows). Reuses the standings row visuals (rank, .pl name + .av
// initials, streak flame / real ▲▼ movement, W–L via the shared recordClass).
//
// Two states:
//  • Ranked (viewer has played ≥1 match) → neighbour + gap context: viewer's row
//    ±2 rows with a gameDiff gap caption. Does NOT restate the rank number.
//  • Unranked (never played — note a 0–0 player still HAS a bottom row, so this
//    keys on matchesPlayed===0, not row presence) → the LEADERS (top 4) + a muted
//    "you'll appear here" line, and the viewer's own row pinned at the bottom.

import Icon from "./Icon";
import { recordClass } from "./LeagueTabs";
import type { StandingRow } from "./types";

// Movement/streak cell. Only rendered when there's something real to show —
// a streak or an actual ▲▼ move. No bare "–" placeholder (noise, esp. unranked).
const renderTrend = (row: StandingRow) => {
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
  return null;
};

const games = (n: number) => `${n} game${n === 1 ? "" : "s"}`;

const StandingRowLine = ({ row }: { row: StandingRow }) => {
  const trend = renderTrend(row);
  return (
    <div className={`sp-row${row.isYou ? " you-row" : ""}`}>
      <span className="rk">{row.rank}</span>
      <div className="pl">
        <span className="av">{row.initials}</span>
        <span className="sp-nm">{row.name}</span>
        {row.isYou ? <span className="you-tag">you</span> : null}
        {trend ? <> {trend}</> : null}
      </div>
      <span className={`sp-rec ${recordClass(row.wins, row.losses)}`}>
        {row.wins}–{row.losses}
      </span>
    </div>
  );
};

interface StandingsPreviewProps {
  standings: StandingRow[];
  /** Switches the mobile section to Standings and moves focus into the panel. */
  onSeeFull: () => void;
}

const StandingsPreview = ({ standings, onSeeFull }: StandingsPreviewProps) => {
  const viewer = standings.find((row) => row.isYou);
  // A never-played player still appears at the bottom of the table (0–0), so
  // "unranked" must key on having actually played, not on row presence.
  const isRanked = !!viewer && viewer.matchesPlayed > 0;

  let caption: string | null = null;
  let rows: StandingRow[];
  let pinnedYou: StandingRow | null = null;

  if (isRanked && viewer) {
    // ── Ranked: gap caption from adjacent rows + a ±2 neighbour window.
    const youIndex = standings.indexOf(viewer);
    const above = youIndex > 0 ? standings[youIndex - 1] : undefined;
    const below = youIndex < standings.length - 1 ? standings[youIndex + 1] : undefined;
    const clauses: string[] = [];
    if (above) {
      const behind = above.gameDiff - viewer.gameDiff;
      if (behind > 0) clauses.push(`${games(behind)} behind #${above.rank}`);
      else if (behind === 0) clauses.push(`tied with #${above.rank}`);
    }
    if (below) {
      const back = viewer.gameDiff - below.gameDiff;
      if (back > 0) clauses.push(`#${below.rank} is ${games(back)} back`);
    }
    caption = clauses.length ? clauses.join(" · ") : null;
    rows = standings.slice(Math.max(0, youIndex - 2), youIndex + 3);
  } else {
    // ── Unranked: show the LEADERS (top of table), not the viewer's neighbours.
    rows = standings.slice(0, 4);
    // Pin the viewer's own row at the bottom (with the "you" tag) when it isn't
    // already among the leaders shown.
    if (viewer && !rows.includes(viewer)) pinnedYou = viewer;
  }

  return (
    <section className="card standings-preview">
      <div className="mini-head m sp-head">
        <Icon name="trending-up" />
        Standings
      </div>

      {isRanked ? (
        caption ? <div className="sp-cap">{caption}</div> : null
      ) : (
        <div className="sp-cap">You&apos;ll appear here after your first match.</div>
      )}

      <div className="sp-rows">
        {rows.map((row) => (
          <StandingRowLine key={row.playerId} row={row} />
        ))}
        {pinnedYou ? (
          <>
            <div className="sp-sep" aria-hidden="true" />
            <StandingRowLine row={pinnedYou} />
          </>
        ) : null}
      </div>

      <button type="button" className="sp-see" onClick={onSeeFull}>
        See full standings <Icon name="arrow-right" style={{ fontSize: 13, verticalAlign: "-1px" }} />
      </button>
    </section>
  );
};

export default StandingsPreview;
