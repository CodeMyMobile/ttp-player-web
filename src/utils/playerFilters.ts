/**
 * Filter state for Find Players.
 *
 * Everything here is a DRAFT until Apply. Five of these filters used to take effect on
 * the tap that set them; inside a sheet that is wrong — you cannot see what a change
 * did while the sheet covers the results, and a scrim tap has to be able to discard.
 */

export type PlayerFilterState = {
  radius: string;
  level: string;
  gender: string;
  playType: string;
  availability: string;
  verifiedOnly: boolean;
};

export type FilterKey = keyof PlayerFilterState;

/**
 * Radius is resolved by the API. A draft that changes it has no computable result count
 * until the request comes back, which is what makes the Apply button's label
 * conditional. Everything else is a predicate over the pool already in memory.
 */
export const SERVER_SIDE_KEYS: FilterKey[] = ["radius"];

export const isServerSideKey = (key: FilterKey) => SERVER_SIDE_KEYS.includes(key);

export const filtersEqual = (a: PlayerFilterState, b: PlayerFilterState) =>
  (Object.keys(a) as FilterKey[]).every((key) => a[key] === b[key]);

/** The keys whose values differ between two states. */
export const changedKeys = (a: PlayerFilterState, b: PlayerFilterState): FilterKey[] =>
  (Object.keys(a) as FilterKey[]).filter((key) => a[key] !== b[key]);

/** Count of filters that are not at their default — what the Filters button shows. */
export const countNonDefault = (state: PlayerFilterState, defaults: PlayerFilterState) =>
  changedKeys(state, defaults).length;

/* --------------------------------------------------------------- apply label */

/**
 * The commit button never prints a number it cannot back.
 *
 * A draft that only touches client-side filters can be counted for free against the
 * loaded pool. The moment radius changes, the real answer needs a round trip, so the
 * button drops the number rather than showing a stale or guessed one.
 */
export const applyLabel = (
  draft: PlayerFilterState,
  applied: PlayerFilterState,
  countForDraft: number,
): string => {
  const changed = changedKeys(draft, applied);
  if (changed.some(isServerSideKey)) {
    return "Show results";
  }
  return `Show ${countForDraft} ${countForDraft === 1 ? "player" : "players"}`;
};

/* ---------------------------------------------------------------------- chips */

export type FilterChip = { key: FilterKey; label: string };

export type ChipContext = {
  /** The viewer's level, or null. No level means no level chip. */
  viewerLevel: string | null;
  /** The range the level filter currently resolves to, for the "near" label. */
  nearRange?: string[] | null;
};

const titleCase = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

/**
 * Only non-default filters get a chip: the row exists to show what is narrowing the
 * results, and a chip for a filter that is doing nothing is noise wearing a dismiss
 * button.
 */
export const activeChips = (
  state: PlayerFilterState,
  defaults: PlayerFilterState,
  context: ChipContext,
): FilterChip[] => {
  const chips: FilterChip[] = [];

  // A level chip asserts that scoping is running. Without a level behind it that is a
  // claim we cannot make, so there is no chip — matching the rule for the verdict.
  if (state.level !== defaults.level && context.viewerLevel) {
    const range = context.nearRange ?? [];
    const span =
      range.length >= 2 ? ` · ${range[0]}–${range[range.length - 1]}` : "";
    chips.push({ key: "level", label: `${state.level}${span}` });
  }

  if (state.radius !== defaults.radius) {
    chips.push({ key: "radius", label: `Within ${state.radius}` });
  }
  if (state.availability !== defaults.availability) {
    chips.push({ key: "availability", label: state.availability });
  }
  if (state.playType !== defaults.playType) {
    chips.push({ key: "playType", label: titleCase(state.playType) });
  }
  if (state.gender !== defaults.gender) {
    chips.push({ key: "gender", label: state.gender });
  }
  if (state.verifiedOnly !== defaults.verifiedOnly) {
    chips.push({ key: "verifiedOnly", label: "Confirmed ratings" });
  }

  return chips;
};

/** Clearing one chip returns that single constraint to its default, nothing else. */
export const clearFilter = (
  state: PlayerFilterState,
  defaults: PlayerFilterState,
  key: FilterKey,
): PlayerFilterState => ({ ...state, [key]: defaults[key] });

/**
 * "Reset to my defaults" is not an empty state — it returns to the scoping the viewer
 * would have had on arrival, including their saved distance.
 */
export const resetToDefaults = (defaults: PlayerFilterState): PlayerFilterState => ({
  ...defaults,
});
