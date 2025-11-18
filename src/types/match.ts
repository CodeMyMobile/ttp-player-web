export type MatchRelationship = "host" | "participant" | "viewer";

export interface MatchSkillLevel {
  summary: string;
  detail?: string;
}

export interface MatchEntry {
  id: string;
  access: "Open" | "Private";
  relationship: MatchRelationship;
  startDisplay: string;
  location: string;
  distance?: string;
  playersJoined: number;
  playersNeeded?: number;
  totalSpots: number;
  level?: MatchSkillLevel;
}

export interface MatchApiRecord {
  id?: string | number;
  match_id?: string | number;
  visibility?: string;
  access?: string;
  access_type?: string;
  status?: string;
  relationship?: string;
  user_relationship?: string;
  user_role?: string;
  role?: string;
  start?: string;
  start_time?: string;
  startTime?: string;
  start_date?: string;
  startDate?: string;
  date?: string;
  schedule?: string;
  location?: string;
  location_name?: string;
  locationName?: string;
  venue?: string;
  court?: string;
  address?: string;
  distance?: string | number;
  distance_in_miles?: string | number;
  distance_miles?: string | number;
  distance_mi?: string | number;
  players_joined?: number;
  players_joined_count?: number;
  current_players?: number;
  joined_players?: number;
  joined?: number;
  playersNeeded?: number;
  player_limit?: number;
  total_players?: number;
  totalSpots?: number;
  capacity?: number;
  level?: string | number;
  level_summary?: string;
  level_detail?: string;
  level_min?: string | number;
  level_max?: string | number;
  min_level?: string | number;
  max_level?: string | number;
  rating?: string | number;
  suggested_rating?: string;
  [key: string]: unknown;
}

export type MatchesResponse =
  | MatchApiRecord[]
  | {
      data?: MatchApiRecord[];
      results?: MatchApiRecord[];
      items?: MatchApiRecord[];
      matches?: MatchApiRecord[];
      meta?: unknown;
      [key: string]: unknown;
    };
