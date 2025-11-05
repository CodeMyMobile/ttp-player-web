export type Player = {
  id: string;
  name: string;
  initials: string;
  location: string;
  distanceMiles: number;
  level: string;
  availability: string[];
  matchPreferences: string[];
  bio: string;
  verified: boolean;
  lastActive: string;
  matchFrequency: string;
  rating: number;
  favoriteCourt: string;
  lookingFor: string;
};

export const mockPlayers: Player[] = [
  {
    id: "sarah-anderson",
    name: "Sarah Anderson",
    initials: "SA",
    location: "Brooklyn, NY",
    distanceMiles: 2,
    level: "3.5",
    availability: ["Weeknights", "Weekends"],
    matchPreferences: ["Singles", "Competitive"],
    bio: "Former D3 player getting back into league play. Always down for a rematch and new hitting partners.",
    verified: true,
    lastActive: "Active today",
    matchFrequency: "2-3x per week",
    rating: 4.9,
    favoriteCourt: "Prospect Park Courts",
    lookingFor: "Intermediate women who like long rallies",
  },
  {
    id: "michael-johnson",
    name: "Michael Johnson",
    initials: "MJ",
    location: "Queens, NY",
    distanceMiles: 7,
    level: "4.0",
    availability: ["Mornings", "Weekends"],
    matchPreferences: ["Singles", "Doubles"],
    bio: "USTA 4.0 captain focused on match strategy and consistency. Happy to rally or play sets.",
    verified: true,
    lastActive: "Active 1h ago",
    matchFrequency: "3x per week",
    rating: 4.8,
    favoriteCourt: "USTA Billie Jean King",
    lookingFor: "Players prepping for tournaments",
  },
  {
    id: "emily-larson",
    name: "Emily Larson",
    initials: "EL",
    location: "Manhattan, NY",
    distanceMiles: 1,
    level: "3.0",
    availability: ["Lunch", "Weeknights"],
    matchPreferences: ["Doubles", "Social"],
    bio: "Recently joined Matchplay. Looking for relaxed doubles and social mixers on the east side.",
    verified: false,
    lastActive: "Active yesterday",
    matchFrequency: "1-2x per week",
    rating: 4.6,
    favoriteCourt: "East River Park",
    lookingFor: "Coed doubles partners",
  },
  {
    id: "david-rodriguez",
    name: "David Rodriguez",
    initials: "DR",
    location: "Jersey City, NJ",
    distanceMiles: 11,
    level: "4.5",
    availability: ["Early mornings", "Weekends"],
    matchPreferences: ["Singles", "Competitive"],
    bio: "Former college player commuting into the city. Focused on high-intensity drilling and practice sets.",
    verified: true,
    lastActive: "Active 3h ago",
    matchFrequency: "4x per week",
    rating: 5,
    favoriteCourt: "Newport Centre Courts",
    lookingFor: "High-performance training partners",
  },
  {
    id: "jessica-chen",
    name: "Jessica Chen",
    initials: "JC",
    location: "Hoboken, NJ",
    distanceMiles: 8,
    level: "3.5",
    availability: ["Weeknights", "Weekends"],
    matchPreferences: ["Doubles", "Competitive"],
    bio: "Captain of a 3.5 USTA women's team. Looking for doubles partners comfortable at the net.",
    verified: true,
    lastActive: "Active today",
    matchFrequency: "2x per week",
    rating: 4.7,
    favoriteCourt: "Hoboken Tennis Club",
    lookingFor: "Aggressive doubles partners",
  },
  {
    id: "tom-brennan",
    name: "Tom Brennan",
    initials: "TB",
    location: "Long Island City, NY",
    distanceMiles: 6,
    level: "3.0",
    availability: ["Mornings", "Lunch"],
    matchPreferences: ["Singles", "Drills"],
    bio: "Tech professional working remote. Down for weekday drills and casual singles matches.",
    verified: false,
    lastActive: "Active 4h ago",
    matchFrequency: "1-2x per week",
    rating: 4.5,
    favoriteCourt: "LIC Indoor Courts",
    lookingFor: "Flexible hitting partners",
  },
  {
    id: "kevin-williams",
    name: "Kevin Williams",
    initials: "KW",
    location: "Harlem, NY",
    distanceMiles: 4,
    level: "4.0",
    availability: ["Weeknights", "Weekends"],
    matchPreferences: ["Singles", "Competitive"],
    bio: "League player focusing on footwork and serve + volley patterns. Always ready for a tiebreaker.",
    verified: true,
    lastActive: "Active 2h ago",
    matchFrequency: "3x per week",
    rating: 4.9,
    favoriteCourt: "Frederick Johnson Courts",
    lookingFor: "Aggressive baseliners",
  },
  {
    id: "lisa-martinez",
    name: "Lisa Martinez",
    initials: "LM",
    location: "Upper West Side, NY",
    distanceMiles: 3,
    level: "2.5",
    availability: ["Mornings", "Weekdays"],
    matchPreferences: ["Drills", "Social"],
    bio: "New to the city and building confidence with consistent hitting. Open to coaching style hitting sessions.",
    verified: false,
    lastActive: "Active 2d ago",
    matchFrequency: "1x per week",
    rating: 4.4,
    favoriteCourt: "Riverside Park Courts",
    lookingFor: "Supportive practice partners",
  },
];

export const findPlayerProfile = (playerId: string): Player | undefined =>
  mockPlayers.find((player) => player.id === playerId);
