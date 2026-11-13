import { GraduationCap, Trophy, UserSearch, Wrench } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { ANALYTICS_EVENTS, track } from "../../utils/analytics";

interface Shortcut {
  key: "lessons" | "leagues" | "players" | "restring";
  label: string;
  to: string;
  icon: LucideIcon;
}

// Exactly four, one word each. Lessons, Leagues and Players open that section of the Play tab
// (each section is its own page, utils/playSections); Restring is a service with no tab.
// Coaches isn't here: it's a tab.
const SHORTCUTS: Shortcut[] = [
  { key: "lessons", label: "Lessons", to: "/group-lessons", icon: GraduationCap },
  { key: "leagues", label: "Leagues", to: "/leagues", icon: Trophy },
  { key: "players", label: "Players", to: "/find-players", icon: UserSearch },
  { key: "restring", label: "Restring", to: "/restring", icon: Wrench },
];

/** Home's shortcut row: a white band under the header. */
export function ActionGrid() {
  return (
    <nav className="home-shortcuts" aria-label="Shortcuts">
      <div className="home-shortcuts__row">
        {SHORTCUTS.map(({ key, label, to, icon: Icon }) => (
          <Link
            key={key}
            className="home-shortcuts__item"
            to={to}
            onClick={() => track(ANALYTICS_EVENTS.homeShortcutTap, { item: key })}
          >
            <span className="home-shortcuts__tile" aria-hidden="true">
              <Icon size={24} strokeWidth={1.9} />
            </span>
            <span className="home-shortcuts__label">{label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
