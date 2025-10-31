export type Coach = {
  id: number;
  name: string;
  rating: number;
  location: string;
  pricePerHour: string;
  tags: string[];
  imageUrl: string;
  availability?: string;
  featured?: boolean;
  experience?: string;
  summary?: string;
  sessions?: string;
  status?: string;
};

export const mockCoaches: Coach[] = [
  {
    id: 1,
    name: "Alex Johnson",
    rating: 4.9,
    location: "London, UK",
    pricePerHour: "£42/hr",
    tags: ["Footwork", "Serve", "Mental Game"],
    imageUrl:
      "https://images.unsplash.com/photo-1547347298-4074fc3086f0?auto=format&fit=crop&w=720&q=80",
    availability: "Evenings",
    featured: true,
    experience: "Former ATP coach",
    summary: "Helps intermediate to advanced players sharpen tactical awareness.",
    sessions: "48 students coached",
    status: "Accepting new students",
  },
  {
    id: 2,
    name: "Priya Desai",
    rating: 4.8,
    location: "Birmingham, UK",
    pricePerHour: "£38/hr",
    tags: ["Baseline", "Strategy"],
    imageUrl:
      "https://images.unsplash.com/photo-1521412644187-c49fa049e84d?auto=format&fit=crop&w=720&q=80",
    availability: "Weekends",
    experience: "LTA Level 3",
    summary: "Focuses on sustainable progression with data-backed training plans.",
    sessions: "32 students coached",
    status: "Online now",
  },
  {
    id: 3,
    name: "Mateo Alvarez",
    rating: 5,
    location: "Manchester, UK",
    pricePerHour: "£55/hr",
    tags: ["Serve", "Volley", "Doubles"],
    imageUrl:
      "https://images.unsplash.com/photo-1576618148400-f54bed99fcfd?auto=format&fit=crop&w=720&q=80",
    availability: "Mornings",
    featured: true,
    experience: "Former Davis Cup",
    summary: "Explosive serve-and-volley specialist with performance analytics.",
    sessions: "61 students coached",
    status: "2 slots left this week",
  },
  {
    id: 4,
    name: "Sofia Ricci",
    rating: 4.7,
    location: "Edinburgh, UK",
    pricePerHour: "£35/hr",
    tags: ["Juniors", "Mindset"],
    imageUrl:
      "https://images.unsplash.com/photo-1521412644187-c49fa049e84d?auto=format&fit=crop&w=720&q=80",
    availability: "Afternoons",
    experience: "Junior specialist",
    summary: "Transforms young competitors with confidence and court craft.",
    sessions: "24 students coached",
    status: "Waitlist open",
  },
  {
    id: 5,
    name: "Noah Williams",
    rating: 4.9,
    location: "Leeds, UK",
    pricePerHour: "£46/hr",
    tags: ["Conditioning", "Serve"],
    imageUrl:
      "https://images.unsplash.com/photo-1521412644187-c49fa049e84d?auto=format&fit=crop&w=720&q=80",
    availability: "Flexible",
    experience: "Performance coach",
    summary: "High-intensity sessions with wearable tracking and reviews.",
    sessions: "41 students coached",
    status: "Responds within 2h",
  },
  {
    id: 6,
    name: "Lina Becker",
    rating: 4.6,
    location: "Bristol, UK",
    pricePerHour: "£33/hr",
    tags: ["Defense", "Singles"],
    imageUrl:
      "https://images.unsplash.com/photo-1521412644187-c49fa049e84d?auto=format&fit=crop&w=720&q=80",
    availability: "Evenings",
    experience: "USTA Elite",
    summary: "Structured singles play progressions and match-play breakdowns.",
    sessions: "28 students coached",
    status: "Responds within 4h",
  },
];
