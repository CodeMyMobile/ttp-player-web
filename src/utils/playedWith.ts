import { getMatchHostId } from "../play-dates/utils/matchHost";

export interface PlayedWithPlayer {
  userId: number;
  playerId: number;
  name: string;
  avatarUrl: string | null;
  ntrp: number | null;
  matchCount: number;
  totalMatches: number;
}

export interface PlayedWithResponse {
  playedWith: PlayedWithPlayer[];
  total: number;
  lastUpdated: string | null;
}

const toNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const firstString = (...values: unknown[]): string => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
};

const normalizePlayer = (record: unknown): PlayedWithPlayer | null => {
  if (!record || typeof record !== "object") return null;
  const row = record as Record<string, unknown>;
  const userId = toNumber(row.userId ?? row.user_id ?? row.playerId ?? row.player_id);
  if (userId === null) return null;
  const matchCount = toNumber(row.matchCount ?? row.match_count ?? row.totalMatches ?? row.total_matches) ?? 0;

  return {
    userId,
    playerId: userId,
    name: firstString(row.name, row.full_name, row.fullName) || "Player",
    avatarUrl: firstString(row.avatarUrl, row.avatar_url, row.profile_picture, row.profilePicture) || null,
    ntrp: toNumber(row.ntrp ?? row.usta_rating ?? row.skillLevel ?? row.skill_level),
    matchCount,
    totalMatches: toNumber(row.totalMatches ?? row.total_matches) ?? matchCount,
  };
};

export const normalizePlayedWithResponse = (payload: unknown): PlayedWithResponse => {
  const body = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  const list = Array.isArray(body.playedWith)
    ? body.playedWith
    : Array.isArray(body.played_with)
      ? body.played_with
      : Array.isArray(body.data)
        ? body.data
        : [];
  const playedWith = list.map(normalizePlayer).filter((player): player is PlayedWithPlayer => Boolean(player));

  return {
    playedWith,
    total: toNumber(body.total) ?? playedWith.length,
    lastUpdated: firstString(body.lastUpdated, body.last_updated) || null,
  };
};

export const buildPlayedWithHostSet = (playedWith: PlayedWithPlayer[]) =>
  new Set(
    playedWith
      .map((player) => player.userId)
      .filter((id) => Number.isFinite(id))
      .map((id) => String(id)),
  );

export const hasPlayedWithHost = (match: Record<string, unknown>, playedWithHosts: Set<string>) => {
  const hostId = getMatchHostId(match);
  if (hostId === undefined || hostId === null) return false;
  return playedWithHosts.has(String(hostId).trim());
};

export const formatPlayedWithCount = (count: number) => {
  const normalized = Number.isFinite(count) ? Math.max(0, Math.round(count)) : 0;
  return `${normalized} match${normalized === 1 ? "" : "es"}`;
};
