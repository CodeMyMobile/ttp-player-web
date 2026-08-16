import AppNav from "../components/AppNav";
import MobileHomeBottomNav from "../components/MobileHomeBottomNav";
import { ActionGrid } from "../components/home/ActionGrid";
import { StatusTiles } from "../components/home/StatusTiles";
import { useAuth } from "../context/AuthContext";
import { readViewerId, useLadderStanding, useWeekBookings } from "../hooks/useHomeStatus";
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
  const { count, nextLabel } = useWeekBookings();

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

        <ActionGrid isRated={isRated} />
      </main>

      <MobileHomeBottomNav />
    </div>
  );
}
