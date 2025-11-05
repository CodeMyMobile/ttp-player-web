export type Player = {
  id: string;
  name: string;
  initials: string;
  profileImageUrl: string;
  location: string;
  distanceMiles: number;
  level: string;
  availability: string[];
  matchPreferences: string[];
  bio: string;
  verified: boolean;
  verificationCount: number;
  verificationSupporters: {
    name: string;
    avatarUrl: string;
  }[];
  lastActive: string;
  matchFrequency: string;
  rating: number;
  favoriteCourt: string;
  lookingFor: string;
  localCourts: string[];
  hitTypes: string[];
};

export const mockPlayers: Player[] = [
  {
    id: "sarah-anderson",
    name: "Sarah Anderson",
    initials: "SA",
    profileImageUrl:
      "https://images.unsplash.com/photo-1508780709619-79562169bc64?auto=format&fit=facearea&facepad=3&w=400&h=400&q=80",
    location: "Brooklyn, NY",
    distanceMiles: 2,
    level: "3.5",
    availability: ["Weekdays PM", "Weekends"],
    matchPreferences: ["Singles", "Competitive"],
    bio: "Former D3 player getting back into league play. Always down for a rematch and new hitting partners.",
    verified: true,
    verificationCount: 7,
    verificationSupporters: [
      {
        name: "Priya Patel",
        avatarUrl:
          "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=facearea&facepad=3&w=200&h=200&q=80",
      },
      {
        name: "Camille Lopez",
        avatarUrl:
          "https://images.unsplash.com/photo-1544723795-3fb6469f5b39?auto=format&fit=facearea&facepad=3&w=200&h=200&q=80",
      },
      {
        name: "Avery Brooks",
        avatarUrl:
          "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=facearea&facepad=3&w=200&h=200&q=80",
      },
      {
        name: "Nina Fields",
        avatarUrl:
          "https://images.unsplash.com/photo-1544723795-ed6f99cd1fdb?auto=format&fit=facearea&facepad=3&w=200&h=200&q=80",
      },
    ],
    lastActive: "Active today",
    matchFrequency: "2-3x per week",
    rating: 4.9,
    favoriteCourt: "Prospect Park Courts",
    lookingFor: "Intermediate women who like long rallies",
    localCourts: ["Prospect Park Courts", "McCarren Park"],
    hitTypes: ["Competitive", "Fun/Social"],
  },
  {
    id: "michael-johnson",
    name: "Michael Johnson",
    initials: "MJ",
    profileImageUrl:
      "https://images.unsplash.com/photo-1521412644187-c49fa049e84d?auto=format&fit=facearea&facepad=3&w=400&h=400&q=80",
    location: "Queens, NY",
    distanceMiles: 7,
    level: "4.0",
    availability: ["Weekdays AM", "Weekends"],
    matchPreferences: ["Singles", "Doubles"],
    bio: "USTA 4.0 captain focused on match strategy and consistency. Happy to rally or play sets.",
    verified: true,
    verificationCount: 5,
    verificationSupporters: [
      {
        name: "Jordan Miles",
        avatarUrl:
          "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=facearea&facepad=3&w=200&h=200&q=80",
      },
      {
        name: "Luis Romero",
        avatarUrl:
          "https://images.unsplash.com/photo-1544723795-3fb6469f5b39?auto=format&fit=facearea&facepad=3&w=200&h=200&q=80",
      },
      {
        name: "Mateo Silva",
        avatarUrl:
          "https://images.unsplash.com/photo-1528892952291-009c663ce843?auto=format&fit=facearea&facepad=3&w=200&h=200&q=80",
      },
    ],
    lastActive: "Active 1h ago",
    matchFrequency: "3x per week",
    rating: 4.8,
    favoriteCourt: "USTA Billie Jean King",
    lookingFor: "Players prepping for tournaments",
    localCourts: ["USTA Billie Jean King", "Forest Hills Stadium"],
    hitTypes: ["Competitive"],
  },
  {
    id: "emily-larson",
    name: "Emily Larson",
    initials: "EL",
    profileImageUrl:
      "https://images.unsplash.com/photo-1544723795-3fb6469f5b39?auto=format&fit=facearea&facepad=3&w=400&h=400&q=80",
    location: "Manhattan, NY",
    distanceMiles: 1,
    level: "3.0",
    availability: ["Weekdays PM", "Weekends"],
    matchPreferences: ["Doubles", "Social"],
    bio: "Recently joined Matchplay. Looking for relaxed doubles and social mixers on the east side.",
    verified: false,
    verificationCount: 2,
    verificationSupporters: [
      {
        name: "Laura Kim",
        avatarUrl:
          "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=facearea&facepad=3&w=200&h=200&q=80",
      },
      {
        name: "Dani Rivera",
        avatarUrl:
          "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=facearea&facepad=3&w=200&h=200&q=80",
      },
    ],
    lastActive: "Active yesterday",
    matchFrequency: "1-2x per week",
    rating: 4.6,
    favoriteCourt: "East River Park",
    lookingFor: "Coed doubles partners",
    localCourts: ["East River Park", "Roosevelt Island Racquet Club"],
    hitTypes: ["Fun/Social", "Casual"],
  },
  {
    id: "david-rodriguez",
    name: "David Rodriguez",
    initials: "DR",
    profileImageUrl:
      "https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?auto=format&fit=facearea&facepad=3&w=400&h=400&q=80",
    location: "Jersey City, NJ",
    distanceMiles: 11,
    level: "4.5",
    availability: ["Weekdays AM", "Weekends"],
    matchPreferences: ["Singles", "Competitive"],
    bio: "Former college player commuting into the city. Focused on high-intensity drilling and practice sets.",
    verified: true,
    verificationCount: 9,
    verificationSupporters: [
      {
        name: "Chris Walsh",
        avatarUrl:
          "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=facearea&facepad=3&w=200&h=200&q=80",
      },
      {
        name: "Jared Hoffman",
        avatarUrl:
          "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=facearea&facepad=3&w=200&h=200&q=80",
      },
      {
        name: "Amy Stone",
        avatarUrl:
          "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=facearea&facepad=3&w=200&h=200&q=80",
      },
      {
        name: "Lila Carter",
        avatarUrl:
          "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=facearea&facepad=3&w=200&h=200&q=80",
      },
    ],
    lastActive: "Active 3h ago",
    matchFrequency: "4x per week",
    rating: 5,
    favoriteCourt: "Newport Centre Courts",
    lookingFor: "High-performance training partners",
    localCourts: ["Newport Centre Courts", "Lincoln Park Tennis"],
    hitTypes: ["Competitive"],
  },
  {
    id: "jessica-chen",
    name: "Jessica Chen",
    initials: "JC",
    profileImageUrl:
      "https://images.unsplash.com/photo-1504826260979-242151ee45b7?auto=format&fit=facearea&facepad=3&w=400&h=400&q=80",
    location: "Hoboken, NJ",
    distanceMiles: 8,
    level: "3.5",
    availability: ["Weekdays PM", "Weekends"],
    matchPreferences: ["Doubles", "Competitive"],
    bio: "Captain of a 3.5 USTA women's team. Looking for doubles partners comfortable at the net.",
    verified: true,
    verificationCount: 4,
    verificationSupporters: [
      {
        name: "Erica Johns",
        avatarUrl:
          "https://images.unsplash.com/photo-1544723795-3fb6469f5b39?auto=format&fit=facearea&facepad=3&w=200&h=200&q=80",
      },
      {
        name: "Tamika Rose",
        avatarUrl:
          "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=facearea&facepad=3&w=200&h=200&q=80",
      },
      {
        name: "Olivia Hart",
        avatarUrl:
          "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=facearea&facepad=3&w=200&h=200&q=80",
      },
    ],
    lastActive: "Active today",
    matchFrequency: "2x per week",
    rating: 4.7,
    favoriteCourt: "Hoboken Tennis Club",
    lookingFor: "Aggressive doubles partners",
    localCourts: ["Hoboken Tennis Club", "Steven's Courts"],
    hitTypes: ["Competitive", "Fun/Social"],
  },
  {
    id: "tom-brennan",
    name: "Tom Brennan",
    initials: "TB",
    profileImageUrl:
      "https://images.unsplash.com/photo-1594474665561-b12c41fb601f?auto=format&fit=facearea&facepad=3&w=400&h=400&q=80",
    location: "Long Island City, NY",
    distanceMiles: 6,
    level: "3.0",
    availability: ["Weekdays AM"],
    matchPreferences: ["Singles", "Drills"],
    bio: "Tech professional working remote. Down for weekday drills and casual singles matches.",
    verified: false,
    verificationCount: 1,
    verificationSupporters: [
      {
        name: "Isaac Moore",
        avatarUrl:
          "https://images.unsplash.com/photo-1527980965255-d3b416303d12?auto=format&fit=facearea&facepad=3&w=200&h=200&q=80",
      },
    ],
    lastActive: "Active 4h ago",
    matchFrequency: "1-2x per week",
    rating: 4.5,
    favoriteCourt: "LIC Indoor Courts",
    lookingFor: "Flexible hitting partners",
    localCourts: ["LIC Indoor Courts", "Astoria Park Courts"],
    hitTypes: ["Casual"],
  },
  {
    id: "kevin-williams",
    name: "Kevin Williams",
    initials: "KW",
    profileImageUrl:
      "https://images.unsplash.com/photo-1543852786-1cf6624b9987?auto=format&fit=facearea&facepad=3&w=400&h=400&q=80",
    location: "Harlem, NY",
    distanceMiles: 4,
    level: "4.0",
    availability: ["Weekdays PM", "Weekends"],
    matchPreferences: ["Singles", "Competitive"],
    bio: "League player focusing on footwork and serve + volley patterns. Always ready for a tiebreaker.",
    verified: true,
    verificationCount: 6,
    verificationSupporters: [
      {
        name: "Abby Flores",
        avatarUrl:
          "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=facearea&facepad=3&w=200&h=200&q=80",
      },
      {
        name: "Gina Torres",
        avatarUrl:
          "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=facearea&facepad=3&w=200&h=200&q=80",
      },
      {
        name: "Wes Grant",
        avatarUrl:
          "https://images.unsplash.com/photo-1528892952291-009c663ce843?auto=format&fit=facearea&facepad=3&w=200&h=200&q=80",
      },
    ],
    lastActive: "Active 2h ago",
    matchFrequency: "3x per week",
    rating: 4.9,
    favoriteCourt: "Frederick Johnson Courts",
    lookingFor: "Aggressive baseliners",
    localCourts: ["Frederick Johnson Courts", "Riverbank State Park"],
    hitTypes: ["Competitive"],
  },
  {
    id: "lisa-martinez",
    name: "Lisa Martinez",
    initials: "LM",
    profileImageUrl:
      "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=facearea&facepad=3&w=400&h=400&q=80",
    location: "Upper West Side, NY",
    distanceMiles: 3,
    level: "2.5",
    availability: ["Weekdays AM"],
    matchPreferences: ["Drills", "Social"],
    bio: "New to the city and building confidence with consistent hitting. Open to coaching style hitting sessions.",
    verified: false,
    verificationCount: 0,
    verificationSupporters: [],
    lastActive: "Active 2d ago",
    matchFrequency: "1x per week",
    rating: 4.4,
    favoriteCourt: "Riverside Park Courts",
    lookingFor: "Supportive practice partners",
    localCourts: ["Riverside Park Courts", "96th Street Red Clay"],
    hitTypes: ["Casual", "Fun/Social"],
  },
];

export const findPlayerProfile = (playerId: string): Player | undefined =>
  mockPlayers.find((player) => player.id === playerId);
