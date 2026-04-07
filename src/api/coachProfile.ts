import type { CoachProfile } from "../data/mockCoachProfiles";
import { request } from "./http";

export type CoachProfileRecord = CoachProfile & {
  fullName?: string;
  profilePicture?: string;
};

export type FetchCoachProfileOptions = {
  day?: string;
  location?: string;
  signal?: AbortSignal;
  token?: string;
};

const extractCoachProfile = (payload: unknown): CoachProfileRecord | undefined => {
  if (!payload || typeof payload !== "object") {
    return undefined;
  }

  const candidate = payload as Record<string, unknown>;
  const preferredKeys = ["data", "result", "profile", "coach", "item"];
  for (const key of preferredKeys) {
    const value = candidate[key];
    if (value && typeof value === "object") {
      return value as CoachProfile;
    }
  }

  return payload as CoachProfileRecord;
};

export const fetchCoachProfile = async (coachId: number, options?: FetchCoachProfileOptions) => {
  if (!coachId) {
    throw new Error("Coach ID is required to load the profile.");
  }

  const params = new URLSearchParams();
  if (options?.day) {
    params.append("day", options.day);
  }
  if (options?.location) {
    params.append("location", options.location);
  }

  const query = params.toString();
  const payload = await request<Record<string, unknown> | null>(
    `/player/coach/profile/${coachId}${query ? `?${query}` : ""}`,
    {
      method: "GET",
      signal: options?.signal,
      token: options?.token,
    },
  );
  const profile = extractCoachProfile(payload);
  if (!profile) {
    throw new Error("Coach profile response was empty.");
  }

  return profile;
};

export default fetchCoachProfile;
