// "Help me choose" (VITE_RESTRING_V2): five questions, level first. The answers go to the
// API's recommendation engine (POST /restringing/recommendations), the same one the coach
// app uses, which returns a pick and up to two alternatives from the shop's strings with
// reasons and how they differ.

export const QUIZ_QUESTIONS = [
  {
    key: "level",
    label: "What’s your level?",
    options: [
      { value: "getting_started", label: "Getting started", hint: "NTRP 2.5–3.0" },
      { value: "intermediate", label: "Intermediate", hint: "NTRP 3.5–4.0" },
      { value: "advanced", label: "Advanced", hint: "NTRP 4.5+" },
      { value: "competitive", label: "Competitive", hint: "Tournaments, college, open" },
    ],
  },
  {
    key: "arm",
    label: "Any arm, elbow or shoulder discomfort?",
    options: [
      { value: "no", label: "No" },
      { value: "sometimes", label: "Sometimes" },
      { value: "yes", label: "Yes, right now" },
    ],
  },
  {
    key: "priority",
    label: "What matters most?",
    options: [
      { value: "spin", label: "Spin" },
      { value: "control", label: "Control" },
      { value: "power", label: "Power" },
      { value: "comfort", label: "Comfort" },
    ],
  },
  {
    key: "frequency",
    label: "How often do you play?",
    options: [
      { value: "weekly", label: "Once a week or less" },
      { value: "few", label: "2–3 times a week" },
      { value: "most_days", label: "4 or more times a week" },
    ],
  },
  {
    key: "breakage",
    label: "How often do you break strings?",
    options: [
      { value: "rarely", label: "Rarely or never" },
      { value: "sometimes", label: "Every couple of months" },
      { value: "often", label: "Every few weeks or more" },
    ],
  },
];

/**
 * The level option to pre-select from the player's NTRP, or null without one. Competitive is
 * never assumed: a rating doesn't say whether someone plays tournaments.
 */
export function levelFromNtrp(ntrp) {
  const value = Number(ntrp);
  if (!Number.isFinite(value) || value <= 0) return null;
  if (value < 3.25) return "getting_started";
  if (value < 4.5) return "intermediate";
  return "advanced";
}
