import type { MatchOutcome } from "./data";

// Words for the result screen (ResultPage), from the viewer's side. Pure, so it's tested.

const firstName = (name: string | null | undefined) => String(name || "").trim().split(/\s+/)[0] || "";

/** "6–4, 3–6, 10–7", viewer's games first. */
export const scoreLine = (outcome: Pick<MatchOutcome, "sets" | "retired">): string => {
  const sets = outcome.sets.filter((set) => set.you != null && set.opp != null);
  if (!sets.length) return outcome.retired ? "by retirement" : "";
  return sets.map((set) => `${set.you}–${set.opp}`).join(", ");
};

/** "W 6–4, 3–6, 10–7 vs Ana" / "L 4–6, 2–6 vs Ana". */
export const resultLine = (outcome: MatchOutcome): string => {
  const score = scoreLine(outcome);
  const opponent = firstName(outcome.opponent.name) || "your opponent";
  return `${outcome.won ? "W" : "L"}${score ? ` ${score}` : ""} vs ${opponent}`;
};

/** "Nice win, Sahil" — or neutral after a loss. */
export const headline = (outcome: Pick<MatchOutcome, "won">, viewerName: string | null | undefined): string => {
  const name = firstName(viewerName);
  if (outcome.won) return name ? `Nice win, ${name}` : "Nice win";
  return name ? `Good match, ${name}` : "Good match";
};

/** "+0.08" / "−0.05" / "±0.00", or null without a change. */
export const deltaChip = (delta: number | null | undefined): string | null => {
  if (delta == null || !Number.isFinite(delta)) return null;
  const rounded = Math.round(delta * 100) / 100;
  if (rounded === 0) return "±0.00";
  return `${rounded > 0 ? "+" : "−"}${Math.abs(rounded).toFixed(2)}`;
};

/** "↑ 2 places" / "↓ 1 place", or null when they didn't move (or we can't tell). */
export const placesChip = (places: number | null | undefined): string | null => {
  if (!places) return null;
  const count = Math.abs(places);
  return `${places > 0 ? "↑" : "↓"} ${count} ${count === 1 ? "place" : "places"}`;
};

export const formatRating = (value: number | null | undefined): string =>
  value == null || !Number.isFinite(value) ? "—" : value.toFixed(2);
