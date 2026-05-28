import type { MatchProfileDetails } from "../components/players/MatchProfileModal";
import {
  extractSurveyQuestions,
  getSurveyAnswerValue,
  type NormalizedSurveyQuestion,
} from "./surveyQuestionnaire";

export type StoredMatchProfile = MatchProfileDetails;

export const MATCH_PROFILE_STORAGE_KEY = "player:web:match-profile";

const canonicalAvailabilityLabels: Record<string, string> = {
  "monday": "Weekdays AM",
  "tuesday": "Weekdays AM",
  "wednesday": "Weekdays AM",
  "thursday": "Weekdays AM",
  "friday": "Weekdays AM",
  "saturday": "Weekends",
  "sunday": "Weekends",
  "weekdays am": "Weekdays AM",
  "weekday am": "Weekdays AM",
  "weekday morning": "Weekdays AM",
  "weekday mornings": "Weekdays AM",
  "early morning (6 am - 9 am)": "Weekdays AM",
  "late morning (9 am - 12 pm)": "Weekdays AM",
  "weekdays pm": "Weekday PM",
  "weekday pm": "Weekday PM",
  "weekday afternoon": "Weekday PM",
  "weekday afternoons": "Weekday PM",
  "weekday evening": "Weekday PM",
  "weekday evenings": "Weekday PM",
  "afternoon (12 pm - 3 pm)": "Weekday PM",
  "late afternoon (3 pm - 6 pm)": "Weekday PM",
  "evening (6 pm - 9 pm)": "Weekday PM",
  "night (9 pm - 12 am)": "Weekday PM",
  "weekend": "Weekends",
  "weekends": "Weekends",
  "weekend only": "Weekends",
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object";

const toText = (value: unknown) => {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
};

const valueToLabel = (value: unknown): string => {
  if (Array.isArray(value)) {
    return value.map(valueToLabel).filter(Boolean).join(", ");
  }
  if (isRecord(value)) {
    return toText(value.optionText ?? value.label ?? value.name ?? value.formattedAddress ?? value.address ?? value.value);
  }
  return toText(value);
};

const valueToList = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.map(valueToLabel).filter(Boolean);
  }
  const label = valueToLabel(value);
  return label ? [label] : [];
};

export const toCanonicalAvailability = (value: string): string => {
  const normalized = value.trim().toLowerCase();
  return canonicalAvailabilityLabels[normalized] ?? value.trim();
};

export const ensureStringArray = (value: unknown, normalizer?: (value: string) => string): string[] => {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item !== "string") return "";
        const trimmed = item.trim();
        return normalizer ? normalizer(trimmed) : trimmed;
      })
      .filter((item): item is string => item.length > 0);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    return [normalizer ? normalizer(trimmed) : trimmed];
  }
  return [];
};

export const sanitizeMatchProfile = (value: unknown): StoredMatchProfile | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const level = typeof record.level === "string" && record.level.trim().length > 0 ? record.level.trim() : "3.0";
  const about = typeof record.about === "string" ? record.about.trim() : "";
  const gender = typeof record.gender === "string" ? record.gender.trim() : "";
  const localCourts = typeof record.localCourts === "string" ? record.localCourts.trim() : "";
  const playStyles = ensureStringArray(record.playStyles);
  const availability = ensureStringArray(record.availability, toCanonicalAvailability);

  return { about, level, playStyles, gender, localCourts, availability };
};

export const getStoredMatchProfile = (): StoredMatchProfile | null => {
  try {
    if (typeof window === "undefined" || !window.localStorage) {
      return null;
    }
    const raw = window.localStorage.getItem(MATCH_PROFILE_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    return sanitizeMatchProfile(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
};

export const storeMatchProfile = (profile: StoredMatchProfile) => {
  try {
    if (typeof window === "undefined" || !window.localStorage) {
      return;
    }
    window.localStorage.setItem(MATCH_PROFILE_STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // ignore storage failures
  }
};

export const hasIncompleteMatchProfileQuestions = (payload: unknown) =>
  extractSurveyQuestions(payload).some((item) => {
    if (item.questionType === "Info" || item.questionType === "AddressPicker" || item.questionType === "TextInput") {
      return false;
    }
    if (!item.answerRequired) {
      return false;
    }
    return getSurveyAnswerValue(item) === null;
  });

export const buildMatchProfileFromSurvey = (
  payload: unknown,
  fallback?: StoredMatchProfile | null,
): StoredMatchProfile | null => {
  const questions = extractSurveyQuestions(payload);
  if (questions.length === 0) {
    return fallback ?? null;
  }

  const profile: StoredMatchProfile = {
    about: fallback?.about ?? "",
    level: fallback?.level ?? "3.0",
    playStyles: fallback?.playStyles ?? [],
    gender: fallback?.gender ?? "",
    localCourts: fallback?.localCourts ?? "",
    availability: fallback?.availability ?? [],
  };

  questions.forEach((question: NormalizedSurveyQuestion) => {
    const value = getSurveyAnswerValue(question);
    if (value === null) return;

    const label = question.questionText.toLowerCase();
    if (label.includes("about") || label.includes("background") || label.includes("bio")) {
      profile.about = valueToLabel(value);
    } else if (label.includes("ntrp") || label.includes("level")) {
      profile.level = valueToLabel(value) || profile.level;
    } else if (label.includes("gender")) {
      profile.gender = valueToLabel(value);
    } else if (label.includes("closest tennis court") || label.includes("local court") || label.includes("preferred court")) {
      profile.localCourts = valueToLabel(value);
    } else if (label.includes("available") || label.includes("availability") || label.includes("times of day")) {
      profile.availability = Array.from(
        new Set([...profile.availability, ...valueToList(value).map(toCanonicalAvailability)]),
      );
    } else if (label.includes("looking for") || label.includes("style") || label.includes("play type")) {
      profile.playStyles = valueToList(value);
    }
  });

  return sanitizeMatchProfile(profile);
};
