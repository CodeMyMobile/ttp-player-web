import { request } from "./http";

export interface League {
  id: number | string;
  name: string;
  skill_band?: string;
  gender?: string;
  format?: string;
  status?: string;
  start_date?: string;
  deadline?: string;
  membership_status?: string;
  paid?: boolean;
  [key: string]: unknown;
}

export interface LeagueStanding {
  rank: number;
  player_id: number | string;
  full_name?: string | null;
  membership_status?: string;
  matches_played: number;
  wins: number;
  losses: number;
  games_for: number;
  games_against: number;
  game_differential: number;
  [key: string]: unknown;
}

export interface LeaguePlayer {
  player_id: number | string;
  full_name?: string | null;
  current_rating?: number | string | null;
  usta_rating?: number | string | null;
  uta_rating?: number | string | null;
  phone?: string | null;
  email?: string | null;
  membership_status?: string;
  [key: string]: unknown;
}

export interface LeagueResultOpponent {
  player_id: number | string;
  full_name?: string | null;
  current_rating?: number | string | null;
  usta_rating?: number | string | null;
  uta_rating?: number | string | null;
  [key: string]: unknown;
}

export interface LeagueFixture {
  id: number | string;
  league_id: number | string;
  player1_id?: number | string;
  player2_id?: number | string;
  player1_name?: string | null;
  player2_name?: string | null;
  status?: string;
  score?: string | null;
  played_date?: string | null;
  match_number?: number;
  [key: string]: unknown;
}

export interface LeagueMatchSuggestion {
  id: number | string;
  match_id?: number | string;
  suggested_match_id?: number | string;
  suggested_player_id?: number | string;
  player_name?: string | null;
  player_skill?: string | number | null;
  match_date?: string | null;
  match_time?: string | null;
  match_location?: string | null;
  time_variance_minutes?: number;
  distance_miles?: string | number | null;
  has_played_before?: boolean;
  [key: string]: unknown;
}

export interface LeagueMatchNeed {
  id: number | string;
  league_id?: number | string;
  host_id?: number | string;
  status?: string;
  start_date_time?: string;
  location_text?: string;
  league_visibility?: "league" | "open" | string;
  [key: string]: unknown;
}

export const listMyLeagues = ({ token, signal }: { token?: string; signal?: AbortSignal } = {}) =>
  request<{ leagues: League[] }>("/leagues", { token, signal });

export const getLeagueStandings = ({
  leagueId,
  token,
  signal,
}: {
  leagueId: number | string;
  token?: string;
  signal?: AbortSignal;
}) =>
  request<{ league: League; standings: LeagueStanding[] }>(`/leagues/${leagueId}/standings`, {
    token,
    signal,
  });

export const getLeaguePlayers = ({
  leagueId,
  token,
  signal,
}: {
  leagueId: number | string;
  token?: string;
  signal?: AbortSignal;
}) =>
  request<{ league: League; players: LeaguePlayer[] }>(`/leagues/${leagueId}/players`, {
    token,
    signal,
  });

export const getLeagueFixtures = ({
  leagueId,
  token,
  status,
  mine,
  signal,
}: {
  leagueId: number | string;
  token?: string;
  status?: string;
  mine?: boolean;
  signal?: AbortSignal;
}) =>
  request<{ league: League; fixtures: LeagueFixture[] }>(`/leagues/${leagueId}/fixtures`, {
    token,
    signal,
    query: {
      status,
      mine,
    },
  });

export const createLeagueMatchNeed = ({
  leagueId,
  token,
  body,
  signal,
}: {
  leagueId: number | string;
  token?: string;
  body: {
    date: string;
    time: string;
    start_date_time?: string;
    dateTime?: string;
    location: string;
    latitude?: number | null;
    longitude?: number | null;
    visibility?: "league" | "open";
    timezone?: string;
  };
  signal?: AbortSignal;
}) =>
  request<{ match: LeagueMatchNeed; suggestions: LeagueMatchSuggestion[] }>(`/leagues/${leagueId}/match-needs`, {
    method: "POST",
    token,
    body,
    signal,
  });

export const getLeagueMatchNeeds = ({
  leagueId,
  token,
  signal,
}: {
  leagueId: number | string;
  token?: string;
  signal?: AbortSignal;
}) =>
  request<{ league: League; myNeeds: LeagueMatchNeed[]; suggestions: LeagueMatchSuggestion[] }>(
    `/leagues/${leagueId}/match-needs`,
    { token, signal },
  );

export const getLeagueResultOpponents = ({
  leagueId,
  token,
  signal,
}: {
  leagueId: number | string;
  token?: string;
  signal?: AbortSignal;
}) =>
  request<{ league: League; opponents: LeagueResultOpponent[] }>(`/leagues/${leagueId}/result-opponents`, {
    token,
    signal,
  });

export const createLeagueResult = ({
  leagueId,
  token,
  body,
}: {
  leagueId: number | string;
  token?: string;
  body: {
    player_b: number | string;
    played_at: string;
    location: string;
    latitude?: number | null;
    longitude?: number | null;
    format: "single" | "bo3";
    retired: false | { winner: "you" | "opp" };
    sets: Array<{ kind: "set" | "mtb"; you: number; opp: number }>;
    score_string: string;
  };
}) =>
  request<{ match_id: number | string; status: string }>(`/leagues/${leagueId}/results`, {
    method: "POST",
    token,
    body,
  });

export const acceptLeagueMatchSuggestion = ({
  suggestionId,
  token,
}: {
  suggestionId: number | string;
  token?: string;
}) =>
  request<{ matchId: number | string; status: string }>(`/leagues/match-suggestions/${suggestionId}/accept`, {
    method: "POST",
    token,
  });

export const dismissLeagueMatchSuggestion = ({
  suggestionId,
  token,
}: {
  suggestionId: number | string;
  token?: string;
}) =>
  request<{ dismissed: boolean }>(`/leagues/match-suggestions/${suggestionId}/dismiss`, {
    method: "POST",
    token,
  });
