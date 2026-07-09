import { request } from "./http";

export type PlayerGender = "male" | "female" | "other";

export interface PlayerProfile {
  id: number;
  firstName?: string;
  lastName?: string;
  email?: string;
  profilePicture?: string;
  [key: string]: unknown;
}

export interface PlayerPersonalDetails {
  id?: number;
  user_id?: number;
  full_name?: string | null;
  date_of_birth?: string | null;
  phone?: string | null;
  profile_picture?: string | null;
  usta_rating?: number | string | null;
  uta_rating?: number | string | null;
  gender?: PlayerGender | null;
  current_rating?: number | string | null;
  starting_rating?: number | string | null;
  previous_rating?: number | string | null;
  self_rated_seed?: number | string | null;
  seeded_at?: string | null;
  self_rating_source?: string | null;
  rating_gender?: string | null;
  matches_played?: number | null;
  rating_wins?: number | null;
  rating_losses?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
  stripe_customer_id?: string | null;
  about_me?: string | null;
  email?: string | null;
  calculated_ntrp?: number | null;
  calculated_utr?: number | null;
  is_estimate?: boolean;
  [key: string]: unknown;
}

export interface PatchPlayerPersonalDetailsBody {
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  date_of_birth?: string | null;
  profile_picture?: string | null;
  usta_rating?: number | string | null;
  uta_rating?: number | string | null;
  gender?: PlayerGender | null;
  about_me?: string | null;
}

const PLAYER_PERSONAL_DETAILS_PATH = "/player/personal_details";

const omitUndefinedFields = <TBody extends object>(body: TBody) =>
  Object.fromEntries(
    Object.entries(body).filter(([, value]) => value !== undefined),
  ) as TBody;

export const getPlayerDetails = async (token: string) =>
  request<PlayerProfile>("/player/profile", {
    token,
  });

export interface OtherPlayerDetailsParams {
  token: string;
  userId: number | string;
}

export const getOtherPlayerDetails = async ({ token, userId }: OtherPlayerDetailsParams) =>
  request<PlayerProfile>(`/player/profile/${userId}`, {
    token,
  });

export const profileCompletion = async (token: string) =>
  request<Record<string, unknown>>("/player/profile/completion", {
    token,
  });

export const getPlayerPersonalDetails = ({
  token,
  signal,
}: {
  token: string;
  signal?: AbortSignal;
}) =>
  request<PlayerPersonalDetails>(PLAYER_PERSONAL_DETAILS_PATH, {
    token,
    signal,
  });

export const patchPlayerPersonalDetails = ({
  token,
  body,
  signal,
}: {
  token: string;
  body: PatchPlayerPersonalDetailsBody;
  signal?: AbortSignal;
}) =>
  request<PlayerPersonalDetails, PatchPlayerPersonalDetailsBody>(PLAYER_PERSONAL_DETAILS_PATH, {
    method: "PATCH",
    token,
    body: omitUndefinedFields(body),
    signal,
  });
