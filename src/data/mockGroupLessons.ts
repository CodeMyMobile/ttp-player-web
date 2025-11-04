import { mockCoaches } from "./mockCoaches";
import type { GroupParticipant } from "./mockCoachProfiles";

export type GroupLessonLevel = 2 | 2.5 | 3 | 3.5 | 4 | 4.5 | 5 | 5.5 | 6;

export type GroupLesson = {
  id: string;
  title: string;
  coachId: number;
  coachName: string;
  coachAvatarUrl: string;
  level: GroupLessonLevel;
  skillLabel: string;
  description: string;
  day: string;
  date: string;
  startTime: string;
  durationMinutes: number;
  locationName: string;
  locationCity: string;
  distanceMiles: number;
  totalSpots: number;
  availableSpots: number;
  focus: string;
  courtSurface?: string;
  pricePerPlayer: string;
  participants: GroupParticipant[];
  highlights?: string[];
};

const findCoachAvatar = (coachId: number) => {
  const coach = mockCoaches.find((entry) => entry.id === coachId);
  return coach?.imageUrl ??
    "https://images.unsplash.com/photo-1544717302-de2939b7ef71?auto=format&fit=crop&w=256&q=80";
};

export const mockGroupLessons: GroupLesson[] = [
  {
    id: "lesson-101",
    title: "Doubles Patterns & Net Play",
    coachId: 1,
    coachName: "Maria Santos",
    coachAvatarUrl: findCoachAvatar(1),
    level: 3.0,
    skillLabel: "Intermediate Doubles",
    description:
      "Sharpen your instincts at the net with high-rep pattern drills, live-point poaching reps, and decision-making frameworks that translate to match day.",
    day: "Tuesday",
    date: "Tuesday, April 23",
    startTime: "6:00 PM",
    durationMinutes: 90,
    locationName: "Greenwich Tennis Center · Court 4",
    locationCity: "San Francisco, CA",
    distanceMiles: 4.2,
    totalSpots: 6,
    availableSpots: 2,
    focus: "Aggressive net positioning, poaching cues, and serve + return patterns",
    courtSurface: "Hard",
    pricePerPlayer: "$45 per player",
    participants: [
      {
        id: "participant-101-1",
        name: "Lena H.",
        skillLevel: "3.0 Doubles",
        focusArea: "Net confidence",
        joinedLabel: "Joined 2 days ago",
      },
      {
        id: "participant-101-2",
        name: "Priya K.",
        skillLevel: "3.2 UTR",
        focusArea: "Poaching reads",
        joinedLabel: "Joined yesterday",
      },
      {
        id: "participant-101-3",
        name: "Jess M.",
        skillLevel: "USTA 3.0",
        focusArea: "Return placement",
        joinedLabel: "Joined today",
      },
      {
        id: "participant-101-4",
        name: "Tamara S.",
        skillLevel: "USTA 2.9",
        focusArea: "1st volley shape",
        joinedLabel: "Joined today",
      },
    ],
    highlights: ["Live point rotations", "Targeted doubles patterns", "Coach feedback each rep"],
  },
  {
    id: "lesson-102",
    title: "Kick Serve Confidence Lab",
    coachId: 2,
    coachName: "David Park",
    coachAvatarUrl: findCoachAvatar(2),
    level: 3.5,
    skillLabel: "Upper Intermediate",
    description:
      "Dial in a reliable topspin serve with sequencing that keeps you on rhythm. We’ll cover toss checkpoints, leg drive, and spin-friendly targets.",
    day: "Wednesday",
    date: "Wednesday, April 24",
    startTime: "7:15 PM",
    durationMinutes: 75,
    locationName: "Vista Courts · Court 2",
    locationCity: "San Francisco, CA",
    distanceMiles: 6.8,
    totalSpots: 5,
    availableSpots: 1,
    focus: "Serve trajectory mapping, toss consistency, and topspin-driven second serves",
    courtSurface: "Hard",
    pricePerPlayer: "$49 per player",
    participants: [
      {
        id: "participant-102-1",
        name: "Alex R.",
        skillLevel: "3.5 League",
        focusArea: "Second serve shape",
        joinedLabel: "Joined 5 days ago",
      },
      {
        id: "participant-102-2",
        name: "Miguel T.",
        skillLevel: "3.4 UTR",
        focusArea: "Kick height",
        joinedLabel: "Joined 3 days ago",
      },
      {
        id: "participant-102-3",
        name: "Riley B.",
        skillLevel: "USTA 3.5",
        focusArea: "Toss timing",
        joinedLabel: "Joined yesterday",
      },
      {
        id: "participant-102-4",
        name: "Evan L.",
        skillLevel: "3.6 Doubles",
        focusArea: "Serve +1",
        joinedLabel: "Joined yesterday",
      },
    ],
    highlights: ["Spin mapping drills", "Video feedback", "Serve target ladder"],
  },
  {
    id: "lesson-103",
    title: "Foundations: Rally & Recover",
    coachId: 4,
    coachName: "Michael Chen",
    coachAvatarUrl: findCoachAvatar(4),
    level: 2.5,
    skillLabel: "Developing",
    description:
      "Build confident baseline rallies with balance and spacing reps tailored for newer players. Expect upbeat coaching and simple checkpoints you can repeat on your own.",
    day: "Thursday",
    date: "Thursday, April 25",
    startTime: "5:30 PM",
    durationMinutes: 60,
    locationName: "Lakeview Park Courts",
    locationCity: "Oakland, CA",
    distanceMiles: 9.5,
    totalSpots: 8,
    availableSpots: 4,
    focus: "Live ball rallying fundamentals, spacing, and first-step movement",
    courtSurface: "Hard",
    pricePerPlayer: "$35 per player",
    participants: [
      {
        id: "participant-103-1",
        name: "Jordan P.",
        skillLevel: "NTRP 2.5",
        focusArea: "Consistent rallying",
        joinedLabel: "Joined 4 days ago",
      },
      {
        id: "participant-103-2",
        name: "Mei L.",
        skillLevel: "Beginner",
        focusArea: "Split step timing",
        joinedLabel: "Joined 2 days ago",
      },
      {
        id: "participant-103-3",
        name: "Chris A.",
        skillLevel: "2.4 UTR",
        focusArea: "Footwork patterns",
        joinedLabel: "Joined today",
      },
      {
        id: "participant-103-4",
        name: "Mila R.",
        skillLevel: "2.6 Doubles",
        focusArea: "Contact point",
        joinedLabel: "Joined today",
      },
    ],
    highlights: ["Live ball reps", "Recovery footwork", "Coach feedback loops"],
  },
  {
    id: "lesson-104",
    title: "Elite Baseline Ball Striking",
    coachId: 3,
    coachName: "Sarah Martinez",
    coachAvatarUrl: findCoachAvatar(3),
    level: 4.5,
    skillLabel: "Competitive",
    description:
      "High-tempo drilling with depth targets, heavy spin patterns, and situational point play designed for experienced tournament players.",
    day: "Saturday",
    date: "Saturday, April 27",
    startTime: "9:00 AM",
    durationMinutes: 120,
    locationName: "Carlsbad Tennis Club · Stadium Court",
    locationCity: "San Francisco, CA",
    distanceMiles: 12.4,
    totalSpots: 4,
    availableSpots: 1,
    focus: "Heavy topspin drives, depth control under pressure, and transition footwork",
    courtSurface: "Clay",
    pricePerPlayer: "$60 per player",
    participants: [
      {
        id: "participant-104-1",
        name: "Luca D.",
        skillLevel: "5.0 Tournament",
        focusArea: "Baseline aggression",
        joinedLabel: "Joined 1 week ago",
      },
      {
        id: "participant-104-2",
        name: "Sophie W.",
        skillLevel: "4.7 UTR",
        focusArea: "Depth control",
        joinedLabel: "Joined 3 days ago",
      },
      {
        id: "participant-104-3",
        name: "Andre C.",
        skillLevel: "4.6 League",
        focusArea: "Spin conversion",
        joinedLabel: "Joined yesterday",
      },
    ],
    highlights: ["High tempo drilling", "Advanced footwork", "Live point coaching"],
  },
  {
    id: "lesson-105",
    title: "Junior Match Play Pod",
    coachId: 5,
    coachName: "Avery Johnson",
    coachAvatarUrl: findCoachAvatar(5),
    level: 3.0,
    skillLabel: "Junior Competitive",
    description:
      "Structured junior match play rotations with scoring accountability and between-point coaching to build confident competitors.",
    day: "Sunday",
    date: "Sunday, April 28",
    startTime: "1:00 PM",
    durationMinutes: 150,
    locationName: "Mission Bay Tennis Pavilion",
    locationCity: "San Francisco, CA",
    distanceMiles: 3.1,
    totalSpots: 10,
    availableSpots: 5,
    focus: "Live match rotations, score tracking, and situational coaching between changeovers",
    courtSurface: "Hard",
    pricePerPlayer: "$40 per player",
    participants: [
      {
        id: "participant-105-1",
        name: "Maya G.",
        skillLevel: "Junior 12U",
        focusArea: "Serve routines",
        joinedLabel: "Joined 6 days ago",
      },
      {
        id: "participant-105-2",
        name: "Ethan K.",
        skillLevel: "Junior 14U",
        focusArea: "Pattern discipline",
        joinedLabel: "Joined 4 days ago",
      },
      {
        id: "participant-105-3",
        name: "Naomi P.",
        skillLevel: "Junior 12U",
        focusArea: "Score tracking",
        joinedLabel: "Joined 2 days ago",
      },
      {
        id: "participant-105-4",
        name: "Alexis B.",
        skillLevel: "Junior 14U",
        focusArea: "Shot selection",
        joinedLabel: "Joined today",
      },
      {
        id: "participant-105-5",
        name: "Jordan C.",
        skillLevel: "Junior 13U",
        focusArea: "Transition game",
        joinedLabel: "Joined today",
      },
    ],
    highlights: ["Live scoring reps", "Coach check-ins", "Video match review"],
  },
  {
    id: "lesson-106",
    title: "Serve + First Ball Pressures",
    coachId: 6,
    coachName: "Lena Fischer",
    coachAvatarUrl: findCoachAvatar(6),
    level: 4.0,
    skillLabel: "USTA League Ready",
    description:
      "Own the first two shots of every point with targeted serve locations and aggressive plus-one patterns designed for league match pressure.",
    day: "Monday",
    date: "Monday, April 29",
    startTime: "6:30 AM",
    durationMinutes: 75,
    locationName: "Presidio Tennis Complex",
    locationCity: "San Francisco, CA",
    distanceMiles: 2.6,
    totalSpots: 6,
    availableSpots: 3,
    focus: "First-serve targets, return depth, and high-percentage third ball choices",
    courtSurface: "Hard",
    pricePerPlayer: "$42 per player",
    participants: [
      {
        id: "participant-106-1",
        name: "Ryan V.",
        skillLevel: "4.0 League",
        focusArea: "Serve +1 forehand",
        joinedLabel: "Joined 3 days ago",
      },
      {
        id: "participant-106-2",
        name: "Camila F.",
        skillLevel: "3.9 UTR",
        focusArea: "Return depth",
        joinedLabel: "Joined 2 days ago",
      },
      {
        id: "participant-106-3",
        name: "Noah S.",
        skillLevel: "4.1 Doubles",
        focusArea: "Plus-one footwork",
        joinedLabel: "Joined today",
      },
    ],
    highlights: ["Serve target ladders", "Pattern rehearsal", "Pressure drills"],
  },
];

export const findGroupLessonById = (lessonId: string) =>
  mockGroupLessons.find((lesson) => lesson.id === lessonId);
