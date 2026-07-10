import type {
  PatchPlayerPersonalDetailsBody,
  PlayerPersonalDetails,
  PlayerGender,
} from "../../api/playerProfile";
import type { LeagueJoinPending } from "./types";

const hasStringValue = (value: unknown): value is string =>
  typeof value === "string" && value.trim() !== "";

const hasValue = (value: unknown): boolean => {
  if (value == null) {
    return false;
  }

  if (typeof value === "string") {
    return value.trim() !== "";
  }

  if (typeof value === "number") {
    return Number.isFinite(value) && value !== 0;
  }

  return true;
};

const normalizeLevel = (value: number | string | null | undefined) => {
  if (!hasValue(value)) {
    return undefined;
  }

  return value;
};

const normalizeDate = (value: string | null | undefined) => {
  if (!hasStringValue(value)) {
    return undefined;
  }

  return value;
};

const valuesMatch = (left: unknown, right: unknown) => {
  if (left === right) {
    return true;
  }

  if (typeof left === "number" || typeof right === "number") {
    const leftNumber = Number(left);
    const rightNumber = Number(right);
    return Number.isFinite(leftNumber) && Number.isFinite(rightNumber) && leftNumber === rightNumber;
  }

  return String(left) === String(right);
};

const readPendingLevel = (pending: LeagueJoinPending) => {
  const level = normalizeLevel(pending.level);
  const ustaRating = normalizeLevel(pending.usta_rating);

  if (level !== undefined && ustaRating !== undefined && !valuesMatch(level, ustaRating)) {
    return null;
  }

  return ustaRating ?? level;
};

const readPendingDateOfBirth = (pending: LeagueJoinPending) => {
  const dateOfBirth = normalizeDate(pending.dateOfBirth);
  const snakeDateOfBirth = normalizeDate(pending.date_of_birth);

  if (
    dateOfBirth !== undefined &&
    snakeDateOfBirth !== undefined &&
    !valuesMatch(dateOfBirth, snakeDateOfBirth)
  ) {
    return null;
  }

  return snakeDateOfBirth ?? dateOfBirth;
};

const isMissingProfileField = (value: unknown) => !hasValue(value);

const readProfileDateOfBirth = (profile: PlayerPersonalDetails | null | undefined) =>
  profile?.date_of_birth ?? profile?.dateOfBirth ?? profile?.dob;

export const buildJoinProfilePatch = (
  profile: PlayerPersonalDetails | null | undefined,
  pending: LeagueJoinPending,
): PatchPlayerPersonalDetailsBody | null => {
  const nextLevel = readPendingLevel(pending);
  const nextDateOfBirth = readPendingDateOfBirth(pending);

  if (nextLevel === null || nextDateOfBirth === null) {
    return null;
  }

  const patch: PatchPlayerPersonalDetailsBody = {};

  if (isMissingProfileField(profile?.gender) && hasValue(pending.gender)) {
    patch.gender = pending.gender as PlayerGender;
  }

  if (isMissingProfileField(profile?.usta_rating) && nextLevel !== undefined) {
    patch.usta_rating = nextLevel;
  }

  if (isMissingProfileField(readProfileDateOfBirth(profile)) && nextDateOfBirth !== undefined) {
    patch.date_of_birth = nextDateOfBirth;
  }

  return patch;
};
