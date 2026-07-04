// League switcher: title-as-trigger + "Switch league" chip opening a dropdown
// with "Your league" / "Archived" sections. Esc + outside-click close it, the
// trigger carries aria-haspopup/aria-expanded, and menu items support roving
// arrow-key focus. Selecting a league navigates to its dashboard route so the
// whole page repopulates (not just this header).

import { useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";

import Icon from "./Icon";
import type { LeagueSummary } from "./types";

interface LeagueSwitcherProps {
  active: LeagueSummary;
  leagues: LeagueSummary[];
}

const LeagueSwitcher = ({ active, leagues }: LeagueSwitcherProps) => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const activeLeagues = leagues.filter((league) => !league.archived);
  const archivedLeagues = leagues.filter((league) => league.archived);
  // Menu render order matches the visual order so roving focus is intuitive.
  const ordered = [...activeLeagues, ...archivedLeagues];

  const close = useCallback(() => setOpen(false), []);

  const select = useCallback(
    (id: string) => {
      close();
      if (id !== active.id) navigate(`/leagues/${id}/dashboard`);
    },
    [active.id, close, navigate],
  );

  // Outside-click + Esc to close.
  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) close();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close();
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  // On open, move focus into the menu (roving focus starts at the first item).
  useEffect(() => {
    if (open) itemRefs.current[0]?.focus();
  }, [open]);

  const focusItem = (index: number) => {
    const count = ordered.length;
    const next = (index + count) % count;
    itemRefs.current[next]?.focus();
  };

  const onItemKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusItem(index + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      focusItem(index - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      focusItem(0);
    } else if (event.key === "End") {
      event.preventDefault();
      focusItem(ordered.length - 1);
    }
  };

  const renderRow = (league: LeagueSummary, index: number) => {
    const isCurrent = league.id === active.id;
    return (
      <button
        key={league.id}
        type="button"
        role="menuitem"
        ref={(el) => {
          itemRefs.current[index] = el;
        }}
        className={`lm-row${isCurrent ? " current" : ""}${league.archived ? " arch" : ""}`}
        onClick={() => select(league.id)}
        onKeyDown={(event) => onItemKeyDown(event, index)}
      >
        <span className="lm-ic">
          <Icon name={league.archived ? "archive" : "ball-tennis"} />
        </span>
        <span className="lm-info">
          <span className="lm-name">
            {league.name}
            {isCurrent ? <span className="cur">Current</span> : null}
          </span>
          <span className="lm-lvl">{league.level}</span>
        </span>
        <span className={`lm-status st-${league.status.tone}`}>{league.status.label}</span>
      </button>
    );
  };

  return (
    <div className="league-switch" ref={rootRef}>
      <div className="eyebrow">{active.eyebrow}</div>
      <h1 className="league-h1">
        <button
          type="button"
          ref={triggerRef}
          className="league-trigger"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          <span>{active.name}</span>
          <span className="switch-badge">
            <Icon name="chevron-down" className="chev" />
            Switch league
          </span>
        </button>
      </h1>
      <div className="sub">{active.sub}</div>

      {open ? (
        <div className="league-menu" role="menu" aria-label="Switch league">
          <div className="lm-head">Your league</div>
          {activeLeagues.map((league) => renderRow(league, ordered.indexOf(league)))}
          {archivedLeagues.length ? (
            <>
              <div className="lm-head" style={{ marginTop: 2 }}>
                Archived
              </div>
              {archivedLeagues.map((league) => renderRow(league, ordered.indexOf(league)))}
            </>
          ) : null}
          <button type="button" className="lm-all" onClick={() => navigate("/leagues")}>
            View all leagues <Icon name="arrow-right" />
          </button>
        </div>
      ) : null}
    </div>
  );
};

export default LeagueSwitcher;
