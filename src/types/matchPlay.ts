export type MatchDurationOption = "60" | "90" | "120";

export type ConnectIntent = {
  invitee: {
    id: string;
    name: string;
    avatarUrl?: string | null;
    level?: string;
  };
  senderName?: string;
  senderLevel?: string;
  suggestedAvailability?: string[];
  preferredCourt?: string | null;
  source?: string;
};

export type MatchDraftDetails = {
  matchType: "open" | "private";
  date: string;
  time: string;
  duration: MatchDurationOption;
  location: string;
  playersNeeded: number;
  isUnlimitedPlayers: boolean;
};
