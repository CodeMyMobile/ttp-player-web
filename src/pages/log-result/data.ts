// Stub data hooks. Current user and courts still use fixtures; player search is
// live because the matches API already exposes the registered-player endpoint.
import { useEffect, useState } from "react";
import { searchPlayers } from "../../services/matches";
import type { CurrentUser, Player, Court } from "./scoring";
import { CURRENT_USER, COURTS } from "./fixtures";

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

export function useCurrentUser(): CurrentUser {
  return CURRENT_USER;
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

export function useCourts(): Court[] {
  return COURTS;
}
