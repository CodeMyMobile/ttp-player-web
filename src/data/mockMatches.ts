export type MatchRelationship = "host" | "participant" | "viewer";

export interface MatchSkillLevel {
  summary: string;
  detail: string;
}

export interface MatchEntry {
  id: string;
  access: "Open" | "Private";
  relationship: MatchRelationship;
  startDisplay: string;
  location: string;
  distance: string;
  playersJoined: number;
  playersNeeded?: number;
  totalSpots: number;
  level?: MatchSkillLevel;
}

export const mockMatches: MatchEntry[] = [
  {
    id: "match-1",
    access: "Open",
    relationship: "host",
    startDisplay: "Fri, Nov 14, 6:00 PM",
    location: "Griffin Club Los Angeles",
    distance: "2.5 miles away",
    playersJoined: 1,
    playersNeeded: 11,
    totalSpots: 12,
    level: {
      summary: "3.5",
      detail: "Suggested NTRP 3.5",
    },
  },
  {
    id: "match-2",
    access: "Private",
    relationship: "participant",
    startDisplay: "Sat, Nov 16, 8:30 AM",
    location: "Franklin Canyon Courts",
    distance: "1.2 miles away",
    playersJoined: 3,
    totalSpots: 4,
  },
  {
    id: "match-3",
    access: "Open",
    relationship: "viewer",
    startDisplay: "Sun, Nov 17, 10:00 AM",
    location: "Echo Park Tennis Center",
    distance: "3.6 miles away",
    playersJoined: 8,
    totalSpots: 8,
    level: {
      summary: "4.0",
      detail: "Suggested NTRP 4.0",
    },
  },
];
