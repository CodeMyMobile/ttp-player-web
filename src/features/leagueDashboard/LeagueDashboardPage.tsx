// League Dashboard — top-level page.
//
// Self-contained and mock-driven (NOT wired to the real API). It reads ONLY from
// the hooks (useLeague / usePlayer / useNextMove); there are no hardcoded league
// values in this JSX. Switching leagues is a route change (/leagues/:id/dashboard)
// so the whole page repopulates from the new dataset.

import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import DashboardHeader from "./DashboardHeader";
import Hero from "./Hero";
import Icon from "./Icon";
import LeagueSwitcher from "./LeagueSwitcher";
import LeagueTabs from "./LeagueTabs";
import NextMoveCard from "./NextMoveCard";
import PendingBanner from "./PendingBanner";
import PlayersLooking from "./PlayersLooking";
import ResultsTicker from "./ResultsTicker";
import SeasonProgress from "./SeasonProgress";
import ThisWeekCard from "./ThisWeekCard";
import { challengeService } from "./challengeService";
import { useLeague, useNextMove, usePlayer } from "./hooks";
import type { NextMoveTarget, TabKey } from "./types";

import "./LeagueDashboard.css";

const LeagueDashboardPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, leagues } = useLeague(id);
  const { hero } = usePlayer(id);
  const nextMove = useNextMove(id);
  const [activeTab, setActiveTab] = useState<TabKey>("standings");

  // Reset to the default tab whenever the active league changes.
  useEffect(() => {
    setActiveTab("standings");
  }, [data.summary.id]);

  // Next-move CTA routing. Most targets are stub flows for this rung; the
  // direct-challenge path goes through the typed challengeService seam.
  const handleNextMove = (target: NextMoveTarget) => {
    switch (target) {
      case "add-score":
      case "respond-challenge":
        setActiveTab("pending");
        break;
      case "direct-challenge": {
        const opponent = data.nextMoveContext.unplayed_opponents[0];
        if (opponent) void challengeService.challenge(String(opponent.playerId));
        break;
      }
      case "all-matches":
        navigate("/leagues");
        break;
      // schedule-candidate, add-availability, notify-me: stubbed no-ops for now.
      default:
        break;
    }
  };

  return (
    <div className="lgd">
      <DashboardHeader />
      <main className="wrap">
        <a className="back" href="#/leagues">
          <Icon name="chevron-left" />
          Back to leagues
        </a>

        <div className="page-head">
          <LeagueSwitcher active={data.summary} leagues={leagues} />
          <div className="head-actions">
            <button type="button" className="btn ghost">
              Need a match
            </button>
            <button type="button" className="btn" onClick={() => setActiveTab("pending")}>
              <Icon name="plus" />
              Add score
            </button>
          </div>
        </div>

        <PendingBanner count={data.pendingScoreCount} onView={() => setActiveTab("pending")} />

        <Hero hero={hero} onCta={() => handleNextMove(nextMove.cta.target)} />

        <ResultsTicker items={data.ticker} />

        <section className="grid-two">
          <NextMoveCard move={nextMove} onCta={handleNextMove} />
          <ThisWeekCard week={data.week} />
        </section>

        <SeasonProgress season={data.season} />

        <PlayersLooking looking={data.looking} onNeedMatch={() => setActiveTab("pending")} />

        <LeagueTabs
          data={data}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onContact={() => setActiveTab("players")}
          onSchedule={() => setActiveTab("pending")}
        />
      </main>
    </div>
  );
};

export default LeagueDashboardPage;
