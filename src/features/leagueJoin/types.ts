import type { LeagueGender } from "../../api/leagues";
import type { PlayerGender } from "../../api/playerProfile";

export type LeagueJoinEligibilityStatus =
  | "pass"
  | "missing"
  | "entered_mismatch"
  | "existing_mismatch";

export interface LeagueJoinEligibilityField {
  status: LeagueJoinEligibilityStatus;
}

export interface LeagueJoinEligibility {
  gender: LeagueJoinEligibilityField;
  level: LeagueJoinEligibilityField;
  age: LeagueJoinEligibilityField;
  canContinue: boolean;
}

export interface LeagueJoinLeague {
  gender?: LeagueGender | null;
  bandLow?: number | string | null;
  bandHigh?: number | string | null;
  band_low?: number | string | null;
  band_high?: number | string | null;
}

export interface LeagueJoinProfile {
  gender?: PlayerGender | null;
  level?: number | string | null;
  usta_rating?: number | string | null;
  dateOfBirth?: string | null;
  date_of_birth?: string | null;
}

export interface LeagueJoinPending {
  gender?: PlayerGender | null;
  level?: number | string | null;
  usta_rating?: number | string | null;
  dateOfBirth?: string | null;
  date_of_birth?: string | null;
}
