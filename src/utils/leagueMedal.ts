// Archive-row medal from a completed league's final standing rank.
// rank 1 → 🏆 "Won it"; ranks 2–3 → 🥉 (ordinal); everyone else → 🎾 (ordinal).
// Unknown/absent rank → neutral 🎾 with an em dash (pre-season / no standings).

export type LeagueMedalTone = "gold" | "bronze" | "";

export type LeagueMedal = {
  emoji: string;
  className: LeagueMedalTone;
  label: string;
};

export const ordinal = (n: number): string => {
  const abs = Math.abs(Math.trunc(n));
  const suffixes = ["th", "st", "nd", "rd"];
  const v = abs % 100;
  return `${abs}${suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0]}`;
};

export const rankMedal = (rank: number | string | null | undefined): LeagueMedal => {
  const r = Number(rank);
  if (!Number.isFinite(r) || r <= 0) {
    return { emoji: "🎾", className: "", label: "—" };
  }
  if (r === 1) return { emoji: "🏆", className: "gold", label: "Won it" };
  if (r <= 3) return { emoji: "🥉", className: "bronze", label: ordinal(r) };
  return { emoji: "🎾", className: "", label: ordinal(r) };
};
