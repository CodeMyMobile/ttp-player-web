const parseIso = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
};

const parseNumberOrNull = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeLocationOption = (value) => {
  if (!value || typeof value !== "object") return null;
  const text =
    typeof value.location_text === "string"
      ? value.location_text.trim()
      : typeof value.locationText === "string"
        ? value.locationText.trim()
        : typeof value.location === "string"
          ? value.location.trim()
          : "";
  if (!text) return null;
  return {
    location_text: text,
    latitude: parseNumberOrNull(value.latitude),
    longitude: parseNumberOrNull(value.longitude),
  };
};

const sameLocation = (left, right) => {
  const a = normalizeLocationOption(left);
  const b = normalizeLocationOption(right);
  if (!a || !b) return false;
  return (
    a.location_text === b.location_text &&
    a.latitude === b.latitude &&
    a.longitude === b.longitude
  );
};

const uniqueTimes = (values = []) => {
  const seen = new Set();
  const result = [];
  values.forEach((value) => {
    const iso = parseIso(value);
    if (!iso || seen.has(iso)) return;
    seen.add(iso);
    result.push(iso);
  });
  return result;
};

const uniqueLocations = (values = []) => {
  const result = [];
  values.forEach((value) => {
    const normalized = normalizeLocationOption(value);
    if (!normalized) return;
    if (result.some((existing) => sameLocation(existing, normalized))) return;
    result.push(normalized);
  });
  return result;
};

export const buildSlotOptionPayloadFields = ({
  playerLimit,
  preferredTime,
  preferredLocation,
  timeOptions = [],
  locationOptions = [],
} = {}) => {
  if (Number(playerLimit) !== 1) return {};

  const preferredIso = parseIso(preferredTime);
  const preferredLocationOption = normalizeLocationOption(preferredLocation);
  const alternativeTimes = uniqueTimes(timeOptions).filter((value) => value !== preferredIso);
  const alternativeLocations = uniqueLocations(locationOptions).filter(
    (value) => !sameLocation(value, preferredLocationOption),
  );

  const payload = {};
  if (alternativeTimes.length) payload.time_options = alternativeTimes;
  if (alternativeLocations.length) payload.location_options = alternativeLocations;
  return payload;
};

export const buildOfferedSlotOptions = (match = {}) => {
  const preferredTime = parseIso(match.start_date_time ?? match.startDateTime);
  const preferredLocation = normalizeLocationOption({
    location_text: match.location_text ?? match.location,
    latitude: match.latitude,
    longitude: match.longitude,
  });

  const times = uniqueTimes([
    preferredTime,
    ...(Array.isArray(match.time_options) ? match.time_options : []),
  ]).map((value) => ({
    value,
    label: new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(value)),
  }));

  const locations = uniqueLocations([
    preferredLocation,
    ...(Array.isArray(match.location_options) ? match.location_options : []),
  ]).map((value) => ({
    value,
    label: value.location_text,
  }));

  return { times, locations };
};

export const isUnresolvedSinglesSlotMatch = (match = {}) =>
  Number(match.player_limit ?? match.playerLimit) === 1 && match.slot_resolved === false;
