import { mockCoaches } from "./mockCoaches";

export type GroupLessonLevel = 2 | 2.5 | 3 | 3.5 | 4 | 4.5 | 5 | 5.5 | 6;

export type GroupLesson = {
  id: string;
  title: string;
  coachId: number;
  coachName: string;
  coachAvatarUrl: string;
  level: GroupLessonLevel;
  skillLabel: string;
  day: string;
  startTime: string;
  durationMinutes: number;
  locationName: string;
  locationCity: string;
  distanceMiles: number;
  totalSpots: number;
  availableSpots: number;
  focus: string;
  courtSurface?: string;
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
    day: "Tuesday",
    startTime: "6:00 PM",
    durationMinutes: 90,
    locationName: "Greenwich Tennis Center · Court 4",
    locationCity: "San Francisco, CA",
    distanceMiles: 4.2,
    totalSpots: 6,
    availableSpots: 2,
    focus: "Aggressive net positioning, poaching cues, and serve + return patterns",
    courtSurface: "Hard",
  },
  {
    id: "lesson-102",
    title: "Kick Serve Confidence Lab",
    coachId: 2,
    coachName: "David Park",
    coachAvatarUrl: findCoachAvatar(2),
    level: 3.5,
    skillLabel: "Upper Intermediate",
    day: "Wednesday",
    startTime: "7:15 PM",
    durationMinutes: 75,
    locationName: "Vista Courts · Court 2",
    locationCity: "San Francisco, CA",
    distanceMiles: 6.8,
    totalSpots: 5,
    availableSpots: 1,
    focus: "Serve trajectory mapping, toss consistency, and topspin-driven second serves",
    courtSurface: "Hard",
  },
  {
    id: "lesson-103",
    title: "Foundations: Rally & Recover",
    coachId: 4,
    coachName: "Michael Chen",
    coachAvatarUrl: findCoachAvatar(4),
    level: 2.5,
    skillLabel: "Developing",
    day: "Thursday",
    startTime: "5:30 PM",
    durationMinutes: 60,
    locationName: "Lakeview Park Courts",
    locationCity: "Oakland, CA",
    distanceMiles: 9.5,
    totalSpots: 8,
    availableSpots: 4,
    focus: "Live ball rallying fundamentals, spacing, and first-step movement",
    courtSurface: "Hard",
  },
  {
    id: "lesson-104",
    title: "Elite Baseline Ball Striking",
    coachId: 3,
    coachName: "Sarah Martinez",
    coachAvatarUrl: findCoachAvatar(3),
    level: 4.5,
    skillLabel: "Competitive",
    day: "Saturday",
    startTime: "9:00 AM",
    durationMinutes: 120,
    locationName: "Carlsbad Tennis Club · Stadium Court",
    locationCity: "San Francisco, CA",
    distanceMiles: 12.4,
    totalSpots: 4,
    availableSpots: 1,
    focus: "Heavy topspin drives, depth control under pressure, and transition footwork",
    courtSurface: "Clay",
  },
  {
    id: "lesson-105",
    title: "Junior Match Play Pod",
    coachId: 5,
    coachName: "Avery Johnson",
    coachAvatarUrl: findCoachAvatar(5),
    level: 3.0,
    skillLabel: "Junior Competitive",
    day: "Sunday",
    startTime: "1:00 PM",
    durationMinutes: 150,
    locationName: "Mission Bay Tennis Pavilion",
    locationCity: "San Francisco, CA",
    distanceMiles: 3.1,
    totalSpots: 10,
    availableSpots: 5,
    focus: "Live match rotations, score tracking, and situational coaching between changeovers",
    courtSurface: "Hard",
  },
  {
    id: "lesson-106",
    title: "Serve + First Ball Pressures",
    coachId: 6,
    coachName: "Lena Fischer",
    coachAvatarUrl: findCoachAvatar(6),
    level: 4.0,
    skillLabel: "USTA League Ready",
    day: "Monday",
    startTime: "6:30 AM",
    durationMinutes: 75,
    locationName: "Presidio Tennis Complex",
    locationCity: "San Francisco, CA",
    distanceMiles: 2.6,
    totalSpots: 6,
    availableSpots: 3,
    focus: "First-serve targets, return depth, and high-percentage third ball choices",
    courtSurface: "Hard",
  },
];

export const findGroupLessonById = (lessonId: string) =>
  mockGroupLessons.find((lesson) => lesson.id === lessonId);
