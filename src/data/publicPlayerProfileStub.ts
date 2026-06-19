import type { PublicPlayerProfile } from "../api/publicPlayerProfile";

// Build-ahead fixture for the logged-out player profile preview. Mirrors the
// design prototype (player-profile-loggedout.html). Served by
// `fetchPublicPlayerProfile` until the real public endpoint exists; this is the
// only place the sample data lives.
export const PUBLIC_PLAYER_PROFILE_STUB: PublicPlayerProfile = {
  id: "stub-charlotte",
  name: "Charlotte Cochrane",
  initials: "CC",
  profileImageUrl: "",
  level: "4.0",
  levelVerified: true,
  verificationCount: 3,
  generalLocation: "West LA · Cheviot Hills area",
  bio: "Originally from France, I'm an intermediate-level tennis player who really enjoys the game and is looking for more opportunities to get out there and hit.",
  availability: ["Weekday PM", "Weekends"],
  preferredCourts: [
    "Cheviot Hills Recreation Center",
    "Mar Vista Recreation Center",
  ],
  playStyle: ["Singles", "Doubles", "Social"],
  invitedYou: true,
  matches: [
    {
      id: "stub-match-1",
      format: "Singles",
      levelLabel: "3.5 - 4.5 NTRP",
      dayBand: "Tuesday evening",
      generalArea: "Cheviot Hills area",
      spotsJoined: 1,
      spotsTotal: 2,
    },
    {
      id: "stub-match-2",
      format: "Doubles",
      levelLabel: "Around 4.0 NTRP",
      dayBand: "Saturday morning",
      generalArea: "Mar Vista area",
      spotsJoined: 2,
      spotsTotal: 4,
    },
  ],
};
