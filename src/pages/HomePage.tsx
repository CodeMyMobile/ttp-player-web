import { useState } from "react";
import AppNav from "../components/AppNav";
import MobileHomeBottomNav from "../components/MobileHomeBottomNav";
import { ActionGrid } from "../components/home/ActionGrid";
import { AlertStack } from "../components/home/AlertStack";
import { InviteCard } from "../components/home/InviteCard";
import { StatusTiles } from "../components/home/StatusTiles";
import { TodayRow } from "../components/home/TodayRow";
import { useAuth } from "../context/AuthContext";
import {
  readViewerId,
  useHomeAlerts,
  useHomeInvites,
  useLadderStanding,
  useWeekBookings,
} from "../hooks/useHomeStatus";
import { acceptInvite, rejectInvite } from "../services/invites";
import type { HomeInviteItem } from "../utils/homeInvite";
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

  const { rating, isRated, positionLabel } = useLadderStanding(viewerId);
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

  return (
    <div className="player-home home-v2">
      <AppNav hideMobileNewMatch hideMobileNotifications />

      <main className="home-v2__main">
        <StatusTiles
          rating={rating}
          isRated={isRated}
          positionLabel={positionLabel}
          bookingsCount={count}
          nextBookingLabel={nextLabel}
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

        <ActionGrid isRated={isRated} />
      </main>

      <MobileHomeBottomNav />
    </div>
  );
}
