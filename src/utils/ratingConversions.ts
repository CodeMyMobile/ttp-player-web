// Shared TPR → NTRP / UTR conversions, used by the public match-results page and
// the league dashboard so both derive ratings identically. Prefers a real value
// (backend-calculated or player-entered) and only estimates from the TPR as a
// fallback — flagging estimates so the UI can mark them honestly.

export interface RatingConversion {
  /** Formatted display value, or null when neither a direct value nor a TPR exists. */
  value: string | null;
  /** True when derived from the TPR via the estimate formula (not a real rating). */
  estimated: boolean;
}

// Number(null), Number(undefined) via "" and Number("") are all 0 — and 0 is
// finite — so a bare Number() check reads "no rating" as "rated zero" and the
// estimate formulas below then emit a confident, fabricated number. That is how
// an unrated player came to display "UTR ~-5.0".
const toNum = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" && !value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

// A real UTR starts at 1.0. Anything the estimate produces below that is an
// artefact of a missing or nonsense TPR, not a rating — report it as unrated
// rather than printing a number nobody could hold.
const UTR_FLOOR = 1.0;

// NTRP: a valid direct value (0–7) wins; otherwise estimate from the TPR.
export function deriveNtrp(direct: unknown, tpr: unknown, gender?: string | null): RatingConversion {
  const d = toNum(direct);
  if (d !== null && d > 0 && d <= 7) return { value: d.toFixed(2), estimated: false };
  const r = toNum(tpr);
  // Same rule as the UTR path: no TPR means no estimate, rather than an estimate
  // built from a zero that only means "we don't know".
  if (r === null || r <= 0) return { value: null, estimated: false };
  const base = gender === "F" ? 4.5 : 5.0;
  const ntrp = Math.max(2.5, Math.min(6.0, Math.round((3.5 + (r - base) * 0.5) * 4) / 4));
  return { value: ntrp.toFixed(2), estimated: true };
}

// UTR: a valid direct value (>0) wins; otherwise estimate from the TPR.
export function deriveUtr(direct: unknown, tpr: unknown): RatingConversion {
  const d = toNum(direct);
  if (d !== null && d > 0) return { value: d.toFixed(1), estimated: false };
  const r = toNum(tpr);
  if (r === null || r <= 0) return { value: null, estimated: false };
  const estimate = Math.round((r * 2 - 5) * 10) / 10;
  if (estimate < UTR_FLOOR) return { value: null, estimated: false };
  return { value: estimate.toFixed(1), estimated: true };
}
