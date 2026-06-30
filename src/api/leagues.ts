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
