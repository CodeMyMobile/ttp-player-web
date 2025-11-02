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

type BookingSlot = {
  id: string;
  time: string;
  lessonType: LessonTypeId;
  duration: string;
  price: string;
  spotsRemaining: number;
  title?: string;
};

type BookingDate = {
  id: string;
  day: string;
  date: string;
  label: string;
  totalSlots: number;
  slots: BookingSlot[];
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

type LessonPackage = {
  id: string;
  title: string;
  lessons: number;
  discount: string;
  description: string;
  totalPrice: string;
  pricePerLesson: string;
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
  lessonPackages: LessonPackage[];
  booking: {
    headline: string;
    lessonTypes: BookingLessonType[];
    defaultLessonType: LessonTypeId;
    monthLabel: string;
    availableDates: BookingDate[];
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
  lessonPackages: [
    {
      id: "private-5-pack",
      title: "5 lesson package",
      lessons: 5,
      discount: "Save 10%",
      description: "Secure five private sessions up front with flexible rescheduling.",
      totalPrice: "$382.50",
      pricePerLesson: "$76.50 per lesson",
    },
    {
      id: "private-10-pack",
      title: "10 lesson package",
      lessons: 10,
      discount: "Save 15%",
      description: "Lock in a season of progress and priority court access.",
      totalPrice: "$722.50",
      pricePerLesson: "$72.25 per lesson",
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
      {
        id: "2025-10-31",
        day: "Fri",
        date: "31",
        label: "Oct 31",
        totalSlots: 16,
        slots: [
          {
            id: "2025-10-31-private-0730",
            time: "7:30 AM",
            lessonType: "private",
            duration: "60 min",
            price: "$85",
            spotsRemaining: 1,
          },
          {
            id: "2025-10-31-group-0900",
            time: "9:00 AM",
            lessonType: "group",
            duration: "75 min",
            price: "$50",
            spotsRemaining: 3,
            title: "Live Ball Clinic",
          },
          {
            id: "2025-10-31-private-1730",
            time: "5:30 PM",
            lessonType: "private",
            duration: "60 min",
            price: "$85",
            spotsRemaining: 2,
          },
        ],
      },
      {
        id: "2025-11-01",
        day: "Sat",
        date: "01",
        label: "Nov 1",
        totalSlots: 14,
        slots: [
          {
            id: "2025-11-01-group-0830",
            time: "8:30 AM",
            lessonType: "group",
            duration: "75 min",
            price: "$50",
            spotsRemaining: 2,
            title: "Doubles Drills",
          },
          {
            id: "2025-11-01-private-1100",
            time: "11:00 AM",
            lessonType: "private",
            duration: "60 min",
            price: "$85",
            spotsRemaining: 1,
          },
          {
            id: "2025-11-01-private-1630",
            time: "4:30 PM",
            lessonType: "private",
            duration: "60 min",
            price: "$85",
            spotsRemaining: 2,
          },
        ],
      },
      {
        id: "2025-11-02",
        day: "Sun",
        date: "02",
        label: "Nov 2",
        totalSlots: 18,
        slots: [
          {
            id: "2025-11-02-private-0700",
            time: "7:00 AM",
            lessonType: "private",
            duration: "60 min",
            price: "$85",
            spotsRemaining: 1,
          },
          {
            id: "2025-11-02-group-0930",
            time: "9:30 AM",
            lessonType: "group",
            duration: "75 min",
            price: "$50",
            spotsRemaining: 4,
            title: "Intermediate Rally Squad",
          },
          {
            id: "2025-11-02-group-1500",
            time: "3:00 PM",
            lessonType: "group",
            duration: "75 min",
            price: "$50",
            spotsRemaining: 3,
            title: "Match Play Mixer",
          },
        ],
      },
      {
        id: "2025-11-03",
        day: "Mon",
        date: "03",
        label: "Nov 3",
        totalSlots: 12,
        slots: [
          {
            id: "2025-11-03-private-0630",
            time: "6:30 AM",
            lessonType: "private",
            duration: "60 min",
            price: "$85",
            spotsRemaining: 1,
          },
          {
            id: "2025-11-03-private-1200",
            time: "12:00 PM",
            lessonType: "private",
            duration: "60 min",
            price: "$85",
            spotsRemaining: 1,
          },
          {
            id: "2025-11-03-group-1830",
            time: "6:30 PM",
            lessonType: "group",
            duration: "75 min",
            price: "$50",
            spotsRemaining: 2,
            title: "Evening Cardio Tennis",
          },
        ],
      },
      {
        id: "2025-11-04",
        day: "Tue",
        date: "04",
        label: "Nov 4",
        totalSlots: 16,
        slots: [
          {
            id: "2025-11-04-group-0800",
            time: "8:00 AM",
            lessonType: "group",
            duration: "75 min",
            price: "$50",
            spotsRemaining: 4,
            title: "Morning Rally Charge",
          },
          {
            id: "2025-11-04-private-1330",
            time: "1:30 PM",
            lessonType: "private",
            duration: "60 min",
            price: "$85",
            spotsRemaining: 1,
          },
          {
            id: "2025-11-04-private-1900",
            time: "7:00 PM",
            lessonType: "private",
            duration: "60 min",
            price: "$85",
            spotsRemaining: 2,
          },
        ],
      },
      {
        id: "2025-11-05",
        day: "Wed",
        date: "05",
        label: "Nov 5",
        totalSlots: 15,
        slots: [
          {
            id: "2025-11-05-private-0700",
            time: "7:00 AM",
            lessonType: "private",
            duration: "60 min",
            price: "$85",
            spotsRemaining: 1,
          },
          {
            id: "2025-11-05-group-1000",
            time: "10:00 AM",
            lessonType: "group",
            duration: "75 min",
            price: "$50",
            spotsRemaining: 3,
            title: "Topspin Tune-Up",
          },
          {
            id: "2025-11-05-group-1700",
            time: "5:00 PM",
            lessonType: "group",
            duration: "75 min",
            price: "$50",
            spotsRemaining: 2,
            title: "Advanced Point Patterns",
          },
        ],
      },
      {
        id: "2025-11-06",
        day: "Thu",
        date: "06",
        label: "Nov 6",
        totalSlots: 13,
        slots: [
          {
            id: "2025-11-06-group-0830",
            time: "8:30 AM",
            lessonType: "group",
            duration: "75 min",
            price: "$50",
            spotsRemaining: 4,
            title: "Breakfast Club Rally",
          },
          {
            id: "2025-11-06-private-1100",
            time: "11:00 AM",
            lessonType: "private",
            duration: "60 min",
            price: "$85",
            spotsRemaining: 1,
          },
          {
            id: "2025-11-06-private-1800",
            time: "6:00 PM",
            lessonType: "private",
            duration: "60 min",
            price: "$85",
            spotsRemaining: 2,
          },
        ],
      },
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
    lessonPackages: sharedProfileBase.lessonPackages,
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
    lessonPackages: [
      {
        id: "private-5-pack",
        title: "5 lesson package",
        lessons: 5,
        discount: "Save 10%",
        description: "Bundle private coaching and keep consistent weekly reps.",
        totalPrice: "$337.50",
        pricePerLesson: "$67.50 per lesson",
      },
      {
        id: "private-10-pack",
        title: "10 lesson package",
        lessons: 10,
        discount: "Save 15%",
        description: "Season-long training block with match analysis bonuses.",
        totalPrice: "$637.50",
        pricePerLesson: "$63.75 per lesson",
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
        {
          id: "2025-10-29",
          day: "Wed",
          date: "29",
          label: "Oct 29",
          totalSlots: 12,
          slots: [
            {
              id: "2025-10-29-private-0800",
              time: "8:00 AM",
              lessonType: "private",
              duration: "60 min",
              price: "$75",
              spotsRemaining: 1,
            },
            {
              id: "2025-10-29-group-0930",
              time: "9:30 AM",
              lessonType: "group",
              duration: "75 min",
              price: "$55",
              spotsRemaining: 3,
              title: "Baseline Ball Machine",
            },
            {
              id: "2025-10-29-private-1700",
              time: "5:00 PM",
              lessonType: "private",
              duration: "60 min",
              price: "$75",
              spotsRemaining: 2,
            },
          ],
        },
        {
          id: "2025-10-30",
          day: "Thu",
          date: "30",
          label: "Oct 30",
          totalSlots: 11,
          slots: [
            {
              id: "2025-10-30-group-0700",
              time: "7:00 AM",
              lessonType: "group",
              duration: "75 min",
              price: "$55",
              spotsRemaining: 4,
              title: "Sunrise Strategy Lab",
            },
            {
              id: "2025-10-30-private-1130",
              time: "11:30 AM",
              lessonType: "private",
              duration: "60 min",
              price: "$75",
              spotsRemaining: 1,
            },
            {
              id: "2025-10-30-private-1800",
              time: "6:00 PM",
              lessonType: "private",
              duration: "60 min",
              price: "$75",
              spotsRemaining: 1,
            },
          ],
        },
        {
          id: "2025-11-01",
          day: "Sat",
          date: "01",
          label: "Nov 1",
          totalSlots: 14,
          slots: [
            {
              id: "2025-11-01-group-0830-b",
              time: "8:30 AM",
              lessonType: "group",
              duration: "75 min",
              price: "$55",
              spotsRemaining: 3,
              title: "Junior Power Hour",
            },
            {
              id: "2025-11-01-private-1030",
              time: "10:30 AM",
              lessonType: "private",
              duration: "60 min",
              price: "$75",
              spotsRemaining: 1,
            },
            {
              id: "2025-11-01-group-1600",
              time: "4:00 PM",
              lessonType: "group",
              duration: "75 min",
              price: "$55",
              spotsRemaining: 2,
              title: "Weekend Match Mixer",
            },
          ],
        },
        {
          id: "2025-11-03",
          day: "Mon",
          date: "03",
          label: "Nov 3",
          totalSlots: 10,
          slots: [
            {
              id: "2025-11-03-private-0700-b",
              time: "7:00 AM",
              lessonType: "private",
              duration: "60 min",
              price: "$75",
              spotsRemaining: 1,
            },
            {
              id: "2025-11-03-group-1200",
              time: "12:00 PM",
              lessonType: "group",
              duration: "75 min",
              price: "$55",
              spotsRemaining: 2,
              title: "Lunch Break Live Ball",
            },
            {
              id: "2025-11-03-private-1830",
              time: "6:30 PM",
              lessonType: "private",
              duration: "60 min",
              price: "$75",
              spotsRemaining: 1,
            },
          ],
        },
        {
          id: "2025-11-04",
          day: "Tue",
          date: "04",
          label: "Nov 4",
          totalSlots: 13,
          slots: [
            {
              id: "2025-11-04-group-0900",
              time: "9:00 AM",
              lessonType: "group",
              duration: "75 min",
              price: "$55",
              spotsRemaining: 4,
              title: "Footwork Foundations",
            },
            {
              id: "2025-11-04-private-1400",
              time: "2:00 PM",
              lessonType: "private",
              duration: "60 min",
              price: "$75",
              spotsRemaining: 1,
            },
            {
              id: "2025-11-04-group-1730",
              time: "5:30 PM",
              lessonType: "group",
              duration: "75 min",
              price: "$55",
              spotsRemaining: 3,
              title: "Evening Point Play Lab",
            },
          ],
        },
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
