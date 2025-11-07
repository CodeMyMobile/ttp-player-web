export type MatchInvitee = {
  id: string;
  name: string;
  avatarUrl: string | null;
  initials: string;
  relationshipLabel: string;
  statusLabel: string;
  statusTone: "host" | "sms" | "pending" | "guest" | "confirmed" | "declined";
  phoneNumber?: string;
  statusDescription?: string;
};

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
  isPrivate: boolean;
  hostInvitee: MatchInvitee;
  inviteSummaryLabel: string;
  inviteNeedsLabel: string;
  invitedPlayers: MatchInvitee[];
  rosterHeaderLabel: string;
  rosterCapacity: number;
  rosterRemaining: number;
  rosterRemainingLabel: string;
  manageCopy: string;
  manageHelper: string;
};

export const createdMatchSummary: CreatedMatchSummary = {
  id: "sunset-rally-penmar",
  title: "Sunset rally at Penmar",
  matchType: "Private match",
  hostName: "Jordan Lee",
  dateLabel: "Fri, Nov 7",
  timeLabel: "6:00 PM – 8:00 PM",
  locationName: "Penmar Recreation Center",
  locationDetail: "Venice, CA",
  playersNeededLabel: "4 players needed",
  skillLevelLabel: "All levels welcome",
  skillDescription: "Private roster only",
  formatLabel: "Doubles Match",
  courtLabel: "Court 4",
  notes: "Bring a new can of balls and arrive 10 minutes early.",
  visibilityLabel: "Private invitations",
  visibilityDescription: "Invites are delivered with unique SMS links.",
  shareLink: "https://ttp.tennis/matches/sunset-rally",
  startDateTime: "2024-04-27T01:00:00.000Z",
  endDateTime: "2024-04-27T03:00:00.000Z",
  timezone: "America/Los_Angeles",
  isPrivate: true,
  hostInvitee: {
    id: "host",
    name: "Jordan Lee",
    avatarUrl:
      "https://images.unsplash.com/photo-1604187351465-a63f69b47032?auto=format&fit=facearea&facepad=2&w=400&h=400&q=80",
    initials: "JL",
    relationshipLabel: "Organizer",
    statusLabel: "Confirmed",
    statusTone: "host",
    phoneNumber: "(310) 555-0118",
    statusDescription: "Primary contact",
  },
  inviteSummaryLabel: "2 players invited",
  inviteNeedsLabel: "4 needed",
  invitedPlayers: [
    {
      id: "grant-hawkins",
      name: "Grant Hawkins",
      avatarUrl:
        "https://images.unsplash.com/photo-1618005198919-d3d4b5a92eee?auto=format&fit=facearea&facepad=3&w=400&h=400&q=80",
      initials: "GH",
      relationshipLabel: "Frequent teammate • 4.0 NTRP",
      statusLabel: "SMS sent",
      statusTone: "sms",
      phoneNumber: "(213) 555-0189",
      statusDescription: "Invitation delivered via SMS",
    },
    {
      id: "lena-kim",
      name: "Lena Kim",
      avatarUrl:
        "https://images.unsplash.com/photo-1544723795-3fb6469f5b39?auto=format&fit=facearea&facepad=3&w=400&h=400&q=80",
      initials: "LK",
      relationshipLabel: "Played last week",
      statusLabel: "Awaiting RSVP",
      statusTone: "pending",
      phoneNumber: "(626) 555-0196",
      statusDescription: "Waiting for confirmation",
    },
    {
      id: "brandon-lowe",
      name: "Brandon Lowe",
      avatarUrl: null,
      initials: "BL",
      relationshipLabel: "Last played 2 weeks ago",
      statusLabel: "Declined",
      statusTone: "declined",
      phoneNumber: "(323) 555-0143",
      statusDescription: "Can't make this match",
    },
  ],
  rosterHeaderLabel: "Players (4 max)",
  rosterCapacity: 4,
  rosterRemaining: 3,
  rosterRemainingLabel: "3 spots remaining",
  manageCopy: "Review the schedule and match information before your players arrive.",
  manageHelper: "Edit match details to adjust timing, notes, or court assignments.",
};
