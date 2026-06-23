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
}

interface MatchResultResponse {
  match_id?: number | string;
  status?: string;
  confirm_window_ends_at?: string;
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

export function submitMatchResult(payload: SubmitPayload): Promise<MatchResultResponse> {
  return unwrap(
    api("/match-results", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  );
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
