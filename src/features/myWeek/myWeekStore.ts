import type { MyWeekLoad } from "./loadMyWeek";

/**
 * One copy of the player's week for the whole app. The bottom nav's badge is on most pages,
 * and the Home card and My Week screen read the same week, so they share a load instead of
 * each making the 4–5 API calls behind it.
 *
 * A screen asks for the week with ensureFresh(): it loads when nothing is held or what's held
 * is older than STALE_AFTER_MS. reload() loads regardless (after an accept or a booking).
 * Concurrent requests share one load.
 */

export const STALE_AFTER_MS = 60_000;

export interface MyWeekSnapshot {
  data: MyWeekLoad | undefined;
  loading: boolean;
  /** When `data` arrived, epoch ms; 0 before the first load. */
  loadedAt: number;
}

export interface MyWeekStore {
  getSnapshot: () => MyWeekSnapshot;
  subscribe: (listener: () => void) => () => void;
  /** Loads if nothing is held or it's stale. Resolves when the week is current. */
  ensureFresh: () => Promise<void>;
  /** Loads now, whatever is held. */
  reload: () => Promise<void>;
  /** Forgets the week (sign-out). */
  clear: () => void;
}

export const createMyWeekStore = (
  fetchWeek: () => Promise<MyWeekLoad>,
  { now = () => Date.now(), staleAfterMs = STALE_AFTER_MS }: { now?: () => number; staleAfterMs?: number } = {},
): MyWeekStore => {
  let snapshot: MyWeekSnapshot = { data: undefined, loading: false, loadedAt: 0 };
  let inFlight: Promise<void> | null = null;
  // A load started before clear() mustn't write its result afterwards.
  let generation = 0;
  const listeners = new Set<() => void>();

  const set = (next: Partial<MyWeekSnapshot>) => {
    snapshot = { ...snapshot, ...next };
    listeners.forEach((listener) => listener());
  };

  const load = (): Promise<void> => {
    if (inFlight) return inFlight;
    const started = generation;
    set({ loading: true });
    inFlight = fetchWeek()
      .then(
        (data) => {
          if (started === generation) set({ data, loading: false, loadedAt: now() });
        },
        () => {
          // loadMyWeek reports failures per source and doesn't reject; keep what's held.
          if (started === generation) set({ loading: false });
        },
      )
      .finally(() => {
        inFlight = null;
      });
    return inFlight;
  };

  return {
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    ensureFresh: () => {
      const fresh = snapshot.data !== undefined && now() - snapshot.loadedAt < staleAfterMs;
      return fresh ? Promise.resolve() : load();
    },
    reload: () => (inFlight ? inFlight.then(load) : load()),
    clear: () => {
      generation += 1;
      inFlight = null;
      set({ data: undefined, loading: false, loadedAt: 0 });
    },
  };
};
