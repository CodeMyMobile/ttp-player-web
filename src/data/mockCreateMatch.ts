export type CreatedMatchSummary = {
  id: string;
  title: string;
  matchType: string;
  hostName: string;
  dateLabel: string;
  timeLabel: string;
  locationName: string;
  locationDetail: string;
  playersNeededLabel: string;
  skillLevelLabel: string;
  skillDescription: string;
  formatLabel: string;
  courtLabel: string;
  notes: string;
  visibilityLabel: string;
  visibilityDescription: string;
  shareLink: string;
  startDateTime: string;
  endDateTime: string;
  timezone: string;
};

export const createdMatchSummary: CreatedMatchSummary = {
  id: "sunset-rally-penmar",
  title: "Sunset rally at Penmar",
  matchType: "Open match",
  hostName: "Jordan Lee",
  dateLabel: "Fri, Apr 26",
  timeLabel: "6:00 PM – 8:00 PM",
  locationName: "Penmar Recreation Center",
  locationDetail: "Venice, CA",
  playersNeededLabel: "You + 3 players",
  skillLevelLabel: "3.0 – 3.5 NTRP",
  skillDescription: "Consistent baseline play",
  formatLabel: "Doubles",
  courtLabel: "Court 4",
  notes: "Bring a new can of balls and arrive 10 minutes early.",
  visibilityLabel: "Public link",
  visibilityDescription: "Appears in match search and accepts requests.",
  shareLink: "https://ttp.tennis/matches/sunset-rally",
  startDateTime: "2024-04-27T01:00:00.000Z",
  endDateTime: "2024-04-27T03:00:00.000Z",
  timezone: "America/Los_Angeles",
};
