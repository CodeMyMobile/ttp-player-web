import { request } from "./http";

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
  full_name?: string;
  email?: string;
  phone?: string;
  profile_picture?: string;
  about_me?: string;
  gender?: string;
  [key: string]: unknown;
}

export const getPlayerDetails = async (token: string) =>
  request<PlayerProfile>("/player/profile", {
    token,
  });

export const getPlayerPersonalDetails = async (token: string) =>
  request<PlayerPersonalDetails>("/player/personal_details", {
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
