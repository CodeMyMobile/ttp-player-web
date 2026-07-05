// Mobile-only persistent segmented section-nav.
//
// Pinned directly under the app nav (sticky top:64px — the AppNav mobile
// min-height). This is the ONLY tab bar on mobile: it drives both the activation
// "Overview" stack AND the LeagueTabs panels (which render with hideTabBar). Five
// labels are tight, so the row scrolls horizontally and never wraps. Uses the
// existing violet `.tab`/`.tab.on` styling for visual continuity with desktop.

import { useRef } from "react";

import type { TabKey } from "./types";

// Local key adds the "overview" activation section alongside the four data tabs.
export type SectionKey = "overview" | TabKey;

const SECTIONS: Array<{ key: SectionKey; label: string }> = [
  { key: "overview", label: "Overview" },
  { key: "standings", label: "Standings" },
  { key: "players", label: "Players" },
  { key: "results", label: "Results" },
  { key: "pending", label: "Pending" },
];

interface SectionNavProps {
  section: SectionKey;
  onChange: (section: SectionKey) => void;
}

const SectionNav = ({ section, onChange }: SectionNavProps) => {
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const focusTab = (index: number) => {
    const count = SECTIONS.length;
    const next = (index + count) % count;
    tabRefs.current[next]?.focus();
    onChange(SECTIONS[next].key);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      focusTab(index + 1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      focusTab(index - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      focusTab(0);
    } else if (event.key === "End") {
      event.preventDefault();
      focusTab(SECTIONS.length - 1);
    }
  };

  return (
    <nav className="section-nav" aria-label="League sections">
      <div className="section-nav__row" role="tablist" aria-label="League sections">
        {SECTIONS.map((item, index) => {
          const active = section === item.key;
          return (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={active}
              tabIndex={active ? 0 : -1}
              ref={(el) => {
                tabRefs.current[index] = el;
              }}
              className={`tab${active ? " on" : ""}`}
              onClick={() => onChange(item.key)}
              onKeyDown={(event) => onKeyDown(event, index)}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default SectionNav;
