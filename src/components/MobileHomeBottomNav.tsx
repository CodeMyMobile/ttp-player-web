import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  CalendarPlus,
  ClipboardList,
  Dumbbell,
  GraduationCap,
  Home,
  Plus,
  Search,
  Trophy,
  UserSearch,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import { listMyLeagues } from "../api/leagues";
import { useAuth } from "../context/AuthContext";
import { getStoredAuthToken } from "../services/authToken";
import { isMyWeekEnabled } from "../utils/featureFlags";
import { isTabActive, leaguesDestination, primaryNavTabs, type NavTabKey } from "../utils/navTabs";
import { badgeLabel, useMyWeekBadge } from "../features/myWeek/useMyWeek";
import {
  bookLessonDestination,
  plusSheetActions,
  PLUS_ACTION_PATHS,
  workoutDestination,
  type PlusAction,
  type PlusActionKey,
} from "../features/myWeek/plusSheet";
import { readPlanProgress } from "../features/myWeek/trainingPlanProgress";
import { WEEK_TYPE_COLORS } from "../features/myWeek/typeColors";
import { getPlayerCoaches } from "../api/playerCalendar";
import { ANALYTICS_EVENTS, track } from "../utils/analytics";
import { todayYmd } from "../utils/dateTime";

import "./MobileHomeBottomNav.css";

// Global mobile bottom navigation — 5 slots with a center FAB:
//   [ Home ] [ Coaches ] [ + ] [ Leagues ] [ Schedule ]
//   [ Home ] [ Coaches ] [ + ] [ Play ] [ My Week ]   (My Week on: utils/navTabs, features/myWeek/plusSheet)
// The four tabs are role="tab"; the "+" is a plain button that opens the
// quick-action sheet. Mobile-only (CSS hides it >=768px). Rendered by
// MainLayout when mobileChrome="home" (and directly by the matches shell).

type TabDef = {
  key: string;
  label: string;
  icon: LucideIcon;
  // Simple route tabs navigate straight to `to`; Leagues resolves at click time.
  to?: string;
  // Active when the current path matches one of these prefixes.
  match: string[];
  onClick?: () => void;
};

const ACTION_ICONS: Record<PlusActionKey, LucideIcon> = {
  newMatch: CalendarPlus,
  findPlayers: UserSearch,
  bookLesson: GraduationCap,
  addWorkout: Dumbbell,
  createMatch: CalendarPlus,
  logScore: ClipboardList,
  findMatch: Search,
};

const QuickActionSheet = ({
  actions,
  onClose,
  onAction,
}: {
  actions: PlusAction[];
  onClose: () => void;
  onAction: (key: PlusActionKey) => void;
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
        {actions.map((action) => {
          const Icon = ACTION_ICONS[action.key];
          const color = action.type ? WEEK_TYPE_COLORS[action.type] : null;
          return (
            <button key={action.key} type="button" className="mbn-sheet__action" onClick={() => onAction(action.key)}>
              <span
                className="mbn-sheet__action-icon"
                style={color ? { background: color.soft, color: color.solid } : undefined}
              >
                <Icon size={20} />
              </span>
              {action.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};

const TAB_ICONS: Record<NavTabKey, LucideIcon> = {
  home: Home,
  coaches: Users,
  leagues: Trophy,
  schedule: CalendarDays,
  play: Trophy,
  "my-week": CalendarDays,
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
    navigate(leaguesDestination(await resolveLeagues()));
  }, [navigate, resolveLeagues]);

  // The + sheet (features/myWeek/plusSheet). Book a lesson and Add a workout are decided when
  // tapped: the player's coaches, and where they are in the training plan.
  const onPlusAction = useCallback(
    async (key: PlusActionKey) => {
      setSheetOpen(false);
      track(ANALYTICS_EVENTS.plusSheetAction, { action: key, myWeekVersion: isMyWeekEnabled() ? "v1" : "off" });
      if (key === "bookLesson") {
        const coaches = await getPlayerCoaches({ perPage: 25, page: 1 }).catch(() => []);
        navigate(bookLessonDestination(coaches));
        return;
      }
      if (key === "addWorkout") {
        navigate(workoutDestination(readPlanProgress(), todayYmd()));
        return;
      }
      const path = PLUS_ACTION_PATHS[key];
      if (path) navigate(path);
    },
    [navigate],
  );

  const isActive = (prefixes: string[]) => isTabActive(location.pathname, prefixes);

  // Play and My Week replace Leagues and Schedule while My Week is on (utils/navTabs).
  const myWeekOn = isMyWeekEnabled();
  // Things only this player can answer: invites, stale invites they sent, league matches due.
  const waitingCount = useMyWeekBadge(myWeekOn && Boolean(token));
  const tabs: TabDef[] = primaryNavTabs(myWeekOn).map((tab) => ({
    ...tab,
    icon: TAB_ICONS[tab.key],
    onClick: tab.key === "leagues" ? goLeagues : undefined,
  }));

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
          {tab.key === "my-week" && waitingCount > 0 ? (
            <span className="mbn__badge" aria-label={`${waitingCount} waiting on you`}>
              {badgeLabel(waitingCount)}
            </span>
          ) : null}
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
            aria-label="Plan"
            aria-haspopup="dialog"
            aria-expanded={sheetOpen}
            onClick={() => setSheetOpen(true)}
          >
            <Plus size={28} />
          </button>
          {/* Visible name for the + so it reads as a tab like the others; the button carries
              the same name for screen readers. */}
          <span className="mbn__label mbn__fab-label" aria-hidden="true">
            Plan
          </span>
        </div>
        {renderTab(tabs[2])}
        {renderTab(tabs[3])}
      </nav>

      {sheetOpen ? (
        <QuickActionSheet
          actions={plusSheetActions(myWeekOn)}
          onClose={() => setSheetOpen(false)}
          onAction={(key) => void onPlusAction(key)}
        />
      ) : null}
    </>
  );
};

export default MobileHomeBottomNav;
