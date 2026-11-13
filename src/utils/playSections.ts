/**
 * The Play tab's four sections (home v2 + My Week): Matches · Lessons · Leagues · Players.
 *
 * Each section is an existing page, so a section is a route: the switcher at the top of each
 * page moves between them, and /play?section=<key> is the deep link that lands on one
 * (home's shortcuts, "See all" links). The ladder belongs to Leagues, as its pinned card.
 */
import { isHomeV2Enabled, isMyWeekEnabled } from "./featureFlags";

export type PlaySectionKey = "matches" | "lessons" | "leagues" | "players";

export interface PlaySection {
  key: PlaySectionKey;
  label: string;
  path: string;
  /** Other paths that belong to the section (and anything under them). */
  alsoAt: string[];
}

export const PLAY_SECTIONS: PlaySection[] = [
  { key: "matches", label: "Matches", path: "/matches", alsoAt: [] },
  { key: "lessons", label: "Lessons", path: "/group-lessons", alsoAt: [] },
  { key: "leagues", label: "Leagues", path: "/leagues", alsoAt: ["/ladder"] },
  { key: "players", label: "Players", path: "/find-players", alsoAt: [] },
];

/** The sections need both: My Week puts Play in the tab bar, home v2 splits it into four. */
export const isPlaySectionsEnabled = (): boolean => isHomeV2Enabled() && isMyWeekEnabled();

/** A deep link into one section; extra params pass through to its page (?radius=15). */
export const playSectionHref = (key: PlaySectionKey, params: Record<string, string> = {}): string => {
  const search = new URLSearchParams({ section: key, ...params });
  return `/play?${search.toString()}`;
};

/**
 * Where /play?section=… lands: the section's page, carrying any other params. An unknown or
 * missing section opens Matches.
 */
export const playSectionDestination = (search: string): string => {
  const params = new URLSearchParams(search);
  const section = PLAY_SECTIONS.find((item) => item.key === params.get("section")) ?? PLAY_SECTIONS[0];
  params.delete("section");
  const rest = params.toString();
  return rest ? `${section.path}?${rest}` : section.path;
};

const isAt = (pathname: string, path: string) => pathname === path || pathname.startsWith(`${path}/`);

/** The section a page belongs to, for the switcher's highlight; null when it's none of them. */
export const activePlaySection = (pathname: string): PlaySectionKey | null =>
  PLAY_SECTIONS.find((section) => [section.path, ...section.alsoAt].some((path) => isAt(pathname, path)))?.key ??
  null;
