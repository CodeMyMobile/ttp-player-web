const parseIso = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
};

const parseTimeOnly = (value, preferredTime) => {
  if (typeof value !== "string" || !/^\d{2}:\d{2}$/.test(value)) return null;
  const preferredDate = new Date(preferredTime);
  if (Number.isNaN(preferredDate.getTime())) return null;
  const [hour, minute] = value.split(":").map(Number);
  if (hour > 23 || minute > 59) return null;
  const next = new Date(
    preferredDate.getFullYear(),
    preferredDate.getMonth(),
    preferredDate.getDate(),
    hour,
    minute,
    0,
    0,
  );
  return Number.isNaN(next.getTime()) ? null : next.toISOString();
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

export const normalizeGooglePlaceLocationOption = (place) => {
  const placeName = typeof place?.name === "string" ? place.name.trim() : "";
  const formattedAddress =
    typeof place?.formatted_address === "string" ? place.formatted_address.trim() : "";
  const label = placeName || formattedAddress;
  if (!label) return null;
  const lat = place?.geometry?.location?.lat?.();
  const lng = place?.geometry?.location?.lng?.();
  return {
    location_text: label,
    latitude: typeof lat === "number" ? lat : null,
    longitude: typeof lng === "number" ? lng : null,
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
  const normalizedTimeOptions = timeOptions.map(
    (value) => parseTimeOnly(value, preferredTime) || value,
  );
  const alternativeTimes = uniqueTimes(normalizedTimeOptions).filter((value) => value !== preferredIso);
  const alternativeLocations = uniqueLocations(locationOptions).filter(
    (value) => !sameLocation(value, preferredLocationOption),
  );

  const payload = {};
  if (alternativeTimes.length) payload.time_options = alternativeTimes;
  if (alternativeLocations.length) payload.location_options = alternativeLocations;
  return payload;
};

export const buildOfferedSlotOptions = (match = {}) => {
  const source = match || {};
  const preferredTime = parseIso(source.start_date_time ?? source.startDateTime);
  const preferredLocation = normalizeLocationOption({
    location_text: source.location_text ?? source.location,
    latitude: source.latitude,
    longitude: source.longitude,
  });
  const timeOptions = Array.isArray(source.time_options)
    ? source.time_options
    : Array.isArray(source.timeOptions)
      ? source.timeOptions
      : [];
  const locationOptions = Array.isArray(source.location_options)
    ? source.location_options
    : Array.isArray(source.locationOptions)
      ? source.locationOptions
      : [];

  const times = uniqueTimes([
    preferredTime,
    ...timeOptions,
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
    ...locationOptions,
  ]).map((value) => ({
    value,
    label: value.location_text,
  }));

  return { times, locations };
};

export const isUnresolvedSinglesSlotMatch = (match = {}) =>
  Number((match || {}).player_limit ?? (match || {}).playerLimit) === 1 &&
  ((match || {}).slot_resolved ?? (match || {}).slotResolved) === false;
