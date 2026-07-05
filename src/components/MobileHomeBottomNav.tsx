import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, Home, Plus, ClipboardList, Search, Trophy, Users } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import { listMyLeagues } from "../api/leagues";
import { useAuth } from "../context/AuthContext";
import { getStoredAuthToken } from "../services/authToken";

import "./MobileHomeBottomNav.css";

// Global mobile bottom navigation — 5 slots with a center FAB:
//   [ Home ] [ Coaches ] [ + ] [ Leagues ] [ Schedule ]
// The four tabs are role="tab"; the "+" is a plain button that opens the
// quick-action sheet. Mobile-only (CSS hides it >=768px). Rendered by
// MainLayout when mobileChrome="home" (and directly by the matches shell).

type TabDef = {
  key: string;
  label: string;
  icon: typeof Home;
  // Simple route tabs navigate straight to `to`; Leagues resolves at click time.
  to?: string;
  // Active when the current path matches one of these prefixes.
  match: string[];
  onClick?: () => void;
};

const QuickActionSheet = ({
  onClose,
  onLogScore,
  onFindMatch,
}: {
  onClose: () => void;
  onLogScore: () => void;
  onFindMatch: () => void;
}) => {
  const sheetRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef<number | null>(null);

  // Focus-trap: focus the first action on open, restore to the opener on close.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const first = sheetRef.current?.querySelector<HTMLElement>(".mbn-sheet__action");
    first?.focus();
    return () => opener?.focus?.();
  }, []);

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = sheetRef.current?.querySelectorAll<HTMLElement>(
      'button, [href], [tabindex]:not([tabindex="-1"])',
    );
    if (!focusable || focusable.length === 0) return;
    const list = Array.from(focusable);
    const firstEl = list[0];
    const lastEl = list[list.length - 1];
    const active = document.activeElement as HTMLElement | null;
    if (event.shiftKey && active === firstEl) {
      event.preventDefault();
      lastEl.focus();
    } else if (!event.shiftKey && active === lastEl) {
      event.preventDefault();
      firstEl.focus();
    }
  };

  // Swipe-down to dismiss.
  const onTouchStart = (event: React.TouchEvent) => {
    touchStartY.current = event.touches[0]?.clientY ?? null;
  };
  const onTouchEnd = (event: React.TouchEvent) => {
    if (touchStartY.current == null) return;
    const delta = (event.changedTouches[0]?.clientY ?? 0) - touchStartY.current;
    touchStartY.current = null;
    if (delta > 60) onClose();
  };

  return (
    <div
      className="mbn-sheet-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      onTouchEnd={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={sheetRef}
        className="mbn-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Quick actions"
        onKeyDown={onKeyDown}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <div className="mbn-sheet__handle" aria-hidden="true" />
        <p className="mbn-sheet__title">Quick actions</p>
        <button type="button" className="mbn-sheet__action" onClick={onLogScore}>
          <span className="mbn-sheet__action-icon">
            <ClipboardList size={20} />
          </span>
          Log a Score
        </button>
        <button type="button" className="mbn-sheet__action" onClick={onFindMatch}>
          <span className="mbn-sheet__action-icon">
            <Search size={20} />
          </span>
          Find a Match
        </button>
      </div>
    </div>
  );
};

const MobileHomeBottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [sheetOpen, setSheetOpen] = useState(false);

  const token = useMemo(
    () =>
      user?.session?.access_token ??
      user?.access_token ??
      user?.token ??
      getStoredAuthToken({ preferScheme: "token" }) ??
      undefined,
    [user],
  );

  // Resolve the player's league context the same way the Leagues tab does:
  // exactly one league → that league; zero or many → the /leagues list acts as
  // the picker. Fails open to the list on error.
  const resolveLeagues = useCallback(async () => {
    try {
      const res = await listMyLeagues({ token });
      return res.leagues ?? [];
    } catch {
      return [];
    }
  }, [token]);

  // Leagues tab: 1 league → straight to its dashboard; else → the list picker.
  const goLeagues = useCallback(async () => {
    const leagues = await resolveLeagues();
    if (leagues.length === 1) navigate(`/leagues/${leagues[0].id}/dashboard`);
    else navigate("/leagues");
  }, [navigate, resolveLeagues]);

  // "+" sheet → Log a Score. Single league → the league detail score drawer
  // (openScore router state, same channel the dashboard uses). FLAG: multi-league
  // routes to /leagues first because the score flow is per-league.
  const goLogScore = useCallback(async () => {
    setSheetOpen(false);
    const leagues = await resolveLeagues();
    if (leagues.length === 1) {
      const id = leagues[0].id;
      navigate(`/leagues/${id}`, { state: { openScore: true, returnTo: `/leagues/${id}/dashboard` } });
    } else {
      navigate("/leagues");
    }
  }, [navigate, resolveLeagues]);

  // "+" sheet → Find a Match. Single league → Post Availability. FLAG:
  // multi-league routes to /leagues first to establish context.
  const goFindMatch = useCallback(async () => {
    setSheetOpen(false);
    const leagues = await resolveLeagues();
    if (leagues.length === 1) {
      const id = leagues[0].id;
      navigate(`/leagues/${id}/post-availability`, { state: { returnTo: `/leagues/${id}/dashboard` } });
    } else {
      navigate("/leagues");
    }
  }, [navigate, resolveLeagues]);

  const isActive = (prefixes: string[]) =>
    prefixes.some((p) => location.pathname === p || location.pathname.startsWith(`${p}/`));

  const tabs: TabDef[] = [
    // Home → landing dashboard later; stub for now.
    { key: "home", label: "Home", icon: Home, to: "/home", match: ["/home"] },
    // Coaches → coach list / rebook later; stub for now.
    { key: "coaches", label: "Coaches", icon: Users, to: "/coaches", match: ["/coaches"] },
    { key: "leagues", label: "Leagues", icon: Trophy, match: ["/leagues"], onClick: goLeagues },
    // Schedule → upcoming matches + lessons later; stub for now.
    { key: "schedule", label: "Schedule", icon: CalendarDays, to: "/schedule", match: ["/schedule"] },
  ];

  const renderTab = (tab: TabDef) => {
    const active = isActive(tab.match);
    const Icon = tab.icon;
    return (
      <button
        key={tab.key}
        type="button"
        role="tab"
        aria-selected={active}
        aria-label={tab.label}
        className={`mbn__tab${active ? " is-active" : ""}`}
        onClick={() => (tab.onClick ? tab.onClick() : tab.to && navigate(tab.to))}
      >
        <span className="mbn__icon">
          <Icon size={26} />
        </span>
        <span className="mbn__label">{tab.label}</span>
      </button>
    );
  };

  return (
    <>
      <nav className="mbn" role="tablist" aria-label="Mobile navigation">
        {renderTab(tabs[0])}
        {renderTab(tabs[1])}
        <div className="mbn__fab-slot">
          <button
            type="button"
            className="mbn__fab"
            aria-label="Create / quick action"
            aria-haspopup="dialog"
            aria-expanded={sheetOpen}
            onClick={() => setSheetOpen(true)}
          >
            <Plus size={28} />
          </button>
        </div>
        {renderTab(tabs[2])}
        {renderTab(tabs[3])}
      </nav>

      {sheetOpen ? (
        <QuickActionSheet
          onClose={() => setSheetOpen(false)}
          onLogScore={goLogScore}
          onFindMatch={goFindMatch}
        />
      ) : null}
    </>
  );
};

export default MobileHomeBottomNav;
