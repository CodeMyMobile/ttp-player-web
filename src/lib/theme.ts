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
