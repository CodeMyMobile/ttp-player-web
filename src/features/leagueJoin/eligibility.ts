import type {
  LeagueJoinEligibility,
  LeagueJoinEligibilityField,
  LeagueJoinEligibilityStatus,
  LeagueJoinLeague,
  LeagueJoinPending,
  LeagueJoinProfile,
} from "./types";

const isPresent = (value: unknown): boolean =>
  !(value === null || value === undefined || (typeof value === "string" && value.trim() === ""));

const normalizeNumber = (value: number | string | null | undefined): number | null => {
  if (!isPresent(value)) {
    return null;
  }

  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeDate = (value: string | null | undefined): Date | null => {
  if (!isPresent(value)) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const readLeagueBandLow = (league: LeagueJoinLeague) => league.bandLow ?? league.band_low;
const readLeagueBandHigh = (league: LeagueJoinLeague) => league.bandHigh ?? league.band_high;
/**
 * The player's level for a band check, in the same order the API uses.
 *
 * This must not drift from `resolveLeagueRating` in ttp-api's
 * src/services/league_eligibility.js — `calculated_ntrp ?? usta_rating ??
 * self_rated_seed`. When it did, the two disagreed and this side was the stricter
 * one: a player with six matches played and a calculated 3.25 had the Continue
 * button disabled here, so the request never reached the server that would have
 * admitted him.
 *
 * `starting_rating` and `current_rating` are deliberately absent. Both are on the
 * TRP scale while league bands are NTRP, and comparing them is what rejected a
 * genuine 3.25 as a "6".
 */
const readProfileLevel = (profile: LeagueJoinProfile) =>
  profile.calculated_ntrp ?? profile.level ?? profile.usta_rating ?? profile.self_rated_seed;
const readPendingLevel = (pending: LeagueJoinPending) => pending.level ?? pending.usta_rating;
const readProfileDateOfBirth = (profile: LeagueJoinProfile) =>
  profile.dateOfBirth ?? profile.date_of_birth;
const readPendingDateOfBirth = (pending: LeagueJoinPending) =>
  pending.dateOfBirth ?? pending.date_of_birth;

const toUtcDay = (value: Date) =>
  new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));

const isAtLeast18 = (dateOfBirth: string | null | undefined, now: Date): boolean => {
  const dob = normalizeDate(dateOfBirth);
  if (!dob) {
    return false;
  }

  const eighteenthBirthday = new Date(
    Date.UTC(dob.getUTCFullYear() + 18, dob.getUTCMonth(), dob.getUTCDate()),
  );
  return toUtcDay(now).getTime() >= eighteenthBirthday.getTime();
};

const matchesLeagueGender = (
  playerGender: LeagueJoinProfile["gender"] | LeagueJoinPending["gender"],
  leagueGender: LeagueJoinLeague["gender"],
): boolean => {
  if (!isPresent(leagueGender)) {
    return true;
  }

  switch (playerGender) {
    case "male":
      return leagueGender === "men" || leagueGender === "mixed";
    case "female":
      return leagueGender === "women" || leagueGender === "mixed";
    case "other":
      return leagueGender === "mixed";
    default:
      return false;
  }
};

const matchesLeagueLevel = (
  level: number | string | null | undefined,
  league: LeagueJoinLeague,
): boolean => {
  const numericLevel = normalizeNumber(level);
  if (numericLevel == null) {
    return false;
  }

  const low = normalizeNumber(readLeagueBandLow(league));
  const high = normalizeNumber(readLeagueBandHigh(league));
  if (low == null || high == null) {
    return true;
  }

  return numericLevel >= low && numericLevel <= high;
};

const evaluateDimension = <T>(
  existingValue: T | null | undefined,
  pendingValue: T | null | undefined,
  matches: (value: T | null | undefined) => boolean,
): LeagueJoinEligibilityField => {
  if (isPresent(pendingValue)) {
    return {
      status: matches(pendingValue) ? "pass" : "entered_mismatch",
    };
  }

  if (isPresent(existingValue)) {
    return {
      status: matches(existingValue) ? "pass" : "existing_mismatch",
    };
  }

  return { status: "missing" };
};

export const evaluateLeagueEligibility = ({
  league,
  profile,
  pending,
  now,
}: {
  league: LeagueJoinLeague;
  profile: LeagueJoinProfile;
  pending: LeagueJoinPending;
  now: Date;
}): LeagueJoinEligibility => {
  const profileLevel = readProfileLevel(profile);
  const pendingLevel = readPendingLevel(pending);
  const profileDateOfBirth = readProfileDateOfBirth(profile);
  const pendingDateOfBirth = readPendingDateOfBirth(pending);

  const gender = evaluateDimension(profile.gender, pending.gender, (value) =>
    matchesLeagueGender(value, league.gender),
  );
  const level = evaluateDimension(profileLevel, pendingLevel, (value) =>
    matchesLeagueLevel(value, league),
  );
  const age = evaluateDimension(profileDateOfBirth, pendingDateOfBirth, (value) =>
    isAtLeast18(value, now),
  );

  return {
    gender,
    level,
    age,
    canContinue:
      gender.status === "pass" && level.status === "pass" && age.status === "pass",
  };
};

export type {
  LeagueJoinEligibility,
  LeagueJoinEligibilityField,
  LeagueJoinEligibilityStatus,
  LeagueJoinLeague,
  LeagueJoinPending,
  LeagueJoinProfile,
} from "./types";
