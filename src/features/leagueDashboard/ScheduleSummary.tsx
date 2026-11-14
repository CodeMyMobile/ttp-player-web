// The Schedule section's summary card (home v2, §6.1): "X of Y played", a bar, the weeks
// left, and the pace it takes to finish. Numbers come from LeagueData.progress, the same
// rule home's league card uses.

import React from "react";

import { paceLine } from "../../utils/leagueSeason";
import type { LeagueData } from "./types";

const ScheduleSummary = ({ progress }: { progress: NonNullable<LeagueData["progress"]> }) => {
  const { played, total, weeksLeft } = progress;
  const pct = total > 0 ? Math.round((Math.min(played, total) / total) * 100) : 0;
  const pace = paceLine(progress);
  const urgent = weeksLeft != null && weeksLeft <= 2 && played < total;

  return (
    <section className="sched-summary" aria-label="Your season">
      <div className="sched-summary__top">
        <span className="sched-summary__count">
          {total > 0 ? `${played} of ${total} played` : "No fixtures yet"}
        </span>
        {weeksLeft != null && weeksLeft > 0 ? (
          <span className={`sched-chip${urgent ? " sched-chip--urgent" : ""}`}>
            {weeksLeft} {weeksLeft === 1 ? "week" : "weeks"} left
          </span>
        ) : null}
      </div>
      {total > 0 ? (
        <div
          className="sched-summary__bar"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={Math.min(played, total)}
          aria-label="Matches played"
        >
          <i style={{ width: `${pct}%` }} />
        </div>
      ) : null}
      {pace ? <p className="sched-summary__pace">{pace}</p> : null}
    </section>
  );
};

export default ScheduleSummary;
