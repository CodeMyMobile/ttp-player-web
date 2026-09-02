import type { LeaguePlayer, LeagueStanding } from "../api/leagues";
import type { ConnectIntent } from "../types/matchPlay";

export interface LeagueLadderRow {
  playerId: string;
  name: string;
  initials: string;
  rank: number;
  rating: number;
  ratingLabel: string;
  ratingType: "TPR" | "NTRP" | "UTR";
  ntrpLabel: string;
  utrLabel: string;
  recordLabel: string;
  wins: number;
  losses: number;
  isViewer: boolean;
  ratingBadge: string | null;
  /** All-platform matches behind the TPR — NOT the league record. Null when absent. */
  matchesPlayed: number | null;
  ratingSource: string | null;
  ratingDeltaFromViewer: number | null;
  distanceLabel: string | null;
  courtLabels: string[];
  suggestionReason: string | null;
  raw: LeaguePlayer;
}

const numeric = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const formatFixed = (value: unknown, digits: number) => {
  const parsed = numeric(value);
  return parsed === null ? "-" : parsed.toFixed(digits);
};

const displayRating = (player: LeaguePlayer) => {
  const tpr = numeric(player.current_rating);
  if (tpr !== null) return { rating: tpr, ratingType: "TPR" as const, ratingLabel: tpr.toFixed(3) };
  const ntrp = numeric(player.calculated_ntrp ?? player.usta_rating);
  if (ntrp !== null) return { rating: ntrp, ratingType: "NTRP" as const, ratingLabel: ntrp.toFixed(1) };
  const utr = numeric(player.calculated_utr ?? player.uta_rating);
  if (utr !== null) return { rating: utr, ratingType: "UTR" as const, ratingLabel: utr.toFixed(1) };
  return null;
};

const initials = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  if (!parts.length) return "PL";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
};

const formatDistance = (value: unknown) => {
  const parsed = numeric(value);
  if (parsed === null) return null;
  return `${parsed >= 10 ? Math.round(parsed) : parsed.toFixed(1)} mi`;
};

const ratingBadge = (player: LeaguePlayer) => {
  if (player.is_estimate) return "Estimated";
  const source = typeof player.rating_source === "string" ? player.rating_source : "";
  if (source === "verified" || source === "results") return "Verified";
  if (source === "self_rated" || source === "coach_rated") return "Estimated";
  return null;
};

const normalizeSource = (value: unknown) => {
  if (typeof value !== "string" || !value.trim()) return null;
  return value.trim().replace(/_/g, " ");
};

const courtLabels = (player: LeaguePlayer) => {
  const courts = Array.isArray(player.court_locations) ? player.court_locations : [];
  const labels = courts
    .map((court) => (typeof court.location === "string" ? court.location.trim() : ""))
    .filter(Boolean);
  return Array.from(new Set(labels)).slice(0, 3);
};

export const buildLeagueLadderRows = ({
  players,
  standings,
  viewerId,
  search = "",
}: {
  players: LeaguePlayer[];
  standings: Array<Pick<LeagueStanding, "player_id" | "wins" | "losses">>;
  viewerId?: number | string | null;
  search?: string;
}): LeagueLadderRow[] => {
  const recordById = new Map(
    standings.map((row) => [
      String(row.player_id),
      { wins: Number(row.wins || 0), losses: Number(row.losses || 0) },
    ]),
  );
  const normalizedSearch = search.trim().toLowerCase();

  return players
    .map((player) => {
      const rating = displayRating(player);
      if (rating === null) return null;
      const playerId = String(player.player_id);
      const name = player.full_name || `Player ${playerId}`;
      if (normalizedSearch && !name.toLowerCase().includes(normalizedSearch)) return null;
      const record = recordById.get(playerId) ?? { wins: 0, losses: 0 };
      const courts = courtLabels(player);
      return {
        playerId,
        name,
        initials: initials(name),
        rank: 0,
        rating: rating.rating,
        ratingLabel: rating.ratingLabel,
        ratingType: rating.ratingType,
        ntrpLabel: formatFixed(player.calculated_ntrp ?? player.usta_rating, 2),
        utrLabel: formatFixed(player.calculated_utr ?? player.uta_rating, 1),
        recordLabel: `${record.wins}-${record.losses}`,
        wins: record.wins,
        losses: record.losses,
        isViewer: viewerId != null && String(viewerId) === playerId,
        ratingBadge: ratingBadge(player),
        matchesPlayed: numeric(player.matches_played),
        ratingSource: normalizeSource(player.rating_source),
        ratingDeltaFromViewer: numeric(player.rating_delta_from_viewer),
        distanceLabel: formatDistance(player.distance_miles),
        courtLabels: courts,
        suggestionReason: null,
        raw: player,
      };
    })
    .filter((row): row is Omit<LeagueLadderRow, "rank"> & { rank: number } => row !== null)
    // A rating of 0 is not a rating. Three players in the live Fall division sit
    // at current_rating 0 with NTRP 3.5-4.0 on file, and were ranking BELOW a
    // genuine 4.44 — worse than being absent, because the order asserted
    // something false about them. Same rule the public ladder already applies
    // (PublicMatchResultsPage.onlyRatedPlayers), filtered before ranking so
    // positions still run 1..n with no gaps.
    .filter((row) => row.rating > 0)
    .sort((a, b) => b.rating - a.rating || a.name.localeCompare(b.name))
    .map((row, index) => ({ ...row, rank: index + 1 }));
};

export const buildSuggestedChallengeRows = (
  rows: LeagueLadderRow[],
  viewerId?: number | string | null,
  limit = 3,
) => {
  const viewer = rows.find((row) => String(row.playerId) === String(viewerId));
  if (!viewer) return rows.filter((row) => !row.isViewer).slice(0, limit);

  return rows
    .filter((row) => row.playerId !== viewer.playerId)
    .map((row) => {
      const delta = row.rating - viewer.rating;
      return {
        ...row,
        suggestionReason: `${Math.abs(delta).toFixed(row.ratingType === "TPR" && viewer.ratingType === "TPR" ? 3 : 1)} ${delta >= 0 ? "above" : "below"} you`,
      };
    })
    .sort((a, b) => Math.abs(a.rating - viewer.rating) - Math.abs(b.rating - viewer.rating))
    .slice(0, limit);
};

export const buildLeagueChallengeState = ({
  row,
  leagueName,
}: {
  row: LeagueLadderRow;
  leagueName?: string | null;
}): { connectIntent: ConnectIntent } => ({
  connectIntent: {
    invitee: {
      id: row.playerId,
      name: row.name,
      level: `${row.ratingType} ${row.ratingLabel}`,
    },
    senderLevel: `${row.ratingType} ${row.ratingLabel}`,
    suggestedAvailability: [],
    preferredCourt: row.courtLabels[0] ?? null,
    source: "league-ladder",
    senderName: leagueName || "League ladder",
  },
});
