import type { Player } from "../data/mockPlayers";
import { ensureStringArray, toCanonicalAvailability } from "./matchProfile";

// Raw record returned by the suggested-players and specific-user endpoints
// (`/player/surveys/.../getchecklocation`). Shared by the Find Players
// directory and the visitor player profile so both render identically.
export type SuggestedPlayerRecord = {
  userId: number;
  email?: string;
  phone?: string;
  full_name?: string;
  profile_picture?: string;
  skillLevel?: string;
  availability?: string[] | string;
  playerLocations?: string[] | string;
  playerCourtLocations?: string[] | string;
  lookingFor?: string[] | string;
  gender?: string;
  about_me?: string;
  genderAdditionalText?: string;
  isLevelConfirmed?: boolean;
  verifiedLevelCount?: string | number;
  is_favorite?: boolean;
  [key: string]: unknown;
};

export type DirectoryPlayer = Player & { raw: SuggestedPlayerRecord };

export const toInitials = (name: string): string => {
  const segments = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (segments.length === 0) {
    return "TP";
  }
  if (segments.length === 1) {
    return segments[0].slice(0, 2).toUpperCase();
  }
  return `${segments[0][0]}${segments[segments.length - 1][0]}`.toUpperCase();
};

export const mapSuggestedPlayer = (record: SuggestedPlayerRecord): DirectoryPlayer => {
  const availability = ensureStringArray(record.availability, toCanonicalAvailability);
  const playerLocations = ensureStringArray(record.playerLocations);
  const courtLocations = ensureStringArray(record.playerCourtLocations);
  const lookingFor = ensureStringArray(record.lookingFor);
  const location = playerLocations[0] ?? courtLocations[0] ?? "Location unavailable";
  const initialsSource = record.full_name ?? record.email ?? "TTP Player";
  const skillLabel = typeof record.skillLevel === "string" ? record.skillLevel.trim() : "";
  const levelMatch = skillLabel.match(/NTRP\s*([0-9.]+)/i);
  const normalizedLevel = levelMatch?.[1] ?? (skillLabel || "Unknown");
  const verificationCount = Number.parseInt(String(record.verifiedLevelCount ?? "0"), 10) || 0;
  const normalizedGender = (() => {
    const rawGender = typeof record.gender === "string" ? record.gender.trim().toLowerCase() : "";
    if (rawGender === "male") return "Male" as const;
    if (rawGender === "female") return "Female" as const;
    return "Other" as const;
  })();
  const courts = courtLocations.length > 0 ? courtLocations : playerLocations;
  const bio = typeof record.about_me === "string" && record.about_me.trim().length > 0
    ? record.about_me.trim()
    : "This player hasn't added a bio yet.";

  return {
    id: String(record.userId ?? initialsSource.toLowerCase()),
    name: record.full_name?.trim() || record.email || "TTP Player",
    initials: toInitials(initialsSource),
    profileImageUrl:
      typeof record.profile_picture === "string" ? record.profile_picture.trim() : "",
    location,
    distanceMiles: 0,
    gender: normalizedGender,
    level: normalizedLevel,
    availability,
    matchPreferences: lookingFor,
    bio,
    verified: Boolean(record.isLevelConfirmed),
    verificationCount,
    verificationSupporters: [],
    lastActive: "Active recently",
    matchFrequency: "Match frequency unavailable",
    rating: 0,
    favoriteCourt: courts[0] ?? location,
    lookingFor: lookingFor.join(", ") || "Not specified",
    localCourts: courts,
    hitTypes: lookingFor,
    matchesPlayed: undefined,
    reviewsCount: undefined,
    responseTime: undefined,
    memberSince: undefined,
    matchHistory: undefined,
    reviews: undefined,
    raw: record,
  };
};

// The specific-user endpoint may return the record bare or wrapped. Pull the
// first usable record out of the common envelope shapes.
export const extractSuggestedPlayer = (payload: unknown): SuggestedPlayerRecord | null => {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  if (Array.isArray(payload)) {
    return (payload[0] as SuggestedPlayerRecord) ?? null;
  }
  const record = payload as Record<string, unknown>;
  const nestedKeys = ["data", "player", "user", "result", "profile"] as const;
  for (const key of nestedKeys) {
    const value = record[key];
    if (Array.isArray(value) && value.length > 0) {
      return value[0] as SuggestedPlayerRecord;
    }
    if (value && typeof value === "object") {
      return value as SuggestedPlayerRecord;
    }
  }
  // Bare record (has the identifying field).
  if ("userId" in record || "full_name" in record || "email" in record) {
    return record as SuggestedPlayerRecord;
  }
  return null;
};

export const mapPublicPlayerProfileRecord = (payload: unknown): SuggestedPlayerRecord | null => {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const container = payload as Record<string, unknown>;
  const source = (container.player && typeof container.player === "object"
    ? container.player
    : container) as Record<string, unknown>;

  if (!source || typeof source !== "object") {
    return null;
  }

  const userId = source.userId ?? source.user_id;
  if (userId === undefined || userId === null) {
    return null;
  }

  return {
    ...source,
    userId: Number(userId),
    full_name: typeof source.full_name === "string" ? source.full_name : undefined,
    profile_picture: typeof source.profile_picture === "string" ? source.profile_picture : undefined,
    skillLevel:
      typeof source.skillLevel === "string"
        ? source.skillLevel
        : typeof source.usta_rating === "string"
          ? source.usta_rating
          : undefined,
    about_me:
      typeof source.about_me === "string"
        ? source.about_me
        : typeof source.profile_about_me === "string"
          ? source.profile_about_me
          : undefined,
  } as SuggestedPlayerRecord;
};
