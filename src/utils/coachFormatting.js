const stringKeysPriority = [
  "fullName",
  "full_name",
  "name",
  "displayName",
  "display_name",
  "nickname",
  "shortName",
  "short_name",
];

const firstNameKeys = ["firstName", "first_name", "givenName", "given_name"];
const lastNameKeys = ["lastName", "last_name", "familyName", "family_name", "surname"];

const numberCandidateKeys = {
  rate: ["rate", "hourlyRate", "hourly_rate", "lessonRate", "lesson_rate", "price"],
  rating: ["rating", "average_rating", "avgRating", "avg_rating", "overallRating", "overall_rating"],
  reviews: [
    "reviewCount",
    "reviews_count",
    "review_count",
    "totalReviews",
    "total_reviews",
    "reviews",
  ],
};

const focusKeys = [
  "focus",
  "tagline",
  "headline",
  "summary",
  "about",
  "bio",
  "introduction",
  "coachingFocus",
  "coaching_focus",
];

const experienceKeys = [
  "experience",
  "background",
  "bio",
  "story",
  "description",
  "coachingExperience",
  "coaching_experience",
];

const availabilityKeys = [
  "availability",
  "availabilitySummary",
  "availability_summary",
  "schedule",
  "scheduleSummary",
  "schedule_summary",
  "availabilityNotes",
  "availability_notes",
];

const locationKeys = [
  "locations",
  "locationNames",
  "location_names",
  "coachingLocations",
  "coaching_locations",
  "coachLocations",
  "coach_locations",
  "availableLocations",
  "available_locations",
  "serviceAreas",
  "service_areas",
  "primaryLocation",
  "primary_location",
  "city",
  "region",
  "state",
];

const lessonTypeKeys = [
  "lessonTypes",
  "lesson_types",
  "lessons",
  "lessonOptions",
  "lesson_options",
  "availableLessons",
  "available_lessons",
  "services",
  "serviceTypes",
  "service_types",
  "positions",
];

const specialtyKeys = [
  "specialties",
  "specializations",
  "specialisation",
  "speciality",
  "specialty",
  "expertise",
  "expertises",
  "focusAreas",
  "focus_areas",
  "skills",
  "strengths",
  "tags",
  "highlights",
];

const objectStringKeys = [
  "name",
  "title",
  "label",
  "value",
  "location",
  "locationName",
  "location_name",
  "displayName",
  "display_name",
  "position",
  "type",
  "lessonType",
  "lesson_type",
  "speciality",
  "specialty",
];

const palette = [
  "#f59e0b",
  "#3b82f6",
  "#ec4899",
  "#10b981",
  "#6366f1",
  "#f97316",
  "#14b8a6",
  "#a855f7",
];

const sanitizeString = (value) => (typeof value === "string" ? value.trim() : "");

const pickFirstString = (source, keys) => {
  if (!source) return "";
  for (const key of keys) {
    const candidate = source?.[key];
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }
  return "";
};

const extractStrings = (value) => {
  if (!value && value !== 0) return [];

  if (Array.isArray(value)) {
    return value.flatMap((item) => extractStrings(item));
  }

  if (typeof value === "string") {
    return value
      .split(/[,/]/)
      .map((part) => part.trim())
      .filter(Boolean);
  }

  if (typeof value === "object") {
    for (const key of objectStringKeys) {
      if (key in value) {
        const nested = extractStrings(value[key]);
        if (nested.length) {
          return nested;
        }
      }
    }
    const nestedValues = Object.values(value).flatMap((item) => extractStrings(item));
    if (nestedValues.length) {
      return nestedValues;
    }
  }

  return [];
};

const dedupeStrings = (values) => {
  const seen = new Set();
  const result = [];
  values.forEach((item) => {
    const normalized = item.trim();
    if (normalized && !seen.has(normalized.toLowerCase())) {
      seen.add(normalized.toLowerCase());
      result.push(normalized);
    }
  });
  return result;
};

const gatherStringSets = (source, keys) => {
  if (!source) return [];
  const collected = keys.flatMap((key) => extractStrings(source[key]));
  return dedupeStrings(collected);
};

const toNumber = (value) => {
  if (typeof value === "number" && !Number.isNaN(value)) {
    return value;
  }
  if (typeof value === "string") {
    const normalized = value.replace(/[^0-9.\-]/g, "");
    if (!normalized) return null;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const pickNumber = (source, keys) => {
  if (!source) return null;
  for (const key of keys) {
    if (key in source) {
      const value = toNumber(source[key]);
      if (value !== null && value !== undefined && !Number.isNaN(value)) {
        return value;
      }
    }
  }
  return null;
};

const hashString = (input) => {
  let hash = 0;
  if (!input) return hash;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(index);
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash);
};

export const getCoachIdentifier = (coach) => {
  if (!coach) return "";
  const candidates = [
    coach.id,
    coach.coachId,
    coach.coach_id,
    coach.slug,
    coach.uuid,
  ];
  for (const candidate of candidates) {
    if (candidate !== null && candidate !== undefined && `${candidate}`.trim()) {
      return `${candidate}`.trim();
    }
  }
  return "";
};

export const getCoachFullName = (coach) => {
  if (!coach) return "Coach";
  const direct = pickFirstString(coach, stringKeysPriority);
  if (direct) return direct;
  const firstName = pickFirstString(coach, firstNameKeys);
  const lastName = pickFirstString(coach, lastNameKeys);
  if (firstName || lastName) {
    return [firstName, lastName].filter(Boolean).join(" ").trim();
  }
  if (typeof coach.username === "string" && coach.username.trim()) {
    return coach.username.trim();
  }
  if (typeof coach.email === "string" && coach.email.trim()) {
    const [localPart] = coach.email.split("@");
    if (localPart) return localPart;
  }
  return "Coach";
};

export const getCoachInitials = (coach) => {
  const name = getCoachFullName(coach);
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase())
    .filter(Boolean);
  if (initials.length >= 2) {
    return `${initials[0]}${initials[1]}`;
  }
  if (initials.length === 1) {
    return initials[0];
  }
  return "C";
};

export const getCoachAvatarColor = (coach) => {
  const reference = `${getCoachIdentifier(coach)}-${getCoachFullName(coach)}`;
  const hash = hashString(reference || "coach");
  return palette[hash % palette.length];
};

export const getCoachLocations = (coach) => gatherStringSets(coach, locationKeys);

export const getCoachLessonTypes = (coach) => gatherStringSets(coach, lessonTypeKeys);

export const getCoachSpecialties = (coach) => gatherStringSets(coach, specialtyKeys);

export const getCoachFocus = (coach) => {
  const focus = pickFirstString(coach, focusKeys);
  if (focus) return sanitizeString(focus);
  const specialties = getCoachSpecialties(coach);
  if (specialties.length) {
    return specialties.slice(0, 2).join(" • ");
  }
  const locations = getCoachLocations(coach);
  if (locations.length) {
    return `Coaching in ${locations[0]}`;
  }
  return "This coach will share more details soon.";
};

export const getCoachExperience = (coach) => {
  const experience = pickFirstString(coach, experienceKeys);
  if (experience) return sanitizeString(experience);
  return "Experience details will be available shortly.";
};

export const getCoachAvailability = (coach) => {
  const availability = pickFirstString(coach, availabilityKeys);
  if (availability) return sanitizeString(availability);
  return "Availability shared upon request.";
};

export const getCoachRate = (coach) => pickNumber(coach, numberCandidateKeys.rate);

export const getCoachRating = (coach) => pickNumber(coach, numberCandidateKeys.rating);

export const getCoachReviewCount = (coach) => pickNumber(coach, numberCandidateKeys.reviews);
