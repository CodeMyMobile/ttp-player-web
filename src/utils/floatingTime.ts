/**
 * Reading a venue-local wall clock that is stored as if it were UTC.
 *
 * The API stores lesson start times as the clock on the wall at the venue —
 * "19:00" means seven in the evening there — but serialises them with a
 * trailing Z, which claims they are UTC instants. They are not. Every reader in
 * this app already relies on that: the group lesson pages parse with
 * moment.utc() and format without converting, so the Z cancels out and the
 * right digits appear.
 *
 * The trap is arithmetic. The moment you subtract one of these from a real
 * instant — "how many hours until this class?" — the fictional Z is applied and
 * the answer is wrong by the venue's offset. That is a silent seven hours in
 * Pacific summer.
 *
 * This reads the digits and builds a local Date from them, deliberately
 * ignoring any Z or offset, so the value can be compared against Date.now().
 */
const WALL_CLOCK = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/;

export const parseFloatingLocal = (value: unknown): Date | null => {
  if (typeof value !== "string") return null;
  const match = value.trim().match(WALL_CLOCK);
  if (!match) return null;

  const [, year, month, day, hour, minute, second] = match;
  const date = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second ?? 0),
  );
  return Number.isNaN(date.valueOf()) ? null : date;
};

/**
 * Hours until a floating wall-clock time, or null when it cannot be read.
 * Null means "we do not know", which callers must not treat as "no time left".
 */
export const hoursUntilFloating = (value: unknown, now: number = Date.now()): number | null => {
  const date = parseFloatingLocal(value);
  if (!date) return null;
  return (date.getTime() - now) / 3_600_000;
};
