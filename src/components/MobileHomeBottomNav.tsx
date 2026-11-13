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
  Wrench,
  X,
  Swords,
  type LucideIcon,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import { listMyLeagues } from "../api/leagues";
import { useAuth } from "../context/AuthContext";
import { getStoredAuthToken } from "../services/authToken";
import { isHomeV2Enabled, isMyWeekEnabled } from "../utils/featureFlags";
import { isTabActive, leaguesDestination, primaryNavTabs, type NavTabKey } from "../utils/navTabs";
import { isPlaySectionsEnabled } from "../utils/playSections";
import { badgeLabel, useMyWeekBadge } from "../features/myWeek/useMyWeek";
import {
  bookLessonDestination,
  PLAN_BUTTON_LABEL,
  planSheetActions,
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
import { readViewerId, useLadderStanding } from "../hooks/useHomeStatus";

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
  bookRestring: Wrench,
  ladderChallenge: Swords,
};

const QuickActionSheet = ({
  actions,
  onClose,
  onAction,
  plan = false,
}: {
  actions: PlusAction[];
  onClose: () => void;
  onAction: (key: PlusActionKey) => void;
  /** Home v2's Plan sheet: a "Plan" title with a close button, and list rows with subtitles. */
  plan?: boolean;
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
        className={`mbn-sheet${plan ? " mbn-sheet--plan" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={plan ? "Plan" : "Quick actions"}
        onKeyDown={onKeyDown}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <div className="mbn-sheet__handle" aria-hidden="true" />
        {plan ? (
          <div className="mbn-sheet__head">
            <h2 className="mbn-sheet__heading">Plan</h2>
            <button type="button" className="mbn-sheet__close" aria-label="Close" onClick={onClose}>
              <X size={20} aria-hidden="true" />
            </button>
          </div>
        ) : (
          <p className="mbn-sheet__title">Quick actions</p>
        )}
        {actions.map((action) => {
          const Icon = ACTION_ICONS[action.key];
          const color = action.type ? WEEK_TYPE_COLORS[action.type] : null;
          return (
            <button key={action.key} type="button" className="mbn-sheet__action" onClick={() => onAction(action.key)}>
              <span
                className="mbn-sheet__action-icon"
                style={color ? { background: color.soft, color: color.solid } : undefined}
              >
                <Icon size={plan ? 22 : 20} />
              </span>
              {plan ? (
                <span className="mbn-sheet__action-text">
                  <span className="mbn-sheet__action-label">{action.label}</span>
                  {action.subtitle ? <span className="mbn-sheet__action-sub">{action.subtitle}</span> : null}
                </span>
              ) : (
                action.label
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

/**
 * The Plan sheet with its items. Mounted only while open, so the ladder standing behind the
 * challenge item is asked for when the sheet opens, not on every page that shows the tab bar.
 */
const PlanSheet = ({
  viewerId,
  onClose,
  onAction,
}: {
  viewerId: number | null;
  onClose: () => void;
  onAction: (key: PlusActionKey) => void;
}) => {
  const { ratingState } = useLadderStanding(viewerId);
  return (
    <QuickActionSheet
      plan
      actions={planSheetActions({ onLadder: ratingState === "rated" })}
      onClose={onClose}
      onAction={onAction}
    />
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
      track(ANALYTICS_EVENTS.planSheetTap, { item: key });
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

  // Home v2: the + has no visible label and opens the Plan sheet.
  const planOn = isHomeV2Enabled();
  const openSheet = () => {
    setSheetOpen(true);
    track(ANALYTICS_EVENTS.planSheetOpen);
  };

  // Play and My Week replace Leagues and Schedule while My Week is on (utils/navTabs).
  const myWeekOn = isMyWeekEnabled();
  // Things only this player can answer: invites, stale invites they sent, league matches due.
  const waitingCount = useMyWeekBadge(myWeekOn && Boolean(token));
  const tabs: TabDef[] = primaryNavTabs(myWeekOn, isPlaySectionsEnabled()).map((tab) => ({
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
        <div className={`mbn__fab-slot${planOn ? "" : " mbn__fab-slot--labeled"}`}>
          <button
            type="button"
            className="mbn__fab"
            aria-label={planOn ? PLAN_BUTTON_LABEL : "Plan"}
            aria-haspopup="dialog"
            aria-expanded={sheetOpen}
            onClick={openSheet}
          >
            <Plus size={28} />
          </button>
          {/* Home v2 drops the visible name; the button's label says what's inside. */}
          {planOn ? null : (
            <span className="mbn__label mbn__fab-label" aria-hidden="true">
              Plan
            </span>
          )}
        </div>
        {renderTab(tabs[2])}
        {renderTab(tabs[3])}
      </nav>

      {sheetOpen && planOn ? (
        <PlanSheet
          viewerId={readViewerId(user)}
          onClose={() => setSheetOpen(false)}
          onAction={(key) => void onPlusAction(key)}
        />
      ) : sheetOpen ? (
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
