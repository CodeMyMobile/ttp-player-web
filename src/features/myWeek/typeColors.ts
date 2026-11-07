import type { WeekItemType } from "./types";

/**
 * One colour per kind of item, used by every My Week surface (the My Week screen and the
 * Home card) so a match is the same purple everywhere.
 *
 *   match    purple  the brand primary (theme accentPurple, --color-primary)
 *   lesson   blue    --coach-color-accent
 *   players  green   theme primarySuccess: friends and players looking to play (PR 5)
 *   workout  orange  the off-court plan
 *   watch    teal    videos
 *
 * `soft` is the matching tint for backgrounds.
 */
export const WEEK_TYPE_COLORS: Record<WeekItemType, { solid: string; soft: string }> = {
  match: { solid: "#8B5CF6", soft: "#F4EBFF" },
  lesson: { solid: "#1570EF", soft: "#EFF8FF" },
  players: { solid: "#12B76A", soft: "#ECFDF3" },
  workout: { solid: "#F79009", soft: "#FFFAEB" },
  watch: { solid: "#15B79E", soft: "#F0FDF9" },
};

export const typeColor = (type: WeekItemType): string => WEEK_TYPE_COLORS[type]?.solid ?? "#98A2B3";
