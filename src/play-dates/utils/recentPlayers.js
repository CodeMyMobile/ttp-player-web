import { getAvatarInitials, getAvatarUrlFromPlayer } from "./avatar";

const RECENT_PLAYERS_STORAGE_KEY = "matchCreator.recentPlayers";
export const RECENT_PLAYERS_LIMIT = 5;
export const RECENT_PLAYERS_EVENT = "recentPlayersUpdated";

const toNonEmptyString = (value) => {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return value.toString();
  return "";
};

const broadcastRecentPlayers = (entries) => {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(
      new CustomEvent(RECENT_PLAYERS_EVENT, { detail: entries }),
    );
  } catch (error) {
    console.warn("Failed to broadcast recent players", error);
  }
};

const persistRecentPlayers = (entries) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      RECENT_PLAYERS_STORAGE_KEY,
      JSON.stringify(entries),
    );
  } catch (error) {
    console.warn("Failed to save recent players", error);
  }
  broadcastRecentPlayers(entries);
};

const normalizeStoredPlayerEntry = (entry) => {
  if (!entry) return null;
  const id = Number(entry.id);
  if (!Number.isFinite(id)) return null;
  const name = toNonEmptyString(entry.name) || "Player";
  const email = toNonEmptyString(entry.email);
  const ntrp = toNonEmptyString(entry.ntrp);
  const avatar = toNonEmptyString(entry.avatar);
  const avatarUrl = toNonEmptyString(entry.avatarUrl);
  const lastPlayed = toNonEmptyString(entry.lastPlayed);
  const recordedAt = Number(entry.recordedAt);
  return {
    id,
    name,
    email,
    ntrp,
    avatar,
    avatarUrl,
    lastPlayed,
    recordedAt: Number.isFinite(recordedAt) ? recordedAt : Date.now(),
  };
};

export const loadRecentPlayers = () => {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_PLAYERS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    const normalized = parsed
      .map(normalizeStoredPlayerEntry)
      .filter(Boolean)
      .sort((a, b) => b.recordedAt - a.recordedAt);

    const seen = new Set();
    const deduped = [];

    for (const entry of normalized) {
      if (seen.has(entry.id)) continue;
      seen.add(entry.id);
      deduped.push(entry);
      if (deduped.length >= RECENT_PLAYERS_LIMIT) break;
    }

    return deduped;
  } catch (error) {
    console.warn("Failed to load recent players", error);
    return [];
  }
};

const extractFirstNonEmpty = (candidates) => {
  for (const candidate of candidates) {
    const value = toNonEmptyString(candidate);
    if (value) return value;
  }
  return "";
};

const buildStoredPlayerEntry = (player) => {
  if (!player || typeof player !== "object") return null;

  const idCandidate =
    player.id ??
    player.user_id ??
    player.userId ??
    player.player_id ??
    player.playerId ??
    player.profile_id ??
    player.profileId;
  const id = Number(idCandidate);
  if (!Number.isFinite(id)) return null;

  const email = extractFirstNonEmpty([
    player.email,
    player.user?.email,
    player.profile?.email,
    player.raw?.email,
  ]);

  const name =
    extractFirstNonEmpty([
      player.name,
      player.full_name,
      player.fullName,
      player.raw?.name,
      email,
    ]) || "Player";

  const ntrp = extractFirstNonEmpty([
    player.ntrp,
    player.skill_level,
    player.skillLevel,
    player.raw?.skill_level,
    player.raw?.ntrp,
  ]);

  const lastPlayed = extractFirstNonEmpty([
    player.lastPlayed,
    player.last_played,
    player.last_match_at,
    player.last_active_at,
    player.raw?.lastPlayed,
    player.raw?.last_match_at,
    player.raw?.last_active_at,
  ]);

  const avatarUrl =
    extractFirstNonEmpty([
      player.avatarUrl,
      player.avatar_url,
      player.avatar,
    ]) || getAvatarUrlFromPlayer(player);

  const avatar =
    extractFirstNonEmpty([
      player.avatar,
      player.avatarText,
    ]) || getAvatarInitials(name, email);

  return {
    id,
    name,
    email,
    ntrp,
    avatar,
    avatarUrl,
    lastPlayed,
    recordedAt: Date.now(),
  };
};

export const recordRecentPlayer = (player) => {
  const entry = buildStoredPlayerEntry(player);
  if (!entry) return loadRecentPlayers();

  const existing = loadRecentPlayers();
  const deduped = existing.filter((item) => item.id !== entry.id);
  const next = [entry, ...deduped].slice(0, RECENT_PLAYERS_LIMIT);
  persistRecentPlayers(next);
  return next;
};

export const recordRecentPlayers = (players) => {
  if (!Array.isArray(players) || players.length === 0) {
    return loadRecentPlayers();
  }

  let next = loadRecentPlayers();

  for (const player of players) {
    const entry = buildStoredPlayerEntry(player);
    if (!entry) continue;
    next = [entry, ...next.filter((item) => item.id !== entry.id)].slice(
      0,
      RECENT_PLAYERS_LIMIT,
    );
  }

  persistRecentPlayers(next);
  return next;
};

export default recordRecentPlayer;
