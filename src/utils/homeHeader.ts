/**
 * Home's header: the greeting, and the location pill's short area name.
 */
import { shortLocationLabel } from "./userLocation";

export const greetingFor = (date: Date = new Date()): string => {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
};

/**
 * The pill's text: the stored area (a neighbourhood when the place had one, e.g. "West LA"),
 * else the first part of the saved label. Null shows the icon alone. The pill also drops the
 * text when it doesn't fit untruncated (AppNav measures it), so a long city never shows cut off.
 */
export const homeAreaLabel = ({ area, label }: { area: string | null; label: string | null }): string | null =>
  area?.trim() || shortLocationLabel(label) || null;
