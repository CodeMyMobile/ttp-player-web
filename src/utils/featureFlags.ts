// Feature flags for the player web app.
//
// VITE_HOME_V2 gates the redesigned home page. Default OFF: when unset/false the
// existing DashboardPage renders unchanged, so the "flag off = identical to
// today" guarantee is structural rather than a matter of care.
const truthy = (value: unknown) =>
  value === true ||
  value === "1" ||
  value === "true" ||
  value === "on" ||
  value === "yes";

// A flag can also be switched on for one browser, to try it on production: localStorage
// "<key>" === "1". Opening the app with ?<param>=1 sets it and ?<param>=0 clears it; the
// param can sit before the # or inside the hash route (#/?myweek=1).
const FLAG_OVERRIDES = {
  myweek: "ttp_flag_my_week",
  homev2: "ttp_flag_home_v2",
  restringv2: "ttp_flag_restring_v2",
} as const;

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const browserStorage = (): StorageLike | null => {
  try {
    return typeof window !== "undefined" && window.localStorage ? window.localStorage : null;
  } catch {
    return null;
  }
};

const isOverridden = (key: string, storage: StorageLike | null = browserStorage()) => {
  try {
    return storage?.getItem(key) === "1";
  } catch {
    return false;
  }
};

/** Applies ?myweek= / ?homev2= from the address. Runs once, before the app renders. */
export const applyFlagOverridesFromUrl = (
  location: { search?: string; hash?: string } | null = typeof window !== "undefined" ? window.location : null,
  storage: StorageLike | null = browserStorage(),
) => {
  if (!location || !storage) return;
  const hash = location.hash ?? "";
  const queries = [location.search ?? "", hash.includes("?") ? hash.slice(hash.indexOf("?")) : ""];
  for (const query of queries) {
    const params = new URLSearchParams(query);
    for (const [param, key] of Object.entries(FLAG_OVERRIDES)) {
      const value = params.get(param);
      try {
        if (value === "1") storage.setItem(key, "1");
        else if (value === "0") storage.removeItem(key);
      } catch {
        // No storage: the build's setting stands.
      }
    }
  }
};

export const isHomeV2Enabled = () =>
  truthy(import.meta.env?.VITE_HOME_V2) || isOverridden(FLAG_OVERRIDES.homev2);

// VITE_MY_WEEK gates My Week: the Play and My Week tabs in place of Leagues and Schedule,
// /play, /my-week, and /player/calendar redirecting to /my-week. Default OFF.
export const isMyWeekEnabled = () =>
  truthy(import.meta.env?.VITE_MY_WEEK) || isOverridden(FLAG_OVERRIDES.myweek);

// VITE_RESTRING_V2 gates the redesigned restring entry: Order again, the two-way choice,
// Stringers near you, the string list and the level-first quiz. Default OFF; ?restringv2=1
// turns it on for one browser.
export const isRestringV2Enabled = () =>
  truthy(import.meta.env?.VITE_RESTRING_V2) || isOverridden(FLAG_OVERRIDES.restringv2);

// VITE_VENDOR_PAGE gates the redesigned public vendor page at /:vendorSlug. Default OFF: when
// unset/false the existing RestringingPlayerFlow renders for vendor links unchanged.
export const isVendorPageEnabled = () => truthy(import.meta.env?.VITE_VENDOR_PAGE);

// VITE_LEAGUE_COACHING_PROMPTS gates the league dashboard's lesson prompts: the "Group
// lessons at your level" card, the ladder nudge and the unranked hero's clinic link.
// Default OFF.
export const isLeagueCoachingPromptsEnabled = () => truthy(import.meta.env?.VITE_LEAGUE_COACHING_PROMPTS);

// VITE_HOME_FIND_PLAYERS gates the home page's "Players to hit with" carousel and the
// compact "Find players" tile. Default OFF.
export const isHomeFindPlayersEnabled = () => truthy(import.meta.env?.VITE_HOME_FIND_PLAYERS);
