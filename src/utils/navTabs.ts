/**
 * The app's primary destinations, shared by the mobile bottom nav and the desktop top nav.
 * With My Week on (featureFlags.isMyWeekEnabled), Schedule becomes My Week and Leagues moves
 * under Play, alongside match play and the ladder. Icons and click handling stay with each nav.
 */

export const MY_WEEK_PATH = "/my-week";
export const PLAY_PATH = "/play";
export const SCHEDULE_PATH = "/player/calendar";

export type NavTabKey = "home" | "coaches" | "leagues" | "schedule" | "play" | "my-week";

export interface NavTab {
  key: NavTabKey;
  label: string;
  /** Where the tab goes. Leagues has none: it picks a league first (leaguesDestination). */
  to?: string;
  /** Paths (and anything under them) that light the tab up. */
  match: string[];
}

/** `playSections`: home v2's Play tab also holds Group lessons and Find players (utils/playSections). */
export const primaryNavTabs = (myWeek: boolean, playSections = false): NavTab[] =>
  myWeek
    ? [
        { key: "home", label: "Home", to: "/", match: ["/", "/restring"] },
        { key: "coaches", label: "Coaches", to: "/my-coaches", match: ["/my-coaches"] },
        {
          key: "play",
          label: "Play",
          to: PLAY_PATH,
          match: [
            PLAY_PATH,
            "/matches",
            "/leagues",
            "/ladder",
            "/log-result",
            ...(playSections ? ["/group-lessons", "/find-players"] : []),
          ],
        },
        { key: "my-week", label: "My Week", to: MY_WEEK_PATH, match: [MY_WEEK_PATH, SCHEDULE_PATH] },
      ]
    : [
        { key: "home", label: "Home", to: "/", match: ["/", "/restring"] },
        { key: "coaches", label: "Coaches", to: "/my-coaches", match: ["/my-coaches"] },
        { key: "leagues", label: "Leagues", match: ["/leagues"] },
        { key: "schedule", label: "Schedule", to: SCHEDULE_PATH, match: [SCHEDULE_PATH] },
      ];

/** Whether `pathname` is one of `match` or under one. "/" only matches itself. */
export const isTabActive = (pathname: string, match: string[]): boolean =>
  match.some((path) =>
    path === "/" ? pathname === "/" : pathname === path || pathname.startsWith(`${path}/`),
  );

/** One league → its dashboard; none or several → the leagues list, which acts as the picker. */
export const leaguesDestination = (leagues: { id: number | string }[] | null | undefined): string =>
  Array.isArray(leagues) && leagues.length === 1 ? `/leagues/${leagues[0].id}/dashboard` : "/leagues";
