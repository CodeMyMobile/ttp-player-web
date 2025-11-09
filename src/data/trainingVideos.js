import { trainingCollections } from "./trainingPlaylists";

const playlistLookup = trainingCollections.reduce((accumulator, playlist) => {
  accumulator[playlist.id] = playlist;
  return accumulator;
}, {});

export const trainingVideos = [
  {
    id: "all-0",
    title: "Matchplay onboarding workout",
    description: "Full-body activation that pairs dynamic footwork with rally tempo to prep for any session.",
    focus: ["Movement", "Consistency"],
    skillLevel: "All levels",
    duration: "12:08",
    playlistKey: "all",
    playlistIndex: 0,
  },
  {
    id: "all-1",
    title: "Baseline rhythm builder",
    description: "Groove timing on both wings by alternating controlled drives with high-margin rally balls.",
    focus: ["Timing", "Rally Patterns"],
    skillLevel: "Intermediate",
    duration: "14:36",
    playlistKey: "all",
    playlistIndex: 1,
  },
  {
    id: "forehand-0",
    title: "Live forehand timing checkpoints",
    description: "Progress through rhythm, spacing, and acceleration checkpoints to dial in a dependable forehand.",
    focus: ["Forehand", "Spacing"],
    skillLevel: "Intermediate",
    duration: "10:22",
    playlistKey: "forehand",
    playlistIndex: 2,
  },
  {
    id: "forehand-1",
    title: "Inside-out drive builder",
    description: "Use inside-out patterns to create court position and finish with aggressive forehand holds.",
    focus: ["Forehand", "Patterns"],
    skillLevel: "Advanced",
    duration: "11:51",
    playlistKey: "forehand",
    playlistIndex: 3,
  },
  {
    id: "backhand-0",
    title: "Two-ball crosscourt progression",
    description: "Link your unit turn to recovery with alternating topspin and neutralizing slices crosscourt.",
    focus: ["Backhand", "Footwork"],
    skillLevel: "Intermediate",
    duration: "13:04",
    playlistKey: "backhand",
    playlistIndex: 4,
  },
  {
    id: "backhand-1",
    title: "Backhand transition starter",
    description: "Blend approach footwork with compact swing paths to take time away from your opponent.",
    focus: ["Backhand", "Transition"],
    skillLevel: "Advanced Beginner",
    duration: "9:57",
    playlistKey: "backhand",
    playlistIndex: 5,
  },
  {
    id: "transition-0",
    title: "First volley reaction reps",
    description: "Accelerate your split step and volley reaction with rapid-fire feeds and balanced recoveries.",
    focus: ["Net Play", "Reflexes"],
    skillLevel: "All levels",
    duration: "8:41",
    playlistKey: "transition",
    playlistIndex: 1,
  },
  {
    id: "transition-1",
    title: "Approach plus cover pattern",
    description: "Practice driving through approach shots and sealing the net with confident finishing targets.",
    focus: ["Transition", "Finishing"],
    skillLevel: "Intermediate",
    duration: "12:29",
    playlistKey: "transition",
    playlistIndex: 3,
  },
  {
    id: "serve-0",
    title: "Serve rhythm build-up drills",
    description: "Stack tempo drills that connect your toss height with knee drive for a smooth, powerful service motion.",
    focus: ["Serve", "Rhythm"],
    skillLevel: "All levels",
    duration: "11:13",
    playlistKey: "serve",
    playlistIndex: 0,
  },
  {
    id: "serve-1",
    title: "Second serve spin challenge",
    description: "Dial in kick and slice variations by progressing from box targets to live point starts.",
    focus: ["Serve", "Spin"],
    skillLevel: "Intermediate",
    duration: "9:35",
    playlistKey: "serve",
    playlistIndex: 2,
  },
  {
    id: "strategy-0",
    title: "Pattern play walkthrough",
    description: "Break down serve +1 and return +1 patterns so you can dictate rallies under pressure.",
    focus: ["Strategy", "Patterns"],
    skillLevel: "Competitive",
    duration: "15:18",
    playlistKey: "strategy",
    playlistIndex: 0,
  },
  {
    id: "strategy-1",
    title: "Momentum reset toolkit",
    description: "Identify tactical resets and momentum breakers to regain control of tight matches.",
    focus: ["Strategy", "Mindset"],
    skillLevel: "All levels",
    duration: "10:45",
    playlistKey: "strategy",
    playlistIndex: 2,
  },
];

export const resolveEmbedUrl = (video) => {
  const playlist = playlistLookup[video.playlistKey];

  if (!playlist) {
    return null;
  }

  const baseUrl = `https://www.youtube-nocookie.com/embed/videoseries?list=${playlist.playlistId}`;
  return `${baseUrl}&index=${video.playlistIndex}`;
};

export const trainingVideoFilters = [
  { id: "all", label: "All content" },
  { id: "saved", label: "Saved sessions" },
  { id: "quick", label: "Under 12 min", predicate: (video) => parseFloat(video.duration) < 12 },
  {
    id: "intermediate",
    label: "Intermediate focus",
    predicate: (video) => video.skillLevel.toLowerCase().includes("intermediate"),
  },
];
