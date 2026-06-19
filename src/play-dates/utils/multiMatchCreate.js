// Helpers for orchestrating multi-match creation (best-effort + report).
//
// The new flow creates N matches with N sequential createMatch calls (there is
// no batch endpoint). Each card either succeeds or fails independently; we keep
// every success and let the user retry the failures. These pure helpers hold the
// merge/summary logic so the partial-failure behavior is unit-testable.

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const FALLBACK_SHARE_MESSAGE =
  "I'm looking to play this week — take a look at what times I'm free 🎾";

const toFiniteNumber = (value) => {
  if (value === undefined || value === null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const getPathValue = (record, path) =>
  path.reduce((value, key) => (value && typeof value === "object" ? value[key] : undefined), record);

export function resolveShareHostId(currentUser) {
  const identityPaths = [
    ["profile", "user_id"],
    ["profile", "userId"],
    ["user_id"],
    ["userId"],
    ["player_id"],
    ["playerId"],
    ["matchplay_player_id"],
    ["matchplayPlayerId"],
    ["profile", "player_id"],
    ["profile", "playerId"],
    ["player", "user_id"],
    ["player", "userId"],
    ["player", "player_id"],
    ["player", "playerId"],
    ["user", "user_id"],
    ["user", "userId"],
    ["user", "player_id"],
    ["user", "playerId"],
    ["id"],
  ];

  for (const path of identityPaths) {
    const id = toFiniteNumber(getPathValue(currentUser, path));
    if (id !== null) return id;
  }
  return null;
}

const parseCardDate = (value) => {
  if (typeof value !== "string") return null;
  const [year, month, day] = value.split("-").map((part) => Number(part));
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null;
  }
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatDayList = (days) => {
  if (days.length === 1) return days[0];
  if (days.length === 2) return `${days[0]} & ${days[1]}`;
  return `${days.slice(0, -1).join(", ")} & ${days[days.length - 1]}`;
};

export function buildAvailabilityShareMessage(results = []) {
  const days = [];
  const seen = new Set();

  for (const result of results) {
    if (!result?.ok) continue;
    const date = parseCardDate(result.card?.date);
    if (!date) continue;
    const label = DAY_LABELS[date.getDay()];
    if (seen.has(label)) continue;
    seen.add(label);
    days.push(label);
  }

  if (!days.length) return FALLBACK_SHARE_MESSAGE;
  return `Hey — looking to play ${formatDayList(days)}, grab a time 🎾`;
}

/**
 * Merge a fresh batch of results into the prior results, keyed by card id.
 * Fresh entries win for any card that was retried; untouched prior entries are
 * preserved. This makes "retry only the failed ones" converge correctly.
 *
 * @param {Array<{card:{id:any}, ok:boolean}>} previous
 * @param {Array<{card:{id:any}, ok:boolean}>} fresh
 * @returns {Array} merged results (prior order, with retried cards updated)
 */
export function mergeCreateResults(previous = [], fresh = []) {
  const freshIds = new Set(fresh.map((r) => r.card?.id));
  const kept = previous.filter((r) => !freshIds.has(r.card?.id));
  return [...kept, ...fresh];
}

/**
 * Summarize a result set for messaging.
 * @returns {{ total:number, succeeded:number, failed:number, allOk:boolean,
 *             anyFailed:boolean }}
 */
export function summarizeResults(results = []) {
  const succeeded = results.filter((r) => r.ok).length;
  const failed = results.length - succeeded;
  return {
    total: results.length,
    succeeded,
    failed,
    allOk: results.length > 0 && failed === 0,
    anyFailed: failed > 0,
  };
}
