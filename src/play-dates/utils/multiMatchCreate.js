// Helpers for orchestrating multi-match creation (best-effort + report).
//
// The new flow creates N matches with N sequential createMatch calls (there is
// no batch endpoint). Each card either succeeds or fails independently; we keep
// every success and let the user retry the failures. These pure helpers hold the
// merge/summary logic so the partial-failure behavior is unit-testable.

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
