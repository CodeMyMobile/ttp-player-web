export type CoachHighlightIcon = "map" | "calendar" | "message" | "users" | "spark";

export type CoachHighlight = {
  icon: CoachHighlightIcon;
  label: string;
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
