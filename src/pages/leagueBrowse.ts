import type { League, LeagueGender } from "../api/leagues";
import type { PlayerPersonalDetails } from "../api/playerProfile";
import { evaluateLeagueEligibility } from "../features/leagueJoin/eligibility";

export type LeagueBrowseAvailableFilter =
  | "for-you"
  | "all"
  | "all-levels"
  | LeagueGender;
export type LeagueCardVariant = "available" | "enrolled" | "full";

const hasValue = (value: unknown) =>
  !(value == null || (typeof value === "string" && value.trim() === ""));

const parseNumber = (value: unknown): number | null => {
  if (!hasValue(value)) {
    return null;
  }

  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const hasMembership = (league: League): boolean => {
  const membershipStatus = typeof league.membership_status === "string"
    ? league.membership_status.trim().toLowerCase()
    : "";

  if (membershipStatus && membershipStatus !== "none") {
    return true;
  }

  return hasValue(league.joined_via);
};

export const getLeagueCardVariant = (league: League): LeagueCardVariant => {
  if (hasMembership(league)) {
    return "enrolled";
  }

  if (league.is_full === true) {
    return "full";
  }

  const remaining = parseNumber(league.spots_remaining);
  if (remaining != null && remaining <= 0) {
    return "full";
  }

  return "available";
};

export const filterAvailableLeagues = (
  leagues: League[],
  filter: LeagueBrowseAvailableFilter,
  profile?: PlayerPersonalDetails | null,
): League[] => {
  if (filter === "all" || filter === "all-levels") {
    return leagues;
  }

  if (filter === "men" || filter === "women" || filter === "mixed") {
    return leagues.filter((league) => league.gender === filter);
  }

  return leagues.filter((league) => {
    const eligibility = evaluateLeagueEligibility({
      league: league as Parameters<typeof evaluateLeagueEligibility>[0]["league"],
      profile: {
        gender: profile?.gender,
        usta_rating: profile?.usta_rating,
        date_of_birth: profile?.date_of_birth,
      },
      pending: {},
      now: new Date(),
    });

    return ![eligibility.gender, eligibility.level, eligibility.age].some(
      (field) =>
        field.status === "existing_mismatch" || field.status === "entered_mismatch",
    );
  });
};

export const getLeagueCapacity = (league: League) => {
  const filled = parseNumber(league.spots_filled);
  const remaining = parseNumber(league.spots_remaining);
  const total =
    filled != null && remaining != null ? filled + remaining : null;
  const isFull =
    getLeagueCardVariant(league) === "full" || (remaining != null && remaining <= 0);

  return {
    filled,
    remaining,
    total,
    isFull,
    progressPercent:
      total && total > 0 && filled != null
        ? Math.max(0, Math.min(100, (filled / total) * 100))
        : 0,
  };
};
