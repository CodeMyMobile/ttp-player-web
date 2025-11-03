export type CoachHighlightIcon = "map" | "calendar" | "message" | "users" | "spark";

export type CoachHighlight = {
  icon: CoachHighlightIcon;
  label: string;
};

export type CoachLessonRates = {
  private: string;
  group: string;
};

export type CoachNextAvailableLesson = {
  day: string;
  time: string;
  court: string;
};

export type Coach = {
  id: number;
  name: string;
  title: string;
  rating: number;
  reviewCount: number;
  location: string;
  pricePerHour: string;
  availabilityTag: string;
  featured?: boolean;
  summary: string;
  bio: string;
  yearsExperience: number;
  certifications: string[];
  courts: string[];
  levels: string[];
  specialties: string[];
  lessonRates: CoachLessonRates;
  languages: string[];
  availability: string;
  nextAvailableLesson: CoachNextAvailableLesson;
  highlights: CoachHighlight[];
  tags: string[];
  imageUrl: string;
};

export const mockCoaches: Coach[] = [
  {
    id: 1,
    name: "Maria Santos",
    title: "USTA Elite Coach",
    rating: 4.9,
    reviewCount: 137,
    location: "Greenwich Tennis Center",
    pricePerHour: "$85",
    availabilityTag: "Available",
    featured: true,
    summary: "Former WTA touring pro specializing in aggressive baseliners and match strategy.",
    bio: "Maria competed on the WTA tour for six seasons before turning her focus to building all-around players. Her sessions combine advanced drilling with match-scenario problem solving and mental resilience training.",
    yearsExperience: 12,
    certifications: ["USPTA Elite", "USTA Safe Play", "ITF Coach Education"],
    courts: ["Greenwich Tennis Center", "Harbor Indoor Courts"],
    levels: ["Advanced", "High Performance Juniors", "College Prep"],
    specialties: ["Aggressive baseliners", "Serve & return patterns", "Match strategy"],
    lessonRates: {
      private: "$85",
      group: "$45",
    },
    languages: ["English", "Spanish"],
    availability: "Weekday mornings & evenings",
    nextAvailableLesson: {
      day: "Tue, May 14",
      time: "5:30 PM",
      court: "Greenwich Tennis Center · Court 4",
    },
    highlights: [
      { icon: "calendar", label: "Morning & Evening" },
      { icon: "map", label: "Greenwich Tennis Center" },
      { icon: "message", label: "Responds in 1 hour" },
    ],
    tags: ["Serve clinic", "Footwork", "Video review"],
    imageUrl:
      "https://images.unsplash.com/photo-1534258936925-c58bed479fcb?auto=format&fit=crop&w=256&q=80",
  },
  {
    id: 2,
    name: "David Park",
    title: "LTA Level 4 Coach",
    rating: 4.8,
    reviewCount: 96,
    location: "Vista Courts",
    pricePerHour: "$75",
    availabilityTag: "Available",
    featured: false,
    summary: "Data-driven coach blending technical refinements with match analytics for rapid gains.",
    bio: "David pairs high-frame-rate video review with detailed match charting to uncover the exact adjustments that unlock new levels of play. His calm, analytical coaching style resonates with athletes who enjoy measurable progress.",
    yearsExperience: 9,
    certifications: ["USPTA Certified", "ITF Coaching", "Safe Play"],
    courts: ["Vista Courts", "North Ridge Tennis Park"],
    levels: ["Intermediate", "Advanced", "Adult League"],
    specialties: ["Topspin optimization", "Singles tactics", "Data-driven training"],
    lessonRates: {
      private: "$75",
      group: "$40",
    },
    languages: ["English", "Korean"],
    availability: "Late afternoon blocks Tue–Sat",
    nextAvailableLesson: {
      day: "Wed, May 15",
      time: "4:00 PM",
      court: "Vista Courts · Court 2",
    },
    highlights: [
      { icon: "calendar", label: "Late afternoons" },
      { icon: "map", label: "Vista Courts" },
      { icon: "message", label: "Responds in 2 hours" },
    ],
    tags: ["Topspin", "Singles tactics", "Match analysis"],
    imageUrl:
      "https://images.unsplash.com/photo-1521412644187-c49fa049e84d?auto=format&fit=crop&w=256&q=80",
  },
  {
    id: 3,
    name: "Sarah Martinez",
    title: "High Performance Specialist",
    rating: 5,
    reviewCount: 182,
    location: "Carlsbad Tennis Club",
    pricePerHour: "$95",
    availabilityTag: "Available",
    featured: true,
    summary: "High-performance junior development with tour-level conditioning and mindset coaching.",
    bio: "Sarah develops junior players with a holistic approach that blends technical precision, advanced fitness, and competitive resilience. She coordinates periodized training blocks tailored to tournament schedules.",
    yearsExperience: 14,
    certifications: ["USPTA Elite", "USTA High Performance", "Safe Play"],
    courts: ["Carlsbad Tennis Club"],
    levels: ["High Performance Juniors", "Advanced", "College Prep"],
    specialties: ["Physical conditioning", "Mental toughness", "Tournament preparation"],
    lessonRates: {
      private: "$95",
      group: "$55",
    },
    languages: ["English", "Spanish"],
    availability: "Weekend training blocks & select weekdays",
    nextAvailableLesson: {
      day: "Sat, May 18",
      time: "10:00 AM",
      court: "Carlsbad Tennis Club · Stadium Court",
    },
    highlights: [
      { icon: "calendar", label: "Weekend" },
      { icon: "map", label: "Carlsbad Tennis Club" },
      { icon: "message", label: "Responds in 3 hours" },
    ],
    tags: ["Junior focus", "Strength", "Tournament prep"],
    imageUrl:
      "https://images.unsplash.com/photo-1552346154-21d32810aba3?auto=format&fit=crop&w=256&q=80",
  },
  {
    id: 4,
    name: "Michael Chen",
    title: "Former NCAA Captain",
    rating: 4.7,
    reviewCount: 112,
    location: "Exchange Tennis Centre",
    pricePerHour: "$70",
    availabilityTag: "Available",
    featured: false,
    summary: "Fast-paced sessions for all-court players with emphasis on transition play and consistency.",
    bio: "Michael channels his NCAA playing experience into upbeat, energetic court sessions that sharpen instincts at the net and in transition. He emphasizes decision-making under pressure with competitive live-ball reps.",
    yearsExperience: 7,
    certifications: ["USPTR Professional", "Safe Play"],
    courts: ["Exchange Tennis Centre", "Lakeside Racquet Club"],
    levels: ["Beginner", "Intermediate", "Doubles League"],
    specialties: ["Net rush tactics", "Doubles formations", "Serve +1 planning"],
    lessonRates: {
      private: "$70",
      group: "$35",
    },
    languages: ["English", "Mandarin"],
    availability: "Weekday evenings & Sunday mornings",
    nextAvailableLesson: {
      day: "Thu, May 16",
      time: "6:15 PM",
      court: "Exchange Tennis Centre · Court 7",
    },
    highlights: [
      { icon: "calendar", label: "Weekday evenings" },
      { icon: "map", label: "Exchange Tennis Centre" },
      { icon: "message", label: "Responds in 1 hour" },
    ],
    tags: ["Approach shots", "Doubles", "Serve +1"],
    imageUrl:
      "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=256&q=80",
  },
];
