// League Dashboard — top-level page.
//
// Wired to the REAL leagues API through useLeagueDashboard (token + viewer
// identity resolved, endpoints fetched in parallel, mapped to the dashboard's
// domain shapes). Components read the mapped data via their existing prop
// contracts. Switching leagues is a route change (/leagues/:id/dashboard) so the
// whole page repopulates from the new dataset.

import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import MainLayout from "../../components/MainLayout";
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
import { useLeagueDashboard } from "./useLeagueDashboard";
import type { NextMoveTarget, TabKey } from "./types";

import "./LeagueDashboard.css";

const LeagueDashboardPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, hero, nextMove, leagues, loading, error } = useLeagueDashboard(id);
  const [activeTab, setActiveTab] = useState<TabKey>("standings");

  // Reset to the default tab whenever the active league changes.
  useEffect(() => {
    setActiveTab("standings");
  }, [data?.summary.id]);

  // Hand off to the existing LeagueDetailPage flows via router state (the same
  // channel MatchBrowserPage uses): openPost → Need-a-Match drawer, openScore →
  // Add-Score drawer, acceptSuggestionId → the confirm-and-join accept flow.
  const goLeague = (state?: Record<string, unknown>) =>
    navigate(`/leagues/${id}`, state ? { state } : undefined);

  const handleNextMove = (target: NextMoveTarget) => {
    switch (target) {
      case "add-score":
        goLeague({ openScore: true });
        break;
      case "add-availability":
        goLeague({ openPost: true });
        break;
      case "schedule-candidate": {
        const sid = data?.nextMoveContext.matchmake_candidate?.suggestionId;
        goLeague(sid != null ? { acceptSuggestionId: sid } : { openPost: true });
        break;
      }
      case "all-matches":
        navigate(`/leagues/${id}/match-browser`);
        break;
      case "direct-challenge": {
        // FLAG: no real direct-challenge backend yet — stubbed via challengeService.
        const opponent = data?.nextMoveContext.unplayed_opponents[0];
        if (opponent) void challengeService.challenge(String(opponent.playerId));
        break;
      }
      case "respond-challenge":
        // No challenges endpoint yet (Rung 0 "respond" is dormant) — show pending.
        setActiveTab("pending");
        break;
      case "notify-me":
      default:
        break;
    }
  };

  // Sticky mobile action bar mirrors the "Your next move" card. Hidden on the
  // Rung-4 "all caught up" state (no action to take) so there's no dead bar.
  const showNextMoveBar = Boolean(!loading && data && nextMove && nextMove.kind !== "all_caught_up");

  return (
    <MainLayout
      pageClassName="leagues-shell"
      hideMobileNewMatch
      hideMobileNotifications
      hideMobileLocation
      onMobileBack={() => navigate("/leagues")}
      mobileCenter={
        data ? <LeagueSwitcher variant="nav" active={data.summary} leagues={leagues} /> : undefined
      }
    >
      <div className={`lgd${showNextMoveBar ? " has-nextmove-bar" : ""}`}>
        <div className="wrap">
          <a className="back" href="#/leagues">
            <Icon name="chevron-left" />
            Back to leagues
          </a>

        {loading || !data || !hero || !nextMove ? (
          error ? (
            <section className="card" style={{ padding: 24 }}>
              <div className="t" style={{ fontWeight: 600, marginBottom: 6 }}>
                Couldn't load this league
              </div>
              <div className="b" style={{ color: "var(--ink-3)" }}>{error}</div>
            </section>
          ) : (
            <section className="card" style={{ padding: 24 }} aria-busy="true">
              Loading league…
            </section>
          )
        ) : (
          <>
            <div className="page-head">
              <LeagueSwitcher variant="page" active={data.summary} leagues={leagues} />
              <div className="head-actions">
                <button type="button" className="btn ghost" onClick={() => goLeague({ openPost: true })}>
                  Need a match
                </button>
                <button type="button" className="btn" onClick={() => goLeague({ openScore: true })}>
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

            <PlayersLooking
              looking={data.looking}
              onNeedMatch={() => goLeague({ openPost: true })}
              onSeeAll={() => navigate(`/leagues/${id}/match-browser`)}
            />

            <LeagueTabs
              data={data}
              activeTab={activeTab}
              onTabChange={setActiveTab}
              onSchedule={() => goLeague({ openPost: true })}
            />
          </>
        )}
        </div>

        {showNextMoveBar && nextMove ? (
          <div className="nextmove-bar">
            <button
              type="button"
              className="btn wide"
              onClick={() => handleNextMove(nextMove.cta.target)}
            >
              {nextMove.cta.label}
            </button>
          </div>
        ) : null}
      </div>
    </MainLayout>
  );
};

export default LeagueDashboardPage;
