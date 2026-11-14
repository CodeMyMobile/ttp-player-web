// Best bets this week (home v2, §6.1): unplayed opponents ranked by the free times you share,
// each with "3 shared times · Sat, Sun, Tue" and Arrange — filled on the first row, outline after.
// A viewer with no weekly times on file is asked to set them; opponents with none in common are
// left to Still to play below.

import React, { useState } from "react";
import { Link } from "react-router-dom";

import { bestBetLine, bestBetsWithTimes } from "../../utils/availabilityGrid";
import type { BestBetsState } from "./useBestBets";

const PREVIEW = 3;

const initialsOf = (name: string | null) =>
  String(name || "?")
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

interface BestBetsProps {
  state: BestBetsState;
  onArrange: (playerId: string) => void;
}

const BestBets = ({ state, onArrange }: BestBetsProps) => {
  const [expanded, setExpanded] = useState(false);
  if (state.status === "unavailable") return null;
  if (state.status === "loading") {
    return <div className="best-bets best-bets--loading" aria-busy="true" aria-label="Loading best bets" />;
  }
  if (!state.data.has_availability) {
    return (
      <section className="best-bets best-bets--prompt" aria-label="Best bets this week">
        <div>
          <h2 className="sched-h">Best bets this week</h2>
          <p className="best-bets__prompt">Set when you can play to see who's free at the same times.</p>
        </div>
        <Link className="best-bets__set" to="/settings/availability">
          Set your times
        </Link>
      </section>
    );
  }
  const bets = bestBetsWithTimes(state.data.opponents);
  if (!bets.length) return null;
  const shown = expanded ? bets : bets.slice(0, PREVIEW);

  return (
    <section className="best-bets" aria-labelledby="best-bets-h">
      <h2 className="sched-h" id="best-bets-h">Best bets this week</h2>
      <ul className="best-bets__list">
        {shown.map((bet, index) => (
          <li key={bet.player_id} className="best-bets__row">
            <span className="best-bets__av" aria-hidden="true">{initialsOf(bet.name)}</span>
            <span className="best-bets__body">
              <span className="best-bets__name">{bet.name || "League player"}</span>
              <span className="best-bets__line">{bestBetLine(bet)}</span>
            </span>
            <button
              type="button"
              className={`best-bets__arrange${index === 0 ? " is-primary" : ""}`}
              onClick={() => onArrange(String(bet.player_id))}
              aria-label={`Arrange a match with ${bet.name || "this player"}`}
            >
              Arrange
            </button>
          </li>
        ))}
      </ul>
      {bets.length > PREVIEW ? (
        <button type="button" className="best-bets__more" onClick={() => setExpanded((value) => !value)}>
          {expanded ? "Show fewer" : `See all ${bets.length} opponents`}
        </button>
      ) : null}
    </section>
  );
};

export default BestBets;
