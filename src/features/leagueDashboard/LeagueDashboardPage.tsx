// League Dashboard — top-level page.
//
// Wired to the REAL leagues API through useLeagueDashboard (token + viewer
// identity resolved, endpoints fetched in parallel, mapped to the dashboard's
// domain shapes). Components read the mapped data via their existing prop
// contracts. Switching leagues is a route change (/leagues/:id/dashboard) so the
// whole page repopulates from the new dataset.

import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import MainLayout from "../../components/MainLayout";
import ActionSlot from "./ActionSlot";
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
import StandingsPreview from "./StandingsPreview";
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

  // "See full standings" (mobile Overview preview) switches to the Standings
  // section AND moves focus into the panel for keyboard/AT users. The panel only
  // mounts once `section !== "overview"`, so we flip a pending-focus flag and let
  // an effect focus the wrapper after it commits (robust vs. same-tick refs).
  const panelRef = useRef<HTMLDivElement>(null);
  const [pendingPanelFocus, setPendingPanelFocus] = useState(false);
  const goStandings = () => {
    setSection("standings");
    setPendingPanelFocus(true);
  };
  useEffect(() => {
    if (pendingPanelFocus && section === "standings") {
      panelRef.current?.focus();
      setPendingPanelFocus(false);
    }
  }, [pendingPanelFocus, section]);

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

  // "Need a Match" / "Post availability" now goes to the multi-slot Post
  // Availability page (merged from main via #250) — not the old single-slot
  // drawer. "Log a Score" still uses the LeagueDetailPage score drawer (openScore).
  const goPostAvailability = () => navigate(`/leagues/${id}/post-availability`);

  const handleNextMove = (target: NextMoveTarget) => {
    switch (target) {
      case "add-score":
        goLeague({ openScore: true });
        break;
      case "add-availability":
        goPostAvailability();
        break;
      case "schedule-candidate": {
        const sid = data?.nextMoveContext.matchmake_candidate?.suggestionId;
        if (sid != null) goLeague({ acceptSuggestionId: sid });
        else goPostAvailability();
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
      <div className={`lgd${isMobile ? " has-nextmove-bar lgd--mobile" : ""}`}>
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
                      {/* Unified contextual slot (replaces the league-wide pending
                          banner + the next-move card on mobile). Shows ONE specific
                          named prompt the sticky bar can't express, or nothing. */}
                      <ActionSlot
                        reportOpponent={data.nextMoveContext.unscored_results[0]?.opponentName}
                        challengeFrom={data.nextMoveContext.pending_challenges_for_me[0]?.fromName}
                        lookingName={data.looking[0]?.name}
                        playersLookingCount={data.playersLookingCount}
                        onReport={() => goLeague({ openScore: true })}
                        onRespond={showPending}
                        onSeeLooking={() => navigate(`/leagues/${id}/match-browser`)}
                        onViewAll={() => navigate(`/leagues/${id}/match-browser`)}
                      />
                      <Hero
                        hero={hero}
                        onCta={() => handleNextMove(nextMove.cta.target)}
                        onPostAvailability={() => goPostAvailability()}
                      />
                      <StandingsPreview standings={data.standings} onSeeFull={goStandings} />
                      <ResultsTicker items={data.ticker} />
                      <ThisWeekCard week={data.week} />
                      <SeasonProgress season={data.season} />
                      <PlayersLooking
                        looking={data.looking}
                        onNeedMatch={() => goPostAvailability()}
                        onSeeAll={() => navigate(`/leagues/${id}/match-browser`)}
                      />
                    </>
                  ) : (
                    // Focus target for "See full standings" — tabIndex=-1 so it's
                    // programmatically focusable but not a keyboard tab stop.
                    <div ref={panelRef} tabIndex={-1} className="section-panel-wrap">
                      <LeagueTabs
                        data={data}
                        // Not "overview" in this branch — the four data tabs are TabKeys.
                        activeTab={section as TabKey}
                        onTabChange={setSection}
                        onSchedule={() => goPostAvailability()}
                        hideTabBar
                      />
                    </div>
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
                      <button type="button" className="btn ghost" onClick={() => goPostAvailability()}>
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
                    onNeedMatch={() => goPostAvailability()}
                    onSeeAll={() => navigate(`/leagues/${id}/match-browser`)}
                  />

                  <LeagueTabs
                    data={data}
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                    onSchedule={() => goPostAvailability()}
                  />
                </>
              )}
            </div>
          );
        })()}

        {isMobile && data ? (
          <div className="nextmove-bar">
            <button type="button" className="btn" onClick={() => goLeague({ openScore: true })}>
              Log a Score
            </button>
            <button type="button" className="btn ghost" onClick={() => goPostAvailability()}>
              Need a Match
            </button>
          </div>
        ) : null}
      </div>
    </MainLayout>
  );
};

export default LeagueDashboardPage;
