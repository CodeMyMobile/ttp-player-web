import { levelNumber } from "./levelScope";

/**
 * The lines that make a player card explain a match rather than list fields.
 * Pure, so the wording can be tested without rendering.
 */

/* ------------------------------------------------------------------ verdict */

export type VerdictTone = "even" | "up" | "down";

export type MatchVerdict = {
  text: string;
  tone: VerdictTone;
  /** True when the rating behind it is self-reported, so the wording hedges. */
  hedged: boolean;
};

/**
 * A verdict must never sound more certain than the WEAKER of the two ratings behind
 * it. A comparison is only as good as both sides of it: a self-rated viewer looking at
 * a confirmed player still has an unchecked guess on their own side, so that verdict
 * hedges too.
 *
 * Two confidence levels, not one:
 *   both peer-confirmed        -> state it plainly    "A step up"
 *   either side self-rated     -> hedge it            "Likely a step up"
 *
 * Both tiers come from the same field on the same endpoint — `isLevelConfirmed`, which
 * the API computes as three or more peer verifications. The viewer's own record is
 * fetched by id through the same call used for any other player.
 *
 * /player/verification-level is NOT used and must not be: it is a stub that returns
 * `level: 'Verified'` for every user, so consulting it would mark everyone confirmed.
 */
export const matchVerdict = (
  viewerLevel: string | null | undefined,
  targetLevel: string | null | undefined,
  targetConfirmed: boolean,
  viewerConfirmed: boolean = false,
): MatchVerdict | null => {
  const mine = levelNumber(viewerLevel ?? null);
  const theirs = levelNumber(targetLevel ?? null);
  if (mine === null || theirs === null) {
    return null;
  }

  const delta = Number((theirs - mine).toFixed(2));
  const tone: VerdictTone = delta === 0 ? "even" : delta > 0 ? "up" : "down";

  if (targetConfirmed && viewerConfirmed) {
    const text = delta === 0 ? "Even match" : delta > 0 ? "A step up" : "A step down";
    return { text, tone, hedged: false };
  }

  const phrase = delta === 0 ? "an even match" : delta > 0 ? "a step up" : "a step down";
  return { text: `Likely ${phrase}`, tone, hedged: true };
};

/* -------------------------------------------------------------------- court */

export type CourtLine = { text: string; isShared: boolean };

const normalizeCourt = (value: string) => value.trim().toLowerCase();

/** Just the venue name — the stored value can carry a full street address. */
export const courtName = (value: string) => {
  const head = String(value ?? "").split(",")[0].trim();
  const match = head.match(/^(.*)\s+\d+[A-Za-z]?\s+\S+/);
  return match && match[1].trim() ? match[1].trim() : head;
};

/**
 * Court is the headline, so a shared one is said out loud.
 *
 * Comparison is by LABEL, because the payload carries no venue IDs. That
 * under-reports — "Cheviot Hills Recreation Center" and "Cheviot Hills Tennis Center"
 * will not match — so a false negative is expected and a false positive is not.
 */
export const courtLine = (
  viewerCourts: string[] | null | undefined,
  targetCourts: string[] | null | undefined,
): CourtLine | null => {
  const theirs = (targetCourts ?? []).map((c) => String(c ?? "").trim()).filter(Boolean);
  if (theirs.length === 0) {
    return null;
  }

  const mine = new Set((viewerCourts ?? []).map((c) => normalizeCourt(courtName(String(c ?? "")))));
  const shared = theirs.find((court) => mine.has(normalizeCourt(courtName(court))));

  if (shared) {
    return { text: `${courtName(shared)} — your court too`, isShared: true };
  }
  return { text: `Plays at ${courtName(theirs[0])}`, isShared: false };
};

/* ------------------------------------------------------------- availability */

const joinNaturally = (items: string[]) => {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
};

/**
 * Availability as a sentence about the two of you, not a row of tags. Two players
 * both free on weekday mornings will find a court; two who never are, won't.
 *
 * Returns null when there is no overlap — silence is more honest than "no overlap",
 * and the card collapses the line.
 */
export const availabilitySentence = (
  viewerSlots: string[] | null | undefined,
  targetSlots: string[] | null | undefined,
): string | null => {
  const mine = new Set((viewerSlots ?? []).map((s) => String(s ?? "").trim().toLowerCase()).filter(Boolean));
  const overlap = (targetSlots ?? [])
    .map((s) => String(s ?? "").trim())
    .filter((s) => s && mine.has(s.toLowerCase()));

  const unique = [...new Set(overlap.map((s) => s.toLowerCase()))].map(
    (lower) => overlap.find((s) => s.toLowerCase() === lower) as string,
  );

  if (unique.length === 0) return null;
  return `You're both free ${joinNaturally(unique.map((s) => s.toLowerCase()))}`;
};

/* ----------------------------------------------------------------- initials */

/**
 * The initials tile is MONOCHROME — accent-soft behind accent-ink — and deliberately
 * not a per-name colour.
 *
 * A name-derived hue was tried and rejected. Held to a muted band it was quiet enough,
 * but a column of olive, blue, crimson, green and teal reads as a colour code that
 * encodes nothing. Worse, it collides with the semantic colours a few pixels away: a
 * green tile beside "A step down", or a crimson one beside "A step up", actively
 * contradicts the verdict. Monochrome removes a signal that was never real.
 *
 * Kept as a function so the decision has somewhere to live.
 */
export const initialsBackground = () => "var(--fc-color-accent-light)";
export const initialsForeground = () => "var(--fc-color-accent-ink)";
