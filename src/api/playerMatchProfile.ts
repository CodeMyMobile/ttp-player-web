import { request } from "./http";

export interface PlayerMatchProfileResponse {
  about?: string;
  about_me?: string;
  level?: string;
  ntrp_level?: string;
  playStyles?: string[] | null;
  play_styles?: string[] | null;
  matchPreferences?: string[] | null;
  match_preferences?: string[] | null;
  gender?: string;
  localCourts?: string;
  local_courts?: string;
  homeCourt?: string;
  home_court?: string;
  availability?: string[] | null;
  preferredFormats?: string[] | null;
  preferred_formats?: string[] | null;
  matchIntensity?: string | null;
  match_intensity?: string | null;
  [key: string]: unknown;
}

export interface SavePlayerMatchProfileParams {
  token: string;
  profile: {
    about: string;
    level: string;
    playStyles: string[];
    gender: string;
    localCourts: string;
    availability: string[];
    intensity?: string | null;
    preferredFormats?: string[];
    homeCourt?: string | null;
  };
}

const stripEmptyValues = (payload: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(payload).filter(([, value]) => {
      if (value === undefined) return false;
      if (value === null) return false;
      if (typeof value === "string" && value.trim().length === 0) return false;
      if (Array.isArray(value)) {
        return value.length > 0;
      }
      return true;
    }),
  );

export const fetchPlayerMatchProfile = async (token: string) =>
  request<PlayerMatchProfileResponse | null>("/player/match_profile", { token });

export const savePlayerMatchProfile = async ({ token, profile }: SavePlayerMatchProfileParams) => {
  const payload = stripEmptyValues({
    about: profile.about,
    about_me: profile.about,
    level: profile.level,
    ntrp_level: profile.level,
    playStyles: profile.playStyles,
    play_styles: profile.playStyles,
    matchPreferences: profile.playStyles,
    match_preferences: profile.playStyles,
    gender: profile.gender,
    localCourts: profile.localCourts,
    local_courts: profile.localCourts,
    homeCourt: profile.homeCourt ?? profile.localCourts,
    home_court: profile.homeCourt ?? profile.localCourts,
    availability: profile.availability,
    preferredFormats: profile.preferredFormats,
    preferred_formats: profile.preferredFormats,
    matchIntensity: profile.intensity,
    match_intensity: profile.intensity,
  });

  return request<PlayerMatchProfileResponse>("/player/match_profile", {
    method: "PUT",
    token,
    body: payload,
  });
};
