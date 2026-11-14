// The league page as three sections (home v2, §6.1): Schedule · Standings · Results.
//
// Each section is made of LeagueTabs' existing panels, so a panel changes in one place:
//   Schedule  = the summary card, the page's action prompt, best bets this week, Still to play (the roster cut to
//               the opponents the viewer hasn't played, with its contact and propose actions),
//               Scheduled, players looking, then the viewer's unplayed fixtures.
//   Standings = the table, with a Table / Ladder switch for the rated ladder.
//   Results   = results.

import React, { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";

import BestBets from "./BestBets";
import LeagueTabs, { type LeagueTabsProps } from "./LeagueTabs";
import ScheduleSummary from "./ScheduleSummary";
import type { LeagueData } from "./types";
import type { BestBetsState } from "./useBestBets";

export type ScheduleSectionKey = "schedule" | "standings" | "results";

export const SCHEDULE_SECTIONS: Array<{ key: ScheduleSectionKey; label: string }> = [
  { key: "schedule", label: "Schedule" },
  { key: "standings", label: "Standings" },
  { key: "results", label: "Results" },
];

/** The roster cut to the opponents the viewer still has to play. */
export const stillToPlay = (data: LeagueData): LeagueData["roster"] => {
  const unplayed = new Set(data.nextMoveContext.unplayed_opponents.map((opponent) => String(opponent.playerId)));
  return data.roster.filter((player) => unplayed.has(String(player.playerId)));
};

type PanelProps = Omit<LeagueTabsProps, "data" | "activeTab" | "onTabChange" | "hideTabBar">;

interface LeagueSectionsV2Props {
  data: LeagueData;
  section: ScheduleSectionKey;
  onSection: (section: ScheduleSectionKey) => void;
  /** Desktop draws its own tab row; on mobile the sticky SectionNav is the tab row. */
  showTabs?: boolean;
  /** The page's one contextual prompt (ActionSlot), shown at the top of Schedule. */
  actionSlot?: ReactNode;
  /** Players looking for a match, shown under Scheduled. */
  looking?: ReactNode;
  /** Best bets this week (useBestBets); left out when absent. */
  bestBets?: BestBetsState;
  panel: PanelProps;
}

const LeagueSectionsV2 = ({ data, section, onSection, showTabs, actionSlot, looking, bestBets, panel }: LeagueSectionsV2Props) => {
  const [standingsView, setStandingsView] = useState<"standings" | "ladder">("standings");
  const opponents = stillToPlay(data);
  const noop = () => {};

  return (
    <>
      {showTabs ? (
        <div className="tabs" role="tablist" aria-label="League sections">
          {SCHEDULE_SECTIONS.map((item) => (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={section === item.key}
              className={`tab${section === item.key ? " on" : ""}`}
              onClick={() => onSection(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}

      {section === "schedule" ? (
        <div className="sched">
          {data.progress ? <ScheduleSummary progress={data.progress} /> : null}
          {actionSlot}

          {bestBets && panel.onProposeMatch ? <BestBets state={bestBets} onArrange={panel.onProposeMatch} /> : null}

          {opponents.length ? (
            <section className="sched-block" aria-labelledby="sched-still">
              <h2 className="sched-h" id="sched-still">Still to play</h2>
              <LeagueTabs
                {...panel}
                data={{ ...data, roster: opponents }}
                activeTab="players"
                onTabChange={noop}
                hideTabBar
                onNeedMatch={undefined}
              />
            </section>
          ) : null}

          <section className="sched-block" aria-labelledby="sched-booked">
            <h2 className="sched-h" id="sched-booked">Scheduled</h2>
            {data.proposals?.length ? (
              <ul className="sched-proposals">
                {data.proposals.map((row) => (
                  <li key={row.fixtureId} className="sched-proposal">
                    <span className="sched-proposal__text">
                      <span className="sched-proposal__who">{row.opponentName}</span>
                      <span className="sched-proposal__state">
                        {row.sentByViewer
                          ? `${row.times.length} ${row.times.length === 1 ? "time" : "times"} sent · waiting for a pick`
                          : `Sent you ${row.times.length} ${row.times.length === 1 ? "time" : "times"}`}
                      </span>
                    </span>
                    {row.sentByViewer ? (
                      <Link className="sched-proposal__cta" to={`/leagues/${data.summary.id}/arrange/${row.opponentId}`}>
                        Send new times
                      </Link>
                    ) : (
                      <Link className="sched-proposal__cta is-primary" to={`/matches/${row.matchId}`}>
                        Pick a time
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            ) : null}
            <LeagueTabs {...panel} data={data} activeTab="scheduled" onTabChange={noop} hideTabBar scheduledEmpty="Nothing booked yet" />
          </section>

          {looking}

          {data.pending.length ? (
            <section className="sched-block" aria-labelledby="sched-fixtures">
              <h2 className="sched-h" id="sched-fixtures">Your fixtures</h2>
              <LeagueTabs {...panel} data={data} activeTab="pending" onTabChange={noop} hideTabBar />
            </section>
          ) : null}
        </div>
      ) : null}

      {section === "standings" ? (
        <div className="sched">
          <div className="sched-switch" role="group" aria-label="Standings view">
            {(["standings", "ladder"] as const).map((view) => (
              <button
                key={view}
                type="button"
                aria-pressed={standingsView === view}
                className={`sched-switch__item${standingsView === view ? " is-on" : ""}`}
                onClick={() => setStandingsView(view)}
              >
                {view === "standings" ? "Table" : "Ladder"}
              </button>
            ))}
          </div>
          <LeagueTabs {...panel} data={data} activeTab={standingsView} onTabChange={noop} hideTabBar />
        </div>
      ) : null}

      {section === "results" ? (
        <LeagueTabs {...panel} data={data} activeTab="results" onTabChange={noop} hideTabBar />
      ) : null}
    </>
  );
};

export default LeagueSectionsV2;
