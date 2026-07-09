export const requiresLeagueAuthPrompt = (isAuthenticated: boolean) => !isAuthenticated;

export interface PendingLeagueJoinRequest {
  leagueId: number | string;
}

export type LeagueJoinGateResult =
  | {
      action: "open_auth";
      pending: PendingLeagueJoinRequest;
    }
  | {
      action: "open_review";
      leagueId: number | string;
      pending: null;
    }
  | {
      action: "idle";
      pending: null;
    };

export const requestLeagueJoin = ({
  isAuthenticated,
  leagueId,
}: {
  isAuthenticated: boolean;
  leagueId: number | string;
}): LeagueJoinGateResult =>
  isAuthenticated
    ? {
        action: "open_review",
        leagueId,
        pending: null,
      }
    : {
        action: "open_auth",
        pending: { leagueId },
      };

export const resumePendingLeagueJoin = ({
  isAuthenticated,
  pending,
}: {
  isAuthenticated: boolean;
  pending: PendingLeagueJoinRequest | null;
}): LeagueJoinGateResult => {
  if (!isAuthenticated || !pending) {
    return {
      action: "idle",
      pending: null,
    };
  }

  return {
    action: "open_review",
    leagueId: pending.leagueId,
    pending: null,
  };
};
