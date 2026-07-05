// Small date/time helpers for the availability flow. All calendar math is done
// in LOCAL time (not UTC) so "today"/quick-picks don't slip a day near midnight.

const pad = (n: number) => String(n).padStart(2, "0");

export const toLocalYmd = (d: Date): string =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const todayYmd = (): string => toLocalYmd(new Date());

export const addDaysYmd = (days: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return toLocalYmd(d);
};

// dayOfWeek: 0 = Sunday … 6 = Saturday → next occurrence (never today) as YYYY-MM-DD.
export const getNextDateWithDayOfWeek = (dayOfWeek: number): string => {
  const today = new Date();
  let daysAhead = dayOfWeek - today.getDay();
  if (daysAhead <= 0) daysAhead += 7;
  const next = new Date(today);
  next.setDate(today.getDate() + daysAhead);
  return toLocalYmd(next);
};

// "2026-07-06" → "Jul 6, 2026" (parsed as local midnight, so the date is stable).
export const formatDateForDisplay = (dateStr: string): string => {
  if (!dateStr) return "";
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

// "10:00" → "10:00 AM".
export const formatTimeForDisplay = (timeStr: string): string => {
  if (!timeStr) return "";
  const [h, m] = timeStr.split(":").map(Number);
  if (Number.isNaN(h)) return timeStr;
  return new Date(2000, 0, 1, h, m || 0).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
};
