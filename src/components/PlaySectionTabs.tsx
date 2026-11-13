import { Link, useLocation } from "react-router-dom";

import { activePlaySection, isPlaySectionsEnabled, PLAY_SECTIONS } from "../utils/playSections";

import "./PlaySectionTabs.css";

/**
 * The Play tab's switcher, Matches · Lessons · Leagues · Players, at the top of each of those
 * pages (utils/playSections). Draws nothing unless home v2 and My Week are both on.
 */
const PlaySectionTabs = () => {
  const { pathname } = useLocation();
  if (!isPlaySectionsEnabled()) return null;
  const active = activePlaySection(pathname);

  return (
    <nav className="play-sections" aria-label="Play">
      {PLAY_SECTIONS.map((section) => (
        <Link
          key={section.key}
          to={section.path}
          className={`play-sections__item${section.key === active ? " is-active" : ""}`}
          aria-current={section.key === active ? "page" : undefined}
        >
          {section.label}
        </Link>
      ))}
    </nav>
  );
};

export default PlaySectionTabs;
