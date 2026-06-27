import { useEffect, useState } from "react";
import api, { unwrap } from "../../services/api";
import { searchPlayers } from "../../services/matches";
import type { CurrentUser, Player, Court, SubmitPayload } from "./scoring";
import { CURRENT_USER } from "./fixtures";

interface ApiPlayer {
  id?: number | string;
  user_id?: number | string;
  full_name?: string | null;
  name?: string | null;
  email?: string | null;
  usta_rating?: string | number | null;
  uta_rating?: string | number | null;
}

interface PlayersState {
  players: Player[];
  loading: boolean;
  error: string | null;
}

interface CourtsState {
  courts: Court[];
  loading: boolean;
  error: string | null;
}

interface ApiCourt {
  id?: number | string;
  name?: string | null;
  area?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
}

interface MatchResultResponse {
  match_id?: number | string;
  status?: string;
  confirm_window_ends_at?: string;
}

interface ApiLeague {
  id?: number | string;
  name?: string | null;
  skill_band?: string | null;
  gender?: string | null;
  status?: string | null;
  start_date?: string | null;
  deadline?: string | null;
}

interface ApiLeagueFixture {
  id?: number | string;
  league_id?: number | string;
  match_number?: number | string;
  player1_id?: number | string;
  player2_id?: number | string;
  player1_name?: string | null;
  player2_name?: string | null;
  status?: string | null;
  score?: string | null;
}

interface LeagueState {
  leagues: League[];
  fixtures: LeagueFixture[];
  loading: boolean;
  error: string | null;
}

export interface League {
  id: string;
  name: string;
  skillBand: string;
  gender: string;
  status: string;
  startDate: string;
  deadline: string;
}

export interface LeagueFixture {
  id: string;
  leagueId: string;
  matchNumber: string;
  player1Id: string;
  player2Id: string;
  player1Name: string;
  player2Name: string;
  status: string;
  score: string | null;
}

export interface MatchResultDetail {
  id: number | string;
  status: "pending" | "confirmed" | "disputed" | "voided" | string;
  player_a: number | string;
  player_b: number | string;
  player_a_name?: string | null;
  player_b_name?: string | null;
  court_name?: string | null;
  court_area?: string | null;
  played_at?: string | null;
  score?: string | null;
  sets?: SubmitSet[] | string | null;
  retired?: boolean | null;
  winner?: number | string | null;
}

const PLAYER_COLORS = [
  "bg-rose-100 text-rose-700",
  "bg-sky-100 text-sky-700",
  "bg-amber-100 text-amber-700",
  "bg-emerald-100 text-emerald-700",
  "bg-indigo-100 text-indigo-700",
  "bg-violet-100 text-violet-700",
];

const normalizePlayer = (player: ApiPlayer, index: number): Player => {
  const id = player.user_id ?? player.id ?? "";
  const name = player.full_name || player.name || player.email || "Player";
  const rating = player.usta_rating ?? player.uta_rating ?? "N/A";

  return {
    id: String(id),
    name,
    ntrp: String(rating),
    color: PLAYER_COLORS[index % PLAYER_COLORS.length],
  };
};

const readStoredObject = (key: string): Record<string, unknown> | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) as Record<string, unknown> : null;
  } catch {
    return null;
  }
};

const firstString = (...values: unknown[]): string | null => {
  for (const value of values) {
    if (value === undefined || value === null || value === "") continue;
    return String(value);
  }
  return null;
};

const normalizeCurrentUser = (authUser?: unknown): CurrentUser => {
  const loginResponse = readStoredObject("authLoginResponse") || {};
  const personalDetails = readStoredObject("playerPersonalDetails") || {};
  const authRecord = authUser && typeof authUser === "object" ? authUser as Record<string, unknown> : {};
  const profile = (
    authRecord.profile && typeof authRecord.profile === "object"
      ? authRecord.profile as Record<string, unknown>
      : {}
  );
  const loginProfile = (
    loginResponse.profile && typeof loginResponse.profile === "object"
      ? loginResponse.profile as Record<string, unknown>
      : loginResponse.user && typeof loginResponse.user === "object"
        ? loginResponse.user as Record<string, unknown>
        : {}
  );

  return {
    id: firstString(
      authRecord.id,
      authRecord.user_id,
      profile.user_id,
      profile.id,
      personalDetails.user_id,
      personalDetails.id,
      loginProfile.user_id,
      loginProfile.id,
      loginResponse.user_id,
    ) || CURRENT_USER.id,
    name: firstString(
      authRecord.name,
      authRecord.full_name,
      profile.full_name,
      personalDetails.full_name,
      loginProfile.full_name,
      loginResponse.full_name,
      authRecord.email,
    ) || CURRENT_USER.name,
    ntrp: firstString(
      authRecord.skillLevel,
      authRecord.skill_level,
      authRecord.usta_rating,
      profile.usta_rating,
      personalDetails.usta_rating,
      loginProfile.usta_rating,
    ) || CURRENT_USER.ntrp,
  };
};

const normalizeCourt = (court: ApiCourt): Court => ({
  id: String(court.id ?? ""),
  name: court.name || "Court",
  area: court.area || "",
  latitude: court.latitude === undefined || court.latitude === null ? null : Number(court.latitude),
  longitude: court.longitude === undefined || court.longitude === null ? null : Number(court.longitude),
});

const normalizeLeague = (league: ApiLeague): League => ({
  id: String(league.id ?? ""),
  name: league.name || "League",
  skillBand: league.skill_band || "",
  gender: league.gender || "",
  status: league.status || "",
  startDate: league.start_date || "",
  deadline: league.deadline || "",
});

const normalizeFixture = (fixture: ApiLeagueFixture): LeagueFixture => ({
  id: String(fixture.id ?? ""),
  leagueId: String(fixture.league_id ?? ""),
  matchNumber: String(fixture.match_number ?? ""),
  player1Id: String(fixture.player1_id ?? ""),
  player2Id: String(fixture.player2_id ?? ""),
  player1Name: fixture.player1_name || `Player ${fixture.player1_id || ""}`,
  player2Name: fixture.player2_name || `Player ${fixture.player2_id || ""}`,
  status: fixture.status || "scheduled",
  score: fixture.score || null,
});

export function useCurrentUser(authUser?: unknown): CurrentUser {
  return normalizeCurrentUser(authUser);
}

export function usePlayers(search = ""): PlayersState {
  const [state, setState] = useState<PlayersState>({
    players: [],
    loading: true,
    error: null,
  });

  useEffect(() => {
    let alive = true;
    const query = search.trim();

    setState((prev) => ({ ...prev, loading: true, error: null }));
    const handler = window.setTimeout(() => {
      searchPlayers({ search: query, page: 1, perPage: 12 })
        .then((data: { players?: ApiPlayer[] }) => {
          if (!alive) return;
          setState({
            players: (data.players || []).map(normalizePlayer),
            loading: false,
            error: null,
          });
        })
        .catch((error: Error) => {
          if (!alive) return;
          console.error("[LogResult] failed to load players", error);
          setState({
            players: [],
            loading: false,
            error: "Failed to load players",
          });
        });
    }, query ? 300 : 0);

    return () => {
      alive = false;
      window.clearTimeout(handler);
    };
  }, [search]);

  return state;
}

export function useCourtsApi(): CourtsState {
  const [state, setState] = useState<CourtsState>({
    courts: [],
    loading: true,
    error: null,
  });

  useEffect(() => {
    let alive = true;
    unwrap(api("/courts"))
      .then((data: { courts?: ApiCourt[] }) => {
        if (!alive) return;
        setState({
          courts: (data.courts || []).map(normalizeCourt).filter((court) => court.id),
          loading: false,
          error: null,
        });
      })
      .catch((error: Error) => {
        if (!alive) return;
        console.error("[LogResult] failed to load courts", error);
        setState({
          courts: [],
          loading: false,
          error: "Failed to load courts",
        });
      });

    return () => {
      alive = false;
    };
  }, []);

  return state;
}

export function useLeagueFixtures(selectedLeagueId: string): LeagueState {
  const [state, setState] = useState<LeagueState>({
    leagues: [],
    fixtures: [],
    loading: true,
    error: null,
  });

  useEffect(() => {
    let alive = true;
    setState((prev) => ({ ...prev, loading: true, error: null }));
    unwrap(api("/leagues?status=active&membership_status=active"))
      .then(async (data: { leagues?: ApiLeague[] }) => {
        if (!alive) return;
        const leagues = (data.leagues || []).map(normalizeLeague).filter((league) => league.id);
        const leagueId = selectedLeagueId || leagues[0]?.id || "";
        if (!leagueId) {
          setState({ leagues, fixtures: [], loading: false, error: null });
          return;
        }
        const fixtureData = await unwrap(api(`/leagues/${leagueId}/fixtures?mine=true`));
        if (!alive) return;
        setState({
          leagues,
          fixtures: ((fixtureData as { fixtures?: ApiLeagueFixture[] }).fixtures || [])
            .map(normalizeFixture)
            .filter((fixture) => fixture.id),
          loading: false,
          error: null,
        });
      })
      .catch((error: Error) => {
        if (!alive) return;
        console.error("[LogResult] failed to load league fixtures", error);
        setState({ leagues: [], fixtures: [], loading: false, error: "Failed to load league fixtures" });
      });

    return () => {
      alive = false;
    };
  }, [selectedLeagueId]);

  return state;
}

export function submitMatchResult(payload: SubmitPayload): Promise<MatchResultResponse> {
  return unwrap(
    api("/match-results", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  );
}

export function submitLeagueMatchResult(
  leagueId: string,
  fixtureId: string,
  payload: SubmitPayload,
): Promise<{ match_result?: MatchResultResponse }> {
  return unwrap(
    api(`/leagues/${leagueId}/matches/${fixtureId}/result`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  );
}

export function createCourt(payload: {
  name: string;
  area: string;
  latitude?: number | null;
  longitude?: number | null;
}): Promise<{ court: Court }> {
  return unwrap(
    api("/courts", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  ).then((data: { court?: ApiCourt }) => ({
    court: normalizeCourt(data.court || {}),
  }));
}

export function getMatchResult(id: string): Promise<{ match_result: MatchResultDetail }> {
  return unwrap(api(`/match-results/${id}`));
}

export function confirmMatchResult(id: string): Promise<{ match_result: MatchResultDetail }> {
  return unwrap(
    api(`/match-results/${id}/confirm`, {
      method: "POST",
    }),
  );
}

export function rejectMatchResult(id: string): Promise<{ match_result: MatchResultDetail }> {
  return unwrap(
    api(`/match-results/${id}/reject`, {
      method: "POST",
    }),
  );
}
