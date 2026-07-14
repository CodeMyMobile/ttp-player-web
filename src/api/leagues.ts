import { request } from "./http";

export type LeagueListSegment = "available" | "mine" | "archived";
export type LeagueGender = "men" | "women" | "mixed";

export interface League {
  id: number | string;
  name: string;
  skill_band?: string;
  gender?: LeagueGender | null;
  format?: string;
  status?: string;
  start_date?: string;
  end_date?: string | null;
  deadline?: string;
  membership_status?: string;
  joined_via?: string | null;
  paid?: boolean;
  current_rules_version?: string | null;
  location?: string | null;
  venue_id?: number | string | null;
  venue_name?: string | null;
  venue_area?: string | null;
  venue_latitude?: number | string | null;
  venue_longitude?: number | string | null;
  spots_filled?: number | string | null;
  spots_remaining?: number | string | null;
  is_full?: boolean | null;
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
  // Backend-computed conversions from the TRP (current_rating), distinct from the
  // player-entered usta_rating / uta_rating above.
  calculated_ntrp?: number | string | null;
  calculated_utr?: number | string | null;
  // Used only as the base for an estimated NTRP when no real value exists.
  rating_gender?: string | null;
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
  timezone?: string | null;
  time_variance_minutes?: number;
  distance_miles?: string | number | null;
  has_played_before?: boolean;
  // Availability of the underlying match (backend may send either). Absent = treat
  // as available (fail open) — see isLeagueSlotAvailable.
  status?: string | null;
  is_available?: boolean | null;
  [key: string]: unknown;
}

export interface LeagueMatchNeed {
  id: number | string;
  league_id?: number | string;
  host_id?: number | string;
  player_id?: number | string;
  player_name?: string | null;
  player_skill?: string | number | null;
  status?: string;
  start_date_time?: string;
  timezone?: string | null;
  location?: string | null;
  match_location?: string | null;
  location_text?: string;
  latitude?: number | string | null;
  longitude?: number | string | null;
  distance_miles?: string | number | null;
  has_played_before?: boolean;
  time_variance_minutes?: number | null;
  is_available?: boolean | null;
  league_visibility?: "league" | "open" | string;
  [key: string]: unknown;
}

export interface LeagueCapacity {
  spots_filled: number | null;
  spots_remaining: number | null;
  is_full: boolean;
}

export interface LeagueSections {
  mine: League[];
  available: League[];
  archived: League[];
}

export interface LeagueMembershipState {
  status?: string | null;
  joined_via?: string | null;
  paid?: boolean | null;
}

export interface LeagueListResponse {
  leagues: League[];
  sections: LeagueSections;
}

export interface LeagueDetailResponse {
  league: League;
  metadata: LeagueCapacity;
  membership_state: LeagueMembershipState | null;
}

export interface LeagueRuleVersion {
  id: number | string;
  league_id: number | string;
  version: string;
  content?: string | null;
  published_at?: string | null;
  [key: string]: unknown;
}

export interface LeagueRules {
  league: League;
  rule: LeagueRuleVersion | null;
}

export interface LeaguePaymentIntentResponse {
  attempt_id: string;
  client_secret: string;
  expires_at: string;
}

export interface LeagueEnrollmentResponse {
  membership?: {
    id?: number | string;
    league_id?: number | string;
    player_id?: number | string;
    status?: string;
    [key: string]: unknown;
  };
  agreement?: {
    id?: number | string;
    rules_version?: string;
    signed_at?: string;
    [key: string]: unknown;
  };
  seeding?: {
    seeded?: boolean;
    starting_rating?: number | string | null;
    seeded_at?: string | null;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

// Is the underlying match still joinable? Backend may send is_available (bool) or
// status ("open"/"confirmed"/…). Fail OPEN: if neither is present, treat as
// available so nothing is wrongly hidden/disabled before the backend adds the flag.
export const isLeagueSlotAvailable = (
  item?: { status?: string | null; is_available?: boolean | null } | null,
): boolean => {
  if (!item) return true;
  if (item.is_available === false) return false;
  if (typeof item.status === "string" && item.status && item.status !== "open") return false;
  return true;
};

export interface LeagueListParams {
  segment?: LeagueListSegment;
  location?: string;
  area?: string;
  venueId?: number | string;
}

export const buildLeagueListPath = (params: LeagueListSegment | LeagueListParams = {}) => {
  const normalized = typeof params === "string" ? { segment: params } : params;
  const search = new URLSearchParams();
  if (normalized.segment) search.set("segment", normalized.segment);
  if (normalized.location) search.set("location", normalized.location);
  if (normalized.area) search.set("area", normalized.area);
  if (normalized.venueId) search.set("venue_id", String(normalized.venueId));
  const query = search.toString();
  return query ? `/leagues?${query}` : "/leagues";
};

export const buildLeagueDetailPath = (leagueId: number | string) => `/leagues/${leagueId}`;

export const buildLeagueRulesPath = (leagueId: number | string) =>
  `${buildLeagueDetailPath(leagueId)}/rules`;

export const listLeagues = ({
  segment,
  location,
  area,
  venueId,
  token,
  signal,
}: {
  segment?: LeagueListSegment;
  location?: string;
  area?: string;
  venueId?: number | string;
  token?: string;
  signal?: AbortSignal;
} = {}) =>
  request<LeagueListResponse>(buildLeagueListPath({ segment, location, area, venueId }), { token, signal });

export const listMyLeagues = ({ token, signal }: { token?: string; signal?: AbortSignal } = {}) =>
  request<LeagueListResponse>("/leagues", { token, signal });

export const getLeagueDetail = ({
  leagueId,
  token,
  signal,
}: {
  leagueId: number | string;
  token?: string;
  signal?: AbortSignal;
}) =>
  request<LeagueDetailResponse>(buildLeagueDetailPath(leagueId), {
    token,
    signal,
  });

export const getLeagueRules = ({
  leagueId,
  token,
  signal,
}: {
  leagueId: number | string;
  token?: string;
  signal?: AbortSignal;
}) =>
  request<LeagueRules>(buildLeagueRulesPath(leagueId), {
    token,
    signal,
  });

export const createLeaguePaymentIntent = ({
  leagueId,
  idempotencyKey,
  token,
  signal,
}: {
  leagueId: number | string;
  idempotencyKey: string;
  token: string;
  signal?: AbortSignal;
}) =>
  request<LeaguePaymentIntentResponse, { league_id: number | string; idempotency_key: string }>(
    "/player/stripe/league-paymentintent",
    {
      method: "POST",
      token,
      body: {
        league_id: leagueId,
        idempotency_key: idempotencyKey,
      },
      signal,
    },
  );

export const completeLeagueEnrollment = ({
  leagueId,
  attemptId,
  paymentIntentId,
  paymentIntentStatus,
  signedName,
  rulesVersion,
  token,
  signal,
}: {
  leagueId: number | string;
  attemptId: string;
  paymentIntentId: string;
  paymentIntentStatus: string;
  signedName: string;
  rulesVersion: string;
  token: string;
  signal?: AbortSignal;
}) =>
  request<LeagueEnrollmentResponse, {
    attempt_id: string;
    payment_intent_id: string;
    payment_intent_status: string;
    signed_name: string;
    rules_version: string;
  }>(`${buildLeagueDetailPath(leagueId)}/enroll`, {
    method: "POST",
    token,
    body: {
      attempt_id: attemptId,
      payment_intent_id: paymentIntentId,
      payment_intent_status: paymentIntentStatus,
      signed_name: signedName,
      rules_version: rulesVersion,
    },
    signal,
  });

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

export const previewLeagueMatchNeed = ({
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
  request<{ draft: LeagueMatchNeed; suggestions: LeagueMatchSuggestion[] }>(
    `/leagues/${leagueId}/match-needs/preview`,
    {
      method: "POST",
      token,
      body,
      signal,
    },
  );

export const getLeagueMatchNeeds = ({
  leagueId,
  token,
  scope,
  signal,
}: {
  leagueId: number | string;
  token?: string;
  scope?: "all";
  signal?: AbortSignal;
}) =>
  request<{
    league: League;
    myNeeds?: LeagueMatchNeed[];
    suggestions?: LeagueMatchSuggestion[];
    needs?: LeagueMatchNeed[];
  }>(
    `/leagues/${leagueId}/match-needs`,
    { token, signal, query: { scope } },
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

export const acceptLeagueMatchNeedPreview = ({
  leagueId,
  suggestedMatchId,
  token,
  message,
}: {
  leagueId: number | string;
  suggestedMatchId: number | string;
  token?: string;
  message?: string;
}) =>
  request<{ matchId: number | string; status: string }>(`/leagues/${leagueId}/match-needs/preview/accept`, {
    method: "POST",
    token,
    body: {
      suggested_match_id: suggestedMatchId,
      message,
    },
  });

export const sendLeagueMatchNeedInvites = ({
  leagueId,
  matchId,
  token,
  body,
}: {
  leagueId: number | string;
  matchId: number | string;
  token?: string;
  body: {
    player_ids: Array<number | string>;
    message: string;
  };
}) =>
  request<{ message: string; invites: Array<Record<string, unknown>> }>(
    `/leagues/${leagueId}/match-needs/${matchId}/invites`,
    {
      method: "POST",
      token,
      body,
    },
  );

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
