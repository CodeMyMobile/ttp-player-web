/**
 * Warm neutral palette — Find Players.
 *
 * Added alongside `colors` rather than replacing it: three other pages read the cool
 * slate values, and repainting them is outside this work. Find Players maps these into
 * its own CSS custom properties.
 *
 * ACCENT PAIR — the two brand purples are split by ROLE, not by emphasis:
 *
 *   accent     #8B5CF6  fills and large elements ONLY — buttons, the sheet apply bar,
 *                       chip backgrounds, the switch.
 *   accentInk  #7C3AED  ALL text and small marks — chip labels, links, the level hint,
 *                       the top-card flag.
 *
 * Measured against `ground` (#F4F1EE): #8B5CF6 is 3.76:1, which fails WCAG AA for
 * normal text; #7C3AED is 5.07:1, which passes. Never render small text in `accent`.
 * The warm ground is lighter than the cool one these were originally chosen against,
 * which is why the split matters here and did not before.
 */
export const warmPalette = {
  ground: "#F4F1EE",
  surface: "#FFFFFF",
  surfaceMuted: "#F7F2EE",
  panel: "#FFFDFC",

  ink: "#231D25",
  inkSecondary: "#4A404B",
  muted: "#776875",
  /**
   * NEVER carries text a user needs to read — 2.59:1 on `ground`, which fails AA at
   * any size. Decorative marks only.
   *
   * Its one legitimate use today is the magnifying glass in the filter bar's search
   * field (.fc-filter__search-icon in players.css), which sits beside a labelled input
   * and carries no meaning on its own.
   *
   * Three small label selectors used to paint text in this rung at 2.40:1 —
   * .fp-card__section-label, .fp-profile-summary__label and .fc-filter__label. If a
   * label needs a quieter colour, reach for `muted` (4.64:1), not this.
   */
  faint: "#A2939F",

  line: "#E8DFDC",
  lineSoft: "#F1EBE7",

  accent: "#8B5CF6",
  accentInk: "#7C3AED",
  accentSoft: "#F1EBFE",
  accentLine: "#DDD0FB",
  onAccent: "#FFFFFF",

  good: "#12775A",
  goodSoft: "#E4F1EA",
  goodLine: "#C2E0D2",

  // Nudged two points darker than the prototype's #B4531D, which measured 4.45:1 on
  // `ground` and missed AA by 0.05. Hue and saturation are unchanged; only lightness
  // moved, from 0.410 to 0.405. 4.53:1.
  warm: "#B2521D",
  warmSoft: "#FBEADC",
};

/**
 * Dark counterpart. Lifted from the brand purples rather than reusing the prototype's,
 * so the accent pair stays recognisably ours in both schemes.
 *
 * NOT WIRED UP YET, deliberately. The app has no dark mode — no `prefers-color-scheme`
 * rule and no `data-theme` attribute exists anywhere in src/. These values are recorded
 * so the decision is reviewed now rather than improvised later.
 *
 * READ THIS BEFORE WIRING IT UP. Find Players sets these tokens as INLINE custom
 * properties, via the `themeVars` object it spreads onto its root element. An inline
 * custom property beats a stylesheet rule on the same element, so a
 * `@media (prefers-color-scheme: dark)` block will NOT override them — the media query
 * will match, the rule will be ignored, and the page will stay light with no error
 * anywhere. The tokens have to move into CSS first, or the scheme has to be resolved in
 * JS and the right palette passed to `themeVars`.
 */
export const warmPaletteDark = {
  ground: "#161116",
  surface: "#241D24",
  surfaceMuted: "#2C242C",
  panel: "#1F181F",

  ink: "#F2EBEF",
  inkSecondary: "#CEC1C9",
  muted: "#A4949F",
  faint: "#80707B",

  line: "#372C36",
  lineSoft: "#302630",

  accent: "#A78BFA",
  accentInk: "#C4B5FD",
  accentSoft: "#302344",
  accentLine: "#463659",
  onAccent: "#1A121A",

  good: "#5FD3A6",
  goodSoft: "#16302A",
  goodLine: "#26513F",

  warm: "#E0A276",
  warmSoft: "#3A2519",
};

export const colors = {
  pageBackground: "#F5F7FB",
  surface: "#FFFFFF",
  primaryText: "#101828",
  secondaryText: "#667085",
  mutedText: "#475467",
  border: "#EAECF0",
  icon: "#98A2B3",
  accentPurple: "#8B5CF6",
  accentPurpleDark: "#7C3AED",
  accentPurpleLight: "#F4EBFF",
  accentPurpleBorder: "#D6BBFB",
  filterChipBg: "#F2F4F7",
  filterChipHover: "#EAECF0",
  filterChipSelectedBg: "#EEF4FF",
  filterChipSelectedBorder: "#B2CCFF",
  filterChipSelectedText: "#175CD3",
  availableBg: "#ECFDF3",
  availableText: "#027A48",
  featuredBg: "#FEF0C7",
  featuredText: "#B54708",
  ratingStar: "#FDB022",
  priceBadgeBg: "#F2F4F7",
  priceBadgeText: "#101828",
  secondaryButtonText: "#344054",
  secondaryButtonBorder: "#D0D5DD",
  secondaryButtonHover: "#F9FAFB",
  primarySuccess: "#12B76A",
  primarySuccessHover: "#039855",
  successRing: "#A6F4C5",
  errorBg: "#FEF3F2",
  errorBorder: "#F97066",
  errorText: "#B42318",
  emptyIconBg: "#F2F4F7",
  skeletonBase: "#E4E7EC",
  skeletonHighlight: "#F9FAFB",
};

export const typography = {
  fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  heading1: { size: "32px", weight: 700, lineHeight: "120%", letterSpacing: "-0.01em" },
  sectionTitle: { size: "16px", weight: 500, lineHeight: "150%" },
  body: { size: "16px", weight: 400, lineHeight: "150%" },
  tag: { size: "13px", weight: 500, lineHeight: "140%", letterSpacing: "0.01em" },
  price: { size: "28px", weight: 700, lineHeight: "120%" },
  caption: { size: "12px", weight: 500, lineHeight: "140%" },
};

export const radii = {
  card: "16px",
  button: "10px",
  pill: "9999px",
  iconButton: "12px",
};

export const shadows = {
  card: "0px 20px 25px -5px rgba(15, 23, 42, 0.08), 0px 10px 10px -5px rgba(15, 23, 42, 0.04)",
  sticky: "0px 1px 2px rgba(15, 23, 42, 0.08)",
};

export const spacing = {
  pageX: "64px",
  pageY: "48px",
  pageXMobile: "24px",
  grid: "24px",
};

export const theme = {
  colors,
  typography,
  radii,
  shadows,
  spacing,
};

export type Theme = typeof theme;
