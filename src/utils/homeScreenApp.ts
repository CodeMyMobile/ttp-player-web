/**
 * An app saved to an iPhone's home screen keeps its own sign-in, apart from Safari and
 * Chrome, and iOS opens every tapped link in the default browser, never in that app. So a
 * player signed in on their home-screen app arrives from a shared link signed out. Pages
 * use this to explain that instead of looking broken. (No web page can tell whether the app
 * is on the home screen, or open it.)
 */

type NavigatorLike = {
  userAgent?: string;
  platform?: string;
  maxTouchPoints?: number;
  standalone?: boolean;
};

/** iPhone, iPod or iPad (iPadOS reports itself as a Mac with a touch screen). */
export const isAppleMobile = (nav: NavigatorLike | undefined): boolean => {
  if (!nav) return false;
  const ua = nav.userAgent ?? "";
  if (/iPhone|iPad|iPod/i.test(ua)) return true;
  return nav.platform === "MacIntel" && (nav.maxTouchPoints ?? 0) > 1;
};

/** Running as the home-screen app rather than in a browser tab. */
export const isHomeScreenApp = (
  nav: NavigatorLike | undefined,
  matchMedia?: ((query: string) => { matches: boolean }) | null,
): boolean => {
  if (nav?.standalone === true) return true;
  try {
    return Boolean(matchMedia?.("(display-mode: standalone)").matches);
  } catch {
    return false;
  }
};

/** In Safari or Chrome on an iPhone or iPad: the case where a home-screen sign-in doesn't carry over. */
export const isAppleMobileBrowser = (
  nav: NavigatorLike | undefined = typeof navigator !== "undefined" ? (navigator as NavigatorLike) : undefined,
  matchMedia: ((query: string) => { matches: boolean }) | null = typeof window !== "undefined" && window.matchMedia
    ? window.matchMedia.bind(window)
    : null,
): boolean => isAppleMobile(nav) && !isHomeScreenApp(nav, matchMedia);
