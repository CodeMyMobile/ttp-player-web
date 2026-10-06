export const fixedRosterSizeForFormat = (format?: string | null) => {
  const normalized = `${format || ""}`.trim().toLowerCase();
  if (normalized === "singles") return 2;
  if (normalized === "doubles" || normalized === "mixed doubles" || normalized === "mixed-doubles") return 4;
  return null;
};

export const resolveRosterSizeForFormat = (format: string | undefined | null, requestedRosterSize: number) => {
  const fixedSize = fixedRosterSizeForFormat(format);
  if (fixedSize) return fixedSize;
  return Number.isFinite(requestedRosterSize) && requestedRosterSize > 0 ? requestedRosterSize : 4;
};

export const resolvePlayersNeededForFormat = (format: string | undefined | null, requestedPlayersNeeded: number) =>
  Math.max(resolveRosterSizeForFormat(format, requestedPlayersNeeded + 1) - 1, 0);
