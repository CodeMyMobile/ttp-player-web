// Shared TRP → NTRP / UTR conversions, used by the public match-results page and
// the league dashboard so both derive ratings identically. Prefers a real value
// (backend-calculated or player-entered) and only estimates from the TRP as a
// fallback — flagging estimates so the UI can mark them honestly.

export interface RatingConversion {
  /** Formatted display value, or null when neither a direct value nor a TRP exists. */
  value: string | null;
  /** True when derived from the TRP via the estimate formula (not a real rating). */
  estimated: boolean;
}

const toNum = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

// NTRP: a valid direct value (0–7) wins; otherwise estimate from the TRP.
export function deriveNtrp(direct: unknown, trp: unknown, gender?: string | null): RatingConversion {
  const d = toNum(direct);
  if (d !== null && d > 0 && d <= 7) return { value: d.toFixed(2), estimated: false };
  const r = toNum(trp);
  if (r === null) return { value: null, estimated: false };
  const base = gender === "F" ? 4.5 : 5.0;
  const ntrp = Math.max(2.5, Math.min(6.0, Math.round((3.5 + (r - base) * 0.5) * 4) / 4));
  return { value: ntrp.toFixed(2), estimated: true };
}

// UTR: a valid direct value (>0) wins; otherwise estimate from the TRP.
export function deriveUtr(direct: unknown, trp: unknown): RatingConversion {
  const d = toNum(direct);
  if (d !== null && d > 0) return { value: d.toFixed(1), estimated: false };
  const r = toNum(trp);
  if (r === null) return { value: null, estimated: false };
  return { value: (Math.round((r * 2 - 5) * 10) / 10).toFixed(1), estimated: true };
}
