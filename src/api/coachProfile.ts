import type { CoachProfile } from "../data/mockCoachProfiles";
import apiRequest from "../utils/apiRequest";

export type CoachProfileRecord = CoachProfile & {
  fullName?: string;
  profilePicture?: string;
};

export type FetchCoachProfileOptions = {
  day?: string;
  location?: string;
  signal?: AbortSignal;
};

const safeJson = async <T>(response: Response): Promise<T | null> => {
  if (response.status === 204) {
    return null;
  }

  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
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

export const fetchCoachProfile = async (coachId: number | string, options?: FetchCoachProfileOptions) => {
  const id = String(coachId ?? "").trim();
  if (!id) {
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
  const response = await apiRequest(
    `/player/coach/profile/${id}${query ? `?${query}` : ""}`,
    {
      method: "GET",
      signal: options?.signal,
    },
  );

  if (!response?.ok) {
    const error = new Error("Failed to fetch coach profile.");
    (error as Error & { status?: number }).status = response?.status;
    throw error;
  }

  const payload = await safeJson<Record<string, unknown>>(response);
  const profile = extractCoachProfile(payload);
  if (!profile) {
    throw new Error("Coach profile response was empty.");
  }

  return profile;
};

export default fetchCoachProfile;
