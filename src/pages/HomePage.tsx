import { useState } from "react";
import { useNavigate } from "react-router-dom";
import AppNav from "../components/AppNav";
import MobileHomeBottomNav from "../components/MobileHomeBottomNav";
import { ActionGrid } from "../components/home/ActionGrid";
import { ActivityFeed } from "../components/home/ActivityFeed";
import { AlertStack } from "../components/home/AlertStack";
import { FindPlayersTile } from "../components/home/FindPlayersTile";
import { InviteCard } from "../components/home/InviteCard";
import { OffCourt } from "../components/home/OffCourt";
import { PlayersToHitWith } from "../components/home/PlayersToHitWith";
import { SeasonModule } from "../components/home/SeasonModule";
import { StatusTiles } from "../components/home/StatusTiles";
import { TodayRow } from "../components/home/TodayRow";
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
  useWeekBookings,
} from "../hooks/useHomeStatus";
import { acceptInvite, rejectInvite } from "../services/invites";
import { isHomeFindPlayersEnabled } from "../utils/featureFlags";
import type { HomeInviteItem } from "../utils/homeInvite";
import { findPlayersTilePlacement } from "../utils/homeTiles";
import "./HomePage.css";

/**
 * The redesigned home page, built to the state mockups in docs/home-states/.
 *
 * Reached only when VITE_HOME_V2 is on; otherwise App.jsx renders the existing
 * DashboardPage untouched. Sections land one PR at a time, so the page stays
 * shorter than the mockups until the sequence finishes; what has shipped is
 * whatever this component renders below.
 */
export default function HomePage() {
  const { user } = useAuth();
  const viewerId = readViewerId(user);

  const { rating, ratingState, positionLabel } = useLadderStanding(viewerId);
  // Only consulted while unranked, so it is not fetched for a rated player.
  const { declaredLevel } = useDeclaredLevel(ratingState === "rated");
  // Always fetched, never gated on the rating: an unrated player with a
  // standing weekly lesson has real bookings and needs to see them.
  const { count, nextLabel, today } = useWeekBookings();
  const { alerts } = useHomeAlerts();
  const { invite, remaining, refetch: refetchInvites } = useHomeInvites();

  const [inviteBusy, setInviteBusy] = useState(false);

  // Both actions refetch rather than removing the card locally: the next invite
  // has to slide into the slot, and the count behind it has to be right. An
  // optimistic removal would have to guess both.
  const respond = async (
    action: (token: string) => Promise<unknown>,
    item: HomeInviteItem,
  ) => {
    if (!item.token || inviteBusy) return;
    setInviteBusy(true);
    try {
      await action(item.token);
      await refetchInvites();
    } finally {
      setInviteBusy(false);
    }
  };

  const {
    items: feedItems,
    windowStart,
    windowEnd,
    myCoachIds,
    loading: feedLoading,
  } = useActivityFeed();
  const { seasons } = useActiveSeasons(user);
  const { tip } = useTipOfDay();

  // "Players to hit with" and the compact Find players tile (VITE_HOME_FIND_PLAYERS).
  // Connect is Find Players' own, through the shared hook; it also loads the viewer's
  // match profile, which is where the suggestions read their level from.
  const findPlayersOn = isHomeFindPlayersEnabled();
  const navigate = useNavigate();
  const connect = usePlayerConnect({ enabled: findPlayersOn, source: "home" });
  const homePlayers = useHomePlayers({
    enabled: findPlayersOn,
    token: connect.playerToken,
    viewer: connect.matchProfile,
    viewerLoaded: connect.matchProfileCheckLoaded,
  });
  const tilePlacement = findPlayersOn ? findPlayersTilePlacement({ ratingState, bookingsCount: count }) : null;

  return (
    <div className="player-home home-v2">
      <AppNav hideMobileNewMatch hideMobileNotifications />

      <main className="home-v2__main">
        <StatusTiles
          rating={rating}
          ratingState={ratingState}
          positionLabel={positionLabel}
          bookingsCount={count}
          nextBookingLabel={nextLabel}
          declaredLevel={declaredLevel}
          findPlayersTile={
            tilePlacement === "row" ? <FindPlayersTile state={homePlayers} placement="row" /> : null
          }
        />

        {/* The mockups' order: tiles, today row, invite card, alerts, grid.
            Each section renders nothing when it has nothing, so the grid moves
            up rather than a gap opening. */}
        <TodayRow booking={today} />

        <InviteCard
          invite={invite}
          remaining={remaining}
          busy={inviteBusy}
          onAccept={(item) => respond(acceptInvite, item)}
          onDecline={(item) => respond(rejectInvite, item)}
        />

        <AlertStack alerts={alerts} />

        <ActionGrid
          ratingState={ratingState}
          lockedLadderReplacement={
            tilePlacement === "grid" ? <FindPlayersTile state={homePlayers} placement="grid" /> : null
          }
        />

        {findPlayersOn ? (
          <PlayersToHitWith
            state={homePlayers}
            onConnect={connect.openConnect}
            onViewProfile={(player) => navigate(`/players/${player.id}`, { state: { player } })}
          />
        ) : null}

        {/* Season, then the feed. Every mockup puts "Play this week" last;
            off court (PR 8) will sit between these two when it lands. */}
        <SeasonModule seasons={seasons} />

        <OffCourt tip={tip} />

        <ActivityFeed
          items={feedItems}
          windowStart={windowStart}
          windowEnd={windowEnd}
          myCoachIds={myCoachIds}
          loading={feedLoading}
        />


      </main>

      {findPlayersOn ? connect.modals : null}

      <MobileHomeBottomNav />
    </div>
  );
}
