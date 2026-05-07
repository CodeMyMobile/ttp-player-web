const isFiniteNumber = (value) =>
  typeof value === "number" && Number.isFinite(value);

const PLAYER_LIMIT_MIN = 2;
const PLAYER_LIMIT_MAX = 30;

const parsePlayerLimit = (value) => {
  if (value === undefined || value === null) return null;
  if (typeof value === "number") {
    if (!Number.isFinite(value) || !Number.isInteger(value)) return null;
    return value > 0 ? value : null;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (!/^[0-9]+$/.test(trimmed)) return null;
    const numeric = Number.parseInt(trimmed, 10);
    if (!Number.isFinite(numeric)) return null;
    return numeric > 0 ? numeric : null;
  }
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || !Number.isInteger(numeric)) return null;
  return numeric > 0 ? numeric : null;
};

const getMatchPlayerLimit = (match) => {
  if (!match || typeof match !== "object") return null;
  const candidates = [];
  if (match.capacity && typeof match.capacity === "object") {
    const { limit, max, capacity } = match.capacity;
    candidates.push(limit, max, capacity);
  }
  candidates.push(
    match.player_limit,
    match.playerLimit,
    match.player_count,
    match.match_player_limit,
  );
  for (const candidate of candidates) {
    const parsed = parsePlayerLimit(candidate);
    if (parsed !== null) return parsed;
  }
  return null;
};

const buildMatchUpdatePayload = ({
  startDateTime,
  locationText,
  matchFormat,
  previousMatchFormat,
  notes,
  isOpenMatch,
  skillLevel,
  previousSkillLevel,
  latitude,
  longitude,
  previousLatitude,
  previousLongitude,
  playerLimit,
  previousPlayerLimit,
}) => {
  const payload = {
    start_date_time: startDateTime,
    location_text: locationText,
  };

  if (isFiniteNumber(latitude)) {
    payload.latitude = latitude;
  } else if (latitude === null && isFiniteNumber(previousLatitude)) {
    payload.latitude = null;
  }

  if (isFiniteNumber(longitude)) {
    payload.longitude = longitude;
  } else if (longitude === null && isFiniteNumber(previousLongitude)) {
    payload.longitude = null;
  }

  const trimmedFormat =
    typeof matchFormat === "string" ? matchFormat.trim() : "";
  const trimmedPreviousFormat =
    typeof previousMatchFormat === "string" ? previousMatchFormat.trim() : "";
  if (trimmedFormat) {
    payload.match_format = trimmedFormat;
  } else if (trimmedPreviousFormat) {
    payload.match_format = null;
  }

  if (isOpenMatch) {
    const trimmedSkill =
      typeof skillLevel === "string" ? skillLevel.trim() : "";
    const trimmedPreviousSkill =
      typeof previousSkillLevel === "string"
        ? previousSkillLevel.trim()
        : "";
    if (trimmedSkill) {
      payload.skill_level_min = trimmedSkill;
    } else if (trimmedPreviousSkill) {
      payload.skill_level_min = null;
    }
    if (typeof notes === "string") {
      payload.notes = notes;
    }
  }

  if (playerLimit !== undefined || previousPlayerLimit !== undefined) {
    const normalizedLimit = parsePlayerLimit(playerLimit);
    const normalizedPrevious = parsePlayerLimit(previousPlayerLimit);
    if (normalizedLimit !== null) {
      payload.player_limit = normalizedLimit;
    } else if (
      (playerLimit === null || playerLimit === "") &&
      normalizedPrevious !== null
    ) {
      payload.player_limit = null;
    }
  }

  return payload;
};

export {
  buildMatchUpdatePayload,
  getMatchPlayerLimit,
  parsePlayerLimit,
  PLAYER_LIMIT_MIN,
  PLAYER_LIMIT_MAX,
};
