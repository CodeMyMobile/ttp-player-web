// Compact standings preview — mobile Overview only, rendered directly below the
// hero. NEVER the full table (3–5 rows max). Reuses the standings row visuals
// (rank, .pl name + .av initials, trend ▲▼ / streak flame, W–L via the shared
// recordClass rule) so it stays visually consistent with the Standings tab.
//
// Two states, both from the already-rank-sorted `standings`:
//  • Ranked (viewer has an isYou row) → neighbour + gap context. Shows up to 2
//    rows above + the viewer + up to 2 below (contiguous, ≤5 rows) with a muted
//    gap caption. It does NOT restate the rank number (the hero already does).
//  • Unranked (no isYou row) → the top 3–5 leaders + a muted "you'll appear here"
//    line, no gap caption.

import Icon from "./Icon";
import { recordClass } from "./LeagueTabs";
import type { StandingRow } from "./types";

interface StandingsPreviewProps {
  standings: StandingRow[];
  /** Switches the mobile section to Standings and moves focus into the panel. */
  onSeeFull: () => void;
}

// Rank-movement / streak cell — same logic as LeagueTabs' TrendCell. Reimplemented
// inline (visual component, not extracted) rather than shared.
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
  if (row.trend.value !== undefined) {
    return <span className="trend flat">{row.trend.value}</span>;
  }
  return <span className="trend flat">–</span>;
};

const games = (n: number) => `${n} game${n === 1 ? "" : "s"}`;

const StandingRowLine = ({ row }: { row: StandingRow }) => (
  <div className={`sp-row${row.isYou ? " you-row" : ""}`}>
    <span className="rk">{row.rank}</span>
    <div className="pl">
      <span className="av">{row.initials}</span>
      <span className="sp-nm">{row.name}</span>
      {row.isYou ? <span className="you-tag">you</span> : null} {renderTrend(row)}
    </div>
    <span className={`sp-rec ${recordClass(row.wins, row.losses)}`}>
      {row.wins}–{row.losses}
    </span>
  </div>
);

const StandingsPreview = ({ standings, onSeeFull }: StandingsPreviewProps) => {
  const youIndex = standings.findIndex((row) => row.isYou);
  const viewer = youIndex >= 0 ? standings[youIndex] : undefined;

  // ── Gap caption (ranked only). Neighbours are the immediately-adjacent rows in
  // the rank-sorted list. Behind/back derive from gameDiff; clamp non-positive
  // gaps (equal or better) so we never print a nonsensical negative.
  let caption: string | null = null;
  if (viewer) {
    const above = youIndex > 0 ? standings[youIndex - 1] : undefined;
    const below = youIndex < standings.length - 1 ? standings[youIndex + 1] : undefined;
    const clauses: string[] = [];
    if (above) {
      const behind = above.gameDiff - viewer.gameDiff;
      if (behind > 0) clauses.push(`${games(behind)} behind #${above.rank}`);
      else if (behind === 0) clauses.push(`tied with #${above.rank}`);
      // behind < 0 (viewer ahead of the row above by gameDiff) → drop the clause.
    }
    if (below) {
      const back = viewer.gameDiff - below.gameDiff;
      if (back > 0) clauses.push(`#${below.rank} is ${games(back)} back`);
      // back ≤ 0 → drop the clause.
    }
    caption = clauses.length ? clauses.join(" · ") : null;
  }

  // Row window. Ranked: up to 2 above + viewer + up to 2 below (≤5, contiguous).
  // Unranked: the top 3–5 leaders.
  const rows = viewer
    ? standings.slice(Math.max(0, youIndex - 2), youIndex + 3)
    : standings.slice(0, 5);

  return (
    <section className="card standings-preview">
      {viewer ? (
        caption ? <div className="sp-cap">{caption}</div> : null
      ) : (
        <div className="sp-cap">You'll appear here after your first match.</div>
      )}

      <div className="sp-rows">
        {rows.map((row) => (
          <StandingRowLine key={row.playerId} row={row} />
        ))}
      </div>

      <button type="button" className="sp-see" onClick={onSeeFull}>
        See full standings <Icon name="arrow-right" style={{ fontSize: 13, verticalAlign: "-1px" }} />
      </button>
    </section>
  );
};

export default StandingsPreview;
