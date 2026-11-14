import type { AvailabilityBucket, AvailabilitySlot, BestBet } from "../api/availability";

// The weekly availability grid (pages/AvailabilityPage) and the lines built from shared free time
// (best bets on the league Schedule). The buckets are the API's (ttp-api player_availability).

export const AVAILABILITY_BUCKETS: Array<{ key: AvailabilityBucket; label: string; hours: string }> = [
  { key: "early_morning", label: "Early morning", hours: "6–9am" },
  { key: "late_morning", label: "Late morning", hours: "9–12" },
  { key: "afternoon", label: "Afternoon", hours: "12–3" },
  { key: "late_afternoon", label: "Late afternoon", hours: "3–6" },
  { key: "evening", label: "Evening", hours: "6–9pm" },
  { key: "night", label: "Night", hours: "9–12" },
];

/** Rows in the grid, Monday first; `weekday` is the API's (0 = Sunday). */
export const AVAILABILITY_DAYS: Array<{ weekday: number; short: string; long: string }> = [
  { weekday: 1, short: "Mon", long: "Monday" },
  { weekday: 2, short: "Tue", long: "Tuesday" },
  { weekday: 3, short: "Wed", long: "Wednesday" },
  { weekday: 4, short: "Thu", long: "Thursday" },
  { weekday: 5, short: "Fri", long: "Friday" },
  { weekday: 6, short: "Sat", long: "Saturday" },
  { weekday: 0, short: "Sun", long: "Sunday" },
];

export const slotKey = (slot: AvailabilitySlot) => `${slot.weekday}:${slot.bucket}`;

/** The grid's state as a set of keys, from the API's slots. */
export const slotSet = (slots: AvailabilitySlot[]): Set<string> => new Set(slots.map(slotKey));

/** Flips one cell. Returns a new set. */
export const toggleSlot = (selected: Set<string>, slot: AvailabilitySlot): Set<string> => {
  const next = new Set(selected);
  const key = slotKey(slot);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  return next;
};

/** The set back as slots, in grid order (Monday first, then time of day). */
export const slotsFromSet = (selected: Set<string>): AvailabilitySlot[] =>
  AVAILABILITY_DAYS.flatMap((day) =>
    AVAILABILITY_BUCKETS.filter((bucket) => selected.has(`${day.weekday}:${bucket.key}`)).map((bucket) => ({
      weekday: day.weekday,
      bucket: bucket.key,
    })),
  );

/** "3 shared times · Sat, Sun, Tue" — or null when there are none. */
export const bestBetLine = (bet: Pick<BestBet, "shared_count" | "shared_days">): string | null => {
  if (!bet.shared_count) return null;
  const times = `${bet.shared_count} shared ${bet.shared_count === 1 ? "time" : "times"}`;
  return bet.shared_days.length ? `${times} · ${bet.shared_days.join(", ")}` : times;
};

/** Best bets worth showing: opponents with at least one shared time this week. */
export const bestBetsWithTimes = (bets: BestBet[]): BestBet[] => bets.filter((bet) => bet.shared_count > 0);
