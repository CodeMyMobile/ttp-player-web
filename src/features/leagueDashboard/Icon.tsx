// Inline SVG icon set ported verbatim from docs/tennis-plan-league.html so the
// dashboard renders the exact same glyphs as the mock (no icon-font dependency).

import type { CSSProperties } from "react";

const PATHS: Record<string, string> = {
  home: '<path d="M5 12H3l9-9 9 9h-2"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/><path d="M9 21v-6h6v6"/>',
  users: '<circle cx="9" cy="7" r="3"/><path d="M3 21v-1a5 5 0 0 1 5-5h2a5 5 0 0 1 5 5v1"/><path d="M16 3.2a4 4 0 0 1 0 7.6"/><path d="M21 21v-1a5 5 0 0 0-3.5-4.8"/>',
  calendar: '<rect x="4" y="5" width="16" height="16" rx="2"/><path d="M16 3v4M8 3v4M4 11h16"/>',
  "calendar-plus": '<rect x="4" y="5" width="16" height="16" rx="2"/><path d="M16 3v4M8 3v4M4 11h16M12 15v4M10 17h4"/>',
  "map-pin": '<path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  bell: '<path d="M10 5a2 2 0 1 1 4 0a7 7 0 0 1 4 6v3l2 3H4l2-3v-3a7 7 0 0 1 4-6"/><path d="M9 17v1a3 3 0 0 0 6 0v-1"/>',
  "chevron-down": '<path d="M6 9l6 6 6-6"/>',
  "chevron-left": '<path d="M15 6l-6 6 6 6"/>',
  "menu-2": '<path d="M4 6h16M4 12h16M4 18h16"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>',
  "clock-exclamation": '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>',
  "trending-up": '<path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/>',
  bolt: '<path d="M13 3l-8 10h6l-1 8 8-10h-6z"/>',
  "target-arrow": '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.4"/>',
  activity: '<path d="M3 12h4l3 8 4-16 3 8h4"/>',
  flame: '<path d="M12 12c2-3 0-7-1-8c0 3-1.8 4.7-3 6c-1.2 1.3-2 3.2-2 5a6 6 0 1 0 12 0c0-1.5-1-3.9-2-5c-1.8 3-2.8 3-4 2z"/>',
  flag: '<path d="M5 21V4"/><path d="M5 4h11l-2 3.5 2 3.5H5"/>',
  check: '<path d="M5 12l5 5 9-9"/>',
  "arrow-right": '<path d="M5 12h14M13 6l6 6-6 6"/>',
  "message-circle": '<path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9l-4 3v-3H6a2 2 0 0 1-2-2z"/>',
  "ball-tennis": '<circle cx="12" cy="12" r="9"/><path d="M5.6 5.6c3.2 3 3.2 9.8 0 12.8M18.4 5.6c-3.2 3-3.2 9.8 0 12.8"/>',
  archive: '<rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8"/><path d="M10 12h4"/>',
  "clipboard-check": '<rect x="8" y="4" width="8" height="4" rx="1"/><path d="M9 6H7a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-2"/><path d="M9 14l2 2 4-4"/>',
};

/** Icon keys used by computeNextMove map 1:1 onto PATHS above. */
export type IconName = keyof typeof PATHS | string;

interface IconProps {
  name: IconName;
  className?: string;
  style?: CSSProperties;
  size?: number | string;
}

const Icon = ({ name, className, style, size }: IconProps) => {
  const path = PATHS[name] ?? "";
  const sizeStyle = size !== undefined ? { width: size, height: size, ...style } : style;
  return (
    <svg
      className={`svic${className ? ` ${className}` : ""}`}
      viewBox="0 0 24 24"
      aria-hidden="true"
      style={sizeStyle}
      dangerouslySetInnerHTML={{ __html: path }}
    />
  );
};

export default Icon;
