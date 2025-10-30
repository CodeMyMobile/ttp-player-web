export const coachData = [
  {
    id: "maria-santos",
    name: "Maria Santos",
    rating: 4.9,
    reviewCount: 127,
    rate: 85,
    experience:
      "Former college player with 10+ years coaching experience. Specializing in serve technique and match strategy.",
    focus: "I help players develop consistent serves and smart court positioning.",
    specialties: ["Serve Technique", "Match Strategy", "Tournament Prep"],
    locations: ["Oceanside Tennis Center", "Vista Courts", "Carlsbad Tennis Club"],
    lessonTypes: ["Private Lessons", "Video Analysis", "Group Lessons"],
    availability: "Morning & Evening",
    avatarColor: "#f59e0b",
  },
  {
    id: "david-park",
    name: "David Park",
    rating: 4.8,
    reviewCount: 98,
    rate: 75,
    experience:
      "USTA certified coach focused on mental toughness and adaptive strategy for competitive players.",
    focus: "Structured programs to build confidence under pressure.",
    specialties: ["Mental Game", "Footwork", "Match Review"],
    locations: ["North Coast Tennis", "Vista Courts"],
    lessonTypes: ["Private Lessons", "Match Play", "Group Lessons"],
    availability: "Afternoon & Evening",
    avatarColor: "#3b82f6",
  },
  {
    id: "sarah-martinez",
    name: "Sarah Martinez",
    rating: 4.9,
    reviewCount: 142,
    rate: 95,
    experience:
      "Former national junior champion. Expert in mental game and building competition readiness.",
    focus: "Helping players create game plans tailored to their strengths.",
    specialties: ["Game Planning", "Mental Game", "Competitive Play"],
    locations: ["South Bay Courts", "Carlsbad Tennis Club"],
    lessonTypes: ["Private Lessons", "Tournament Coaching"],
    availability: "Weekday Mornings",
    avatarColor: "#ec4899",
  },
  {
    id: "michael-chen",
    name: "Michael Chen",
    rating: 4.7,
    reviewCount: 76,
    rate: 70,
    experience:
      "USTA high performance certified. Focused on doubles tactics and adaptive strategy.",
    focus: "Transforming doubles play with smart formations and communication.",
    specialties: ["Doubles Strategy", "Serve & Volley", "Video Analysis"],
    locations: ["Oceanside Tennis Center", "North Coast Tennis"],
    lessonTypes: ["Doubles Clinics", "Group Lessons", "Private Lessons"],
    availability: "Evenings & Weekends",
    avatarColor: "#10b981",
  },
  {
    id: "jennifer-wilson",
    name: "Jennifer Wilson",
    rating: 4.8,
    reviewCount: 84,
    rate: 80,
    experience:
      "Specializes in adult beginners and building strong foundations with video feedback.",
    focus: "Creating confident fundamentals with supportive coaching.",
    specialties: ["Adult Beginners", "Consistency", "Video Analysis"],
    locations: ["Vista Courts", "Downtown Tennis Pavilion"],
    lessonTypes: ["Private Lessons", "Group Lessons"],
    availability: "Weekday Evenings",
    avatarColor: "#6366f1",
  },
  {
    id: "robert-johnson",
    name: "Robert Johnson",
    rating: 4.6,
    reviewCount: 65,
    rate: 72,
    experience:
      "High school coach helping junior players improve match confidence.",
    focus: "Building reliable rally patterns and focused practice sessions.",
    specialties: ["Junior Players", "Match Confidence", "Footwork"],
    locations: ["Carlsbad Tennis Club", "Vista Courts"],
    lessonTypes: ["Private Lessons", "Group Lessons", "Match Play"],
    availability: "Afternoon & Weekends",
    avatarColor: "#f97316",
  },
];

export const lessonTypeFilters = [
  "All Lessons",
  "Private Lessons",
  "Group Lessons",
  "Match Play",
  "Video Analysis",
];

export const locationFilters = [
  "All Locations",
  "Oceanside Tennis Center",
  "Vista Courts",
  "Carlsbad Tennis Club",
  "North Coast Tennis",
  "South Bay Courts",
  "Downtown Tennis Pavilion",
];

export const getCoachById = (coachId) => coachData.find((coach) => coach.id === coachId);
