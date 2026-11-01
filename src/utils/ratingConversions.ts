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

// UTR: a valid direct value (>0) wins; otherwise estimate from the TPR. The same formula
// the API uses (src/config/rating.js), and the same for men and women: UTR is one scale.
export function deriveUtr(direct: unknown, tpr: unknown): RatingConversion {
  const d = toNum(direct);
  if (d !== null && d > 0) return { value: d.toFixed(1), estimated: false };
  const r = toNum(tpr);
  if (r === null || r <= 0) return { value: null, estimated: false };
  const estimate = Math.round((r * 1.5 - 2.5) * 10) / 10;
  if (estimate < UTR_FLOOR) return { value: null, estimated: false };
  return { value: estimate.toFixed(1), estimated: true };
}

// ─── Ladder labels ────────────────────────────────────────────────────────

export interface RatingFields {
  current_rating?: unknown;
  calculated_ntrp?: unknown;
  calculated_utr?: unknown;
  usta_rating?: unknown;
  uta_rating?: unknown;
  rating_gender?: unknown;
}

const positive = (value: unknown, max = Infinity): number | null => {
  const n = toNum(value);
  return n !== null && n > 0 && n <= max ? n : null;
};

/**
 * The NTRP a ladder shows, saying where it came from when that isn't the player's results:
 *   "4.75"         from their TPR (a men's NTRP)
 *   "5.25 (W)"     from their TPR, on the women's scale, which runs about half a point
 *                  above the men's at the same strength
 *   "4.50 (self)"  what the player told us: we can't convert their TPR without a rating
 *                  gender, so it may not match it
 * Null when there's nothing.
 */
export function ladderNtrpLabel(player: RatingFields): string | null {
  const calculated = positive(player.calculated_ntrp, 7);
  if (calculated !== null) {
    return `${calculated.toFixed(2)}${player.rating_gender === "F" ? " (W)" : ""}`;
  }
  const own = positive(player.usta_rating, 7);
  return own !== null ? `${own.toFixed(2)} (self)` : null;
}

/** The UTR a ladder shows: from the TPR, else what the player told us, marked "(self)". */
export function ladderUtrLabel(player: RatingFields): string | null {
  const calculated = positive(player.calculated_utr);
  if (calculated !== null) return calculated.toFixed(1);
  const fromTpr = deriveUtr(null, player.current_rating);
  if (fromTpr.value !== null) return fromTpr.value;
  const own = positive(player.uta_rating);
  return own !== null ? `${own.toFixed(1)} (self)` : null;
}
