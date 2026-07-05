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
import SectionNav, { type SectionKey } from "./SectionNav";
import ThisWeekCard from "./ThisWeekCard";
import { challengeService } from "./challengeService";
import { useIsMobile } from "./useIsMobile";
import { useLeagueDashboard } from "./useLeagueDashboard";
import type { NextMoveTarget, TabKey } from "./types";

import "./LeagueDashboard.css";

const LeagueDashboardPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { data, hero, nextMove, leagues, loading, error } = useLeagueDashboard(id);
  const [activeTab, setActiveTab] = useState<TabKey>("standings");
  // Mobile section state (Overview + the four data tabs). Kept separate from the
  // desktop `activeTab` so "overview" can never leak into the desktop LeagueTabs.
  const [section, setSection] = useState<SectionKey>("overview");

  // Reset to the default tab/section whenever the active league changes.
  useEffect(() => {
    setActiveTab("standings");
    setSection("overview");
  }, [data?.summary.id]);

  // Jump to the Pending list from either branch's affordances (banner "View",
  // respond-to-challenge next move). Sets both states so it works whichever
  // branch is mounted.
  const showPending = () => {
    setActiveTab("pending");
    setSection("pending");
  };

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
        showPending();
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
      pageClassName="leagues-shell lgd-shell"
      hideMobileNewMatch
      hideMobileNotifications
      hideMobileLocation
      onMobileBack={() => navigate("/leagues")}
      mobileCenter={
        data ? <LeagueSwitcher variant="nav" active={data.summary} leagues={leagues} /> : undefined
      }
    >
      <div className={`lgd${showNextMoveBar ? " has-nextmove-bar" : ""}${isMobile ? " lgd--mobile" : ""}`}>
        {(() => {
          const notReady = loading || !data || !hero || !nextMove;
          const loadingOrError = error ? (
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
          );

          // ── Mobile branch: persistent segmented section-nav + section content.
          // No page-head / back link (nav carries the switcher + back arrow), so
          // the sticky section-nav sits flush under the top nav — no empty gap.
          if (isMobile) {
            if (notReady || !data || !hero || !nextMove) {
              return <div className="wrap">{loadingOrError}</div>;
            }
            return (
              <>
                <SectionNav section={section} onChange={setSection} />
                <div className="wrap">
                  {section === "overview" ? (
                    <>
                      <PendingBanner count={data.pendingScoreCount} onView={showPending} />
                      <Hero hero={hero} onCta={() => handleNextMove(nextMove.cta.target)} />
                      <ResultsTicker items={data.ticker} />
                      <ThisWeekCard week={data.week} />
                      <SeasonProgress season={data.season} />
                      <PlayersLooking
                        looking={data.looking}
                        onNeedMatch={() => goLeague({ openPost: true })}
                        onSeeAll={() => navigate(`/leagues/${id}/match-browser`)}
                      />
                    </>
                  ) : (
                    <LeagueTabs
                      data={data}
                      // Not "overview" in this branch — the four data tabs are TabKeys.
                      activeTab={section as TabKey}
                      onTabChange={setSection}
                      onSchedule={() => goLeague({ openPost: true })}
                      hideTabBar
                    />
                  )}
                  <div className="mobile-foot">{data.summary.sub}</div>
                </div>
              </>
            );
          }

          // ── Desktop branch: the current layout, verbatim (pixel-identical).
          return (
            <div className="wrap">
              <a className="back" href="#/leagues">
                <Icon name="chevron-left" />
                Back to leagues
              </a>

              {notReady || !data || !hero || !nextMove ? (
                loadingOrError
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
          );
        })()}

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
