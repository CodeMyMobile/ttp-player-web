import { Trophy, UserSearch, Users, Wrench } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";

interface Action {
  label: string;
  to: string;
  icon: LucideIcon;
}

// One row of four. Find a coach and Match play aren't here: the tab bar already has them.
// Leagues goes to league browse (league enrolment is what seeds a rating, so it's never
// gated); the Play tab is where a player's own leagues and the ladder live.
const ACTIONS: Action[] = [
  { label: "Restring", to: "/restring", icon: Wrench },
  { label: "Leagues", to: "/leagues", icon: Trophy },
  { label: "Find players", to: "/find-players", icon: UserSearch },
  { label: "Group lessons", to: "/group-lessons", icon: Users },
];

/** "Quick actions": the four places the tab bar doesn't reach. */
export function ActionGrid() {
  return (
    <section className="home-sec" aria-labelledby="home-quick-title">
      <div className="home-sec__head">
        <h2 id="home-quick-title" className="home-sec__title">
          Quick actions
        </h2>
      </div>
      <nav className="home-grid" aria-labelledby="home-quick-title">
        {ACTIONS.map(({ label, to, icon: Icon }) => (
          <Link key={label} className="home-grid__tile" to={to}>
            <Icon size={22} strokeWidth={1.8} aria-hidden="true" />
            <span className="home-grid__label">{label}</span>
          </Link>
        ))}
      </nav>
    </section>
  );
}
