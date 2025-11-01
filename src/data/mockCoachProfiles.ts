import type { Coach } from "./mockCoaches";
import { mockCoaches } from "./mockCoaches";

type LessonTypeId = "private" | "group";

type BookingLessonType = {
  id: LessonTypeId;
  label: string;
  price: string;
  unit: string;
  description: string;
  duration: string;
  tagline: string;
  bullets: string[];
};

type BookingDate = {
  id: string;
  day: string;
  date: string;
  sessions: string[];
};

type BookingTime = {
  id: string;
  label: string;
};

type HighlightChipIcon = "users" | "trophy" | "spark";

type HighlightChip = {
  icon: HighlightChipIcon;
  label: string;
};

type MetricIcon = "dollar" | "users" | "clock" | "map";

type Metric = {
  icon: MetricIcon;
  label: string;
  value: string;
  caption?: string;
};

type LessonDetail = {
  title: string;
  description: string;
  price: string;
  cadence: string;
};

export type CoachProfile = Coach & {
  about: string;
  headlineBadge?: string;
  highlightChips: HighlightChip[];
  metrics: Metric[];
  certifications: string[];
  specialties: string[];
  coachingLocations: string[];
  lessonDetails: LessonDetail[];
  booking: {
    headline: string;
    lessonTypes: BookingLessonType[];
    defaultLessonType: LessonTypeId;
    monthLabel: string;
    availableDates: BookingDate[];
    availableTimes: BookingTime[];
    note: string;
  };
};

const sharedProfileBase = {
  summary:
    "Former college player with 10+ years coaching experience. Specializes in serve technique, match strategy, and high-performance mindset work. Helping players of all levels unlock sustainable progress with data-led plans and targeted drills. Her approach focuses on building confident strokes, dynamic movement, and tactical awareness under pressure.",
  highlightChips: [
    { icon: "users" as const, label: "85 students" },
    { icon: "trophy" as const, label: "10+ years coaching" },
    { icon: "spark" as const, label: "UTR 9.8" },
  ],
  metrics: [
    { icon: "dollar" as const, label: "Private", value: "$85", caption: "per session" },
    { icon: "users" as const, label: "Group", value: "$50", caption: "per player" },
    { icon: "clock" as const, label: "Response time", value: "< 1 hour" },
    { icon: "map" as const, label: "Locations", value: "3" },
  ],
  certifications: ["USPTA Certified", "PTR Professional", "SafeSport Certified"],
  specialties: ["Serve technique", "Match strategy", "Tournament prep"],
  coachingLocations: ["Oceanside Tennis Center", "Vista Courts", "Cartland Tennis Club"],
  lessonDetails: [
    {
      title: "One-on-one session",
      description: "Intensive 60-minute session tailored to your goals with video breakdowns.",
      price: "$85",
      cadence: "per hour",
    },
    {
      title: "Group session (2-4 players)",
      description: "Sharpen live-ball decision making and coordinated drills for small groups.",
      price: "$50",
      cadence: "per player",
    },
  ],
  booking: {
    headline: "Book a Lesson",
    lessonTypes: [
      {
        id: "private" as const,
        label: "Private lesson",
        price: "$85",
        unit: "/ hour",
        description: "Laser-focused individual instruction",
        duration: "60 min • 1 player",
        tagline: "Dial in technique with video feedback",
        bullets: [
          "Custom drills + footwork",
          "Live ball + situational points",
          "Next-step practice plan recap",
        ],
      },
      {
        id: "group" as const,
        label: "Group session",
        price: "$50",
        unit: "/ player",
        description: "High-energy squad training",
        duration: "75 min • 2-4 players",
        tagline: "Sharpen together with competitive reps",
        bullets: [
          "Serve + return patterns",
          "Live point play rotations",
          "Shared match video breakdown",
        ],
      },
    ],
    defaultLessonType: "private" as const,
    monthLabel: "October 2025",
    availableDates: [
      { id: "2025-10-31", day: "Tue", date: "31", sessions: ["Morning", "Evening"] },
      { id: "2025-11-01", day: "Wed", date: "01", sessions: ["Afternoon"] },
      { id: "2025-11-05", day: "Sun", date: "05", sessions: ["Morning", "Afternoon"] },
    ],
    availableTimes: [
      { id: "slot-1", label: "7:30 AM" },
      { id: "slot-2", label: "9:00 AM" },
      { id: "slot-3", label: "5:30 PM" },
    ],
    note: "Need a different time? Message Coach",
  },
};

export const mockCoachProfiles: CoachProfile[] = [
  {
    ...mockCoaches[0],
    headlineBadge: "Top Rated",
    about: sharedProfileBase.summary,
    highlightChips: sharedProfileBase.highlightChips,
    metrics: sharedProfileBase.metrics,
    certifications: sharedProfileBase.certifications,
    specialties: sharedProfileBase.specialties,
    coachingLocations: sharedProfileBase.coachingLocations,
    lessonDetails: sharedProfileBase.lessonDetails,
    booking: sharedProfileBase.booking,
  },
  {
    ...mockCoaches[1],
    headlineBadge: "Player Favorite",
    about: sharedProfileBase.summary,
    highlightChips: [
      { icon: "users", label: "62 students" },
      { icon: "trophy", label: "Former D1 captain" },
      { icon: "spark", label: "UTR 9.3" },
    ],
    metrics: [
      { icon: "dollar", label: "Private", value: "$75", caption: "per session" },
      { icon: "users", label: "Group", value: "$55", caption: "per player" },
      { icon: "clock", label: "Response time", value: "2 hours" },
      { icon: "map", label: "Locations", value: "2" },
    ],
    certifications: ["LTA Level 4", "PTR Professional"],
    specialties: ["Topspin clinic", "Singles tactics", "Match analytics"],
    coachingLocations: ["Vista Courts", "Coastal Racquet Club"],
    lessonDetails: [
      {
        title: "Private session",
        description: "Technique deep dives using slow-motion capture and feedback loops.",
        price: "$75",
        cadence: "per hour",
      },
      {
        title: "Match play session",
        description: "Situational sets with in-point strategy adjustments and stats tracking.",
        price: "$55",
        cadence: "per player",
      },
    ],
    booking: {
      ...sharedProfileBase.booking,
      lessonTypes: [
        {
          id: "private",
          label: "Private lesson",
          price: "$75",
          unit: "/ hour",
          description: "1-on-1 coaching session",
          duration: "60 min • 1 player",
          tagline: "Detailed technical diagnostics",
          bullets: [
            "Video capture + swing notes",
            "Pattern-based situational drills",
            "Personalized practice tracker",
          ],
        },
        {
          id: "group",
          label: "Group session",
          price: "$55",
          unit: "/ player",
          description: "Point play focus",
          duration: "75 min • 3-4 players",
          tagline: "Pressure reps & tactical cues",
          bullets: [
            "Serve + first ball frameworks",
            "Team strategy scrimmages",
            "Shared progress summary",
          ],
        },
      ],
      defaultLessonType: "private",
      availableDates: [
        { id: "2025-10-28", day: "Fri", date: "28", sessions: ["Morning"] },
        { id: "2025-10-30", day: "Sun", date: "30", sessions: ["Evening"] },
        { id: "2025-11-03", day: "Wed", date: "03", sessions: ["Morning", "Midday"] },
      ],
      availableTimes: [
        { id: "slot-1", label: "8:00 AM" },
        { id: "slot-2", label: "12:30 PM" },
        { id: "slot-3", label: "6:15 PM" },
      ],
    },
  },
];

export const findCoachProfile = (id: string | number) => {
  const numericId = typeof id === "number" ? id : Number(id);
  if (Number.isNaN(numericId)) {
    return undefined;
  }
  return mockCoachProfiles.find((profile) => profile.id === numericId);
};
