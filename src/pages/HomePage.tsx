import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import AppNav from "../components/AppNav";
import MobileHomeBottomNav from "../components/MobileHomeBottomNav";
import { ActionGrid } from "../components/home/ActionGrid";
import { ActionNeeded } from "../components/home/ActionNeeded";
import { ActivityFeed, PLAY_THIS_WEEK_ID } from "../components/home/ActivityFeed";
import { OffCourt } from "../components/home/OffCourt";
import { PlayersToHitWith } from "../components/home/PlayersToHitWith";
import { TennisCircle } from "../components/home/TennisCircle";
import { UpNext } from "../components/home/UpNext";
import { useAuth } from "../context/AuthContext";
import useHomePlayers from "../hooks/useHomePlayers";
import usePlayerConnect from "../hooks/usePlayerConnect";
import {
  readViewerId,
  useActiveSeasons,
  useTipOfDay,
  useActivityFeed,
  useHomeAlerts,
  useHomeInvites,
  useDeclaredLevel,
  useLadderStanding,
  usePlayerCircle,
} from "../hooks/useHomeStatus";
import { useRestringActivity } from "../hooks/useRestringActivity";
import { isHomeFindPlayersEnabled, isMyWeekEnabled } from "../utils/featureFlags";
import { useMyWeek } from "../features/myWeek/useMyWeek";
import { buildActionRows } from "../utils/homeActionNeeded";
import { bookedKeysFromWeekItems } from "../utils/homeBookingState";
import "./HomePage.css";

/**
 * The redesigned home page (VITE_HOME_V2; otherwise App.jsx renders DashboardPage untouched).
 *
 * Order: Up next, Action needed, Your tennis circle, Players to hit with, Play this week,
 * Quick actions, Get better. Each section shows a skeleton while it loads and renders nothing
 * when it comes back empty, except Up next, which has an empty state.
 */
export default function HomePage() {
  const { user } = useAuth();
  const viewerId = readViewerId(user);
  const navigate = useNavigate();

  const { ratingState } = useLadderStanding(viewerId);
  // Only consulted while unranked, so it is not fetched for a rated player.
  const { declaredLevel } = useDeclaredLevel(ratingState === "rated");

  // The week, from My Week's shared load whether or not the My Week tab is on: Up next, the
  // "You're in" pills and the tab all read the same list.
  const myWeekOn = isMyWeekEnabled();
  const week = useMyWeek({ enabled: true });
  const bookedKeys = useMemo(
    () => bookedKeysFromWeekItems([...week.days.flatMap((day) => day.items), ...week.later]),
    [week.days, week.later],
  );

  const { alerts, restringOrders, loading: alertsLoading } = useHomeAlerts();
  const playedSinceRestring = useRestringActivity(restringOrders);
  const { items: invites, loading: invitesLoading } = useHomeInvites();
  const { seasons, loading: seasonsLoading } = useActiveSeasons(user);
  const actionRows = useMemo(
    () => buildActionRows({ invites, alerts, restringOrders, playedSinceRestring }),
    [invites, alerts, restringOrders, playedSinceRestring],
  );

  const { rows: circleRows, loading: circleLoading } = usePlayerCircle(viewerId);
  const {
    items: feedItems,
    windowStart,
    windowEnd,
    myCoachIds,
    loading: feedLoading,
  } = useActivityFeed();
  const { tip } = useTipOfDay();

  // "Players to hit with" (VITE_HOME_FIND_PLAYERS). Connect is Find Players' own, through the
  // shared hook; it also loads the viewer's match profile, which the suggestions read.
  const findPlayersOn = isHomeFindPlayersEnabled();
  const connect = usePlayerConnect({ enabled: findPlayersOn, source: "home" });
  const homePlayers = useHomePlayers({
    enabled: findPlayersOn,
    token: connect.playerToken,
    viewer: connect.matchProfile,
    viewerLoaded: connect.matchProfileCheckLoaded,
  });

  const scrollToPlay = () =>
    document.getElementById(PLAY_THIS_WEEK_ID)?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <div className="player-home home-v2">
      <AppNav homeHeader hideMobileNewMatch hideMobileNotifications />
      <ActionGrid />

      <main className="home-v2__main">
        <UpNext
          days={week.days}
          loading={week.loading}
          weekHref={myWeekOn ? "/my-week" : "/player/calendar"}
          weekLabel={myWeekOn ? "My week" : "Schedule"}
          onFindSomething={scrollToPlay}
        />

        <ActionNeeded
          seasons={seasons}
          rows={actionRows}
          ratingState={ratingState}
          declaredLevel={declaredLevel}
          loading={seasonsLoading || invitesLoading || alertsLoading}
        />

        {/* Friends' games first, then classes from your coaches. */}
        <TennisCircle rows={circleRows} loading={circleLoading} bookedKeys={bookedKeys} />

        {findPlayersOn ? (
          <PlayersToHitWith
            state={homePlayers}
            onConnect={connect.openConnect}
            onViewProfile={(player) => navigate(`/players/${player.id}`, { state: { player } })}
          />
        ) : null}

        <ActivityFeed
          items={feedItems}
          windowStart={windowStart}
          windowEnd={windowEnd}
          myCoachIds={myCoachIds}
          loading={feedLoading}
          bookedKeys={bookedKeys}
          viewerId={viewerId}
        />


        <OffCourt tip={tip} />
      </main>

      {findPlayersOn ? connect.modals : null}

      <MobileHomeBottomNav />
    </div>
  );
}
