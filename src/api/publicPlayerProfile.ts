import { PUBLIC_PLAYER_PROFILE_STUB } from "../data/publicPlayerProfileStub";

// Bounded ("Tier 2.5") public view of a single open match. Deliberately omits
// exact start time, exact address, and the participant roster — a logged-out
// visitor only sees day+band, the general area, and how many spots are open.
export interface PublicMatchSummary {
  id: string;
  format: string; // "Singles" | "Doubles"
  levelLabel: string; // "3.5 - 4.5 NTRP" | "Around 4.0 NTRP" | "All levels"
  dayBand: string; // "Tuesday evening", "Saturday morning" — NO exact time
  generalArea: string; // "Cheviot Hills area" — NO street address
  spotsJoined: number;
  spotsTotal: number;
  // intentionally NO dateTime, NO location_text/address, NO participants/roster
}

// Bounded public profile a logged-out visitor can see. Identity, bio,
// availability, courts and play style are visible; everything actionable
// (join/connect/report) and every exact value is gated behind sign-in.
export interface PublicPlayerProfile {
  id: string;
  name: string;
  initials: string;
  profileImageUrl?: string;
  level?: string; // "4.0"
  levelVerified: boolean;
  verificationCount: number;
  generalLocation: string; // "West LA · Cheviot Hills area"
  bio?: string;
  availability: string[]; // ["Weekday PM", "Weekends"]
  preferredCourts: string[];
  playStyle: string[];
  invitedYou?: boolean; // drives the invite ribbon
  matches: PublicMatchSummary[];
}

// SINGLE swap point for the real endpoint. The public/bounded API does not exist
// yet (`fetchPlayerDetails` + `listMatches` 403 anonymously), so this returns a
// typed stub. When the backend lands, replace the body only — keep this the one
// place that knows how bounded data is fetched/shaped:
//
//   TODO(Sahil): replace the stub with the real public endpoint, e.g.
//     const raw = await http.get(`/public/players/${id}/profile`);
//     return mapPublicPlayerProfile(raw);
//
// The PublicPlayerProfile / PublicMatchSummary shapes above are the contract.
export async function fetchPublicPlayerProfile(
  id: string,
): Promise<PublicPlayerProfile> {
  return { ...PUBLIC_PLAYER_PROFILE_STUB, id };
}
