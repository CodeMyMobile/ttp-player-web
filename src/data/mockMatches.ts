export interface MatchEntry {
  id: string;
  title: string;
  level: string;
  type: "Open" | "Private" | "Clinic" | "League";
  status: "Hosting" | "Open" | "Full" | "Draft";
  format: string;
  startTime: string;
  startDate: string;
  location: string;
  distance: string;
  playersJoined: number;
  playersNeeded?: number;
  totalSpots: number;
  cost?: string;
  notes?: string;
  highlights?: string[];
  tags?: string[];
}

export const mockMatches: MatchEntry[] = [
  {
    id: "match-1",
    title: "Sunrise Doubles Rally",
    level: "3.0 · Competitive Social",
    type: "Private",
    status: "Hosting",
    format: "Doubles",
    startTime: "Tomorrow, 7:30 AM",
    startDate: "Feb 11",
    location: "Pommer Recreation Center",
    distance: "2.1 mi away",
    playersJoined: 2,
    playersNeeded: 2,
    totalSpots: 4,
    cost: "Court fee split",
    highlights: ["Need 2 players in 15 hours", "Hosted by Rachel Kim"],
    tags: ["Indoor court", "New balls"]
  },
  {
    id: "match-2",
    title: "After-Work Singles League",
    level: "4.0 · Ladder Week 6",
    type: "League",
    status: "Open",
    format: "Singles",
    startTime: "Wed, 6:00 PM",
    startDate: "Feb 12",
    location: "Griffith Club Los Angeles",
    distance: "4.4 mi away",
    playersJoined: 13,
    totalSpots: 16,
    cost: "$18 entry",
    highlights: ["132 players active", "USTA verified"]
  },
  {
    id: "match-3",
    title: "Weekend Mixed Doubles",
    level: "3.5 · Social Play",
    type: "Open",
    status: "Hosting",
    format: "Mixed Doubles",
    startTime: "Sat, 9:00 AM",
    startDate: "Feb 15",
    location: "Echo Park Tennis Center",
    distance: "3.6 mi away",
    playersJoined: 6,
    playersNeeded: 2,
    totalSpots: 8,
    highlights: ["Coffee + pastries", "Club host"],
    tags: ["Outdoors", "Round robin"]
  }
];
