import { GraduationCap, ListOrdered, Swords, Trophy, Users, Wrench } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";

interface ActionGridProps {
  /** From useLadderStanding in HomePage — passed down so the rankings call isn't made twice. */
  isRated: boolean;
}

interface Action {
  label: string;
  to: string;
  icon: LucideIcon;
  /** Needs a rating to be useful. */
  gated?: boolean;
}

// One icon family throughout (lucide), matching the mockups.
//
// Ladder is the only gated tile. "Join a league" deliberately is NOT, even
// though cold.html dims it: league enrolment is what seeds current_rating
// (ttp-api league_enrollment.js:365-371), so gating it would seal an unrated
// player into the cold state with no way out. See §0.4 of the backend audit.
//
// Note "Join a league" goes to league browse, while the Leagues tab in
// MobileHomeBottomNav resolves to a player's own dashboard when they're in
// exactly one league — different destinations by design.
const ACTIONS: Action[] = [
  { label: "Find a coach", to: "/find-coaches", icon: GraduationCap },
  { label: "Group lessons", to: "/group-lessons", icon: Users },
  { label: "Match play", to: "/matches", icon: Swords },
  { label: "Join a league", to: "/leagues", icon: Trophy },
  { label: "Restring", to: "/restring", icon: Wrench },
  { label: "Ladder", to: "/ladder", icon: ListOrdered, gated: true },
];

export function ActionGrid({ isRated }: ActionGridProps) {
  return (
    <nav className="home-grid" aria-label="Quick actions">
      {ACTIONS.map(({ label, to, icon: Icon, gated }) => {
        const locked = Boolean(gated) && !isRated;

        if (locked) {
          return (
            <button
              key={label}
              type="button"
              className="home-grid__tile home-grid__tile--locked"
              disabled
              aria-disabled="true"
              // Explains the dimming to anyone who can't see it.
              title="Available once you have a rating"
            >
              <Icon className="home-grid__icon" size={24} aria-hidden="true" />
              <span className="home-grid__label">{label}</span>
            </button>
          );
        }

        return (
          <Link key={label} className="home-grid__tile" to={to}>
            <Icon className="home-grid__icon" size={24} aria-hidden="true" />
            <span className="home-grid__label">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
