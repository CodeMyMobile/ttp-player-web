import AppNav from "../components/AppNav";
import MobileHomeBottomNav from "../components/MobileHomeBottomNav";
import { StatusTiles } from "../components/home/StatusTiles";
import { useAuth } from "../context/AuthContext";
import { readViewerId, useLadderStanding, useWeekBookings } from "../hooks/useHomeStatus";
import "./HomePage.css";

/**
 * The redesigned home page, built to the state mockups in docs/.
 *
 * Reached only when VITE_HOME_V2 is on; otherwise App.jsx renders the existing
 * DashboardPage untouched. Sections land one PR at a time — this is PR 1
 * (header and status tiles), so the page is deliberately short.
 */
export default function HomePage() {
  const { user } = useAuth();
  const viewerId = readViewerId(user);

  const { rating, isRated, positionLabel } = useLadderStanding(viewerId);
  // No point counting bookings for a player we won't show the tile to.
  const { count, nextLabel } = useWeekBookings(!isRated);

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
      </main>

      <MobileHomeBottomNav />
    </div>
  );
}
