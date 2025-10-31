const AVAILABILITY_FALLBACK = "Availability on request";
const RATE_FALLBACK = "Rate varies";

const DAY_ORDER = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

const DAY_LABEL = {
  monday: "Mon",
  tuesday: "Tue",
  wednesday: "Wed",
  thursday: "Thu",
  friday: "Fri",
  saturday: "Sat",
  sunday: "Sun",
};

const MAX_HEADLINE_LENGTH = 160;
const DEFAULT_VISIBLE_LOCATIONS = 2;

const toStringSafe = (value) => {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return String(value ?? "").trim();
};

const normalizeDay = (value) => {
  const day = toStringSafe(value).toLowerCase();
  if (!day) return null;
  if (DAY_ORDER.includes(day)) return day;
  switch (day) {
    case "mon":
      return "monday";
    case "tue":
    case "tues":
      return "tuesday";
    case "wed":
      return "wednesday";
    case "thu":
    case "thur":
    case "thurs":
      return "thursday";
    case "fri":
      return "friday";
    case "sat":
      return "saturday";
    case "sun":
      return "sunday";
    default:
      return null;
  }
};

const parseDays = (input) => {
  if (!input) return [];
  if (Array.isArray(input)) {
    return Array.from(
      new Set(
        input
          .map((item) => {
            if (item && typeof item === "object") {
              return normalizeDay(item.day ?? item.weekday ?? item.name);
            }
            return normalizeDay(item);
          })
          .filter(Boolean),
      ),
    );
  }
  if (typeof input === "string") {
    return parseDays(input.split(/[,&/]+/));
  }
  if (input && typeof input === "object") {
    return parseDays(input.days ?? input.day ?? input.weekday);
  }
  return [];
};

const normalizeTime = (value) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    const hours = Math.floor(value);
    const minutes = Math.round((value - hours) * 60);
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }
  const text = toStringSafe(value);
  if (!text) return null;
  if (/^\d{1,2}:\d{2}$/u.test(text)) {
    const [hours, minutes] = text.split(":");
    return `${hours.padStart(2, "0")}:${minutes}`;
  }
  if (/^\d{1,2}$/u.test(text)) {
    return `${text.padStart(2, "0")}:00`;
  }
  const match = text.match(/(\d{2}):(\d{2})/u);
  if (match) {
    return `${match[1]}:${match[2]}`;
  }
  return null;
};

const formatTime = (time) => {
  const [hours, minutes] = time.split(":");
  const date = new Date(Date.UTC(1970, 0, 1, Number(hours), Number(minutes)));
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: minutes !== "00" ? "2-digit" : undefined,
  }).format(date).toLowerCase();
};

const flattenAvailability = (input) => {
  if (!input) return [];
  if (typeof input === "string") {
    return [{ summary: input }];
  }
  if (Array.isArray(input)) {
    return input.flatMap((item) => flattenAvailability(item));
  }
  if (typeof input === "object") {
    if (Array.isArray(input.windows)) return flattenAvailability(input.windows);
    if (Array.isArray(input.slots)) return flattenAvailability(input.slots);
    if (Array.isArray(input.availability)) return flattenAvailability(input.availability);
    if (input.summary) return [{ summary: input.summary }];
    return [input];
  }
  return [];
};

const normalizeWindow = (window) => {
  if (!window || typeof window !== "object") return null;
  const days = parseDays(window.days ?? window.day ?? window.weekday ?? window);
  const start = normalizeTime(window.start ?? window.start_time ?? window.from ?? window.begin);
  const end = normalizeTime(window.end ?? window.end_time ?? window.to ?? window.until);
  if (!days.length && window.summary) {
    return { summary: toStringSafe(window.summary) };
  }
  if (!days.length || !start || !end) return null;
  return { days, start, end };
};

export const formatCoachAvailability = (source) => {
  const windows = flattenAvailability(source)
    .map((item) => {
      if (item.summary) {
        return { summary: toStringSafe(item.summary) };
      }
      return normalizeWindow(item);
    })
    .filter(Boolean);

  const summaryWindow = windows.find((item) => item.summary);
  if (summaryWindow && summaryWindow.summary) {
    return summaryWindow.summary;
  }

  const normalized = windows.filter((item) => !item.summary);
  if (!normalized.length) {
    return AVAILABILITY_FALLBACK;
  }

  const rangesByTime = new Map();
  normalized.forEach(({ days, start, end }) => {
    const key = `${start}-${end}`;
    if (!rangesByTime.has(key)) {
      rangesByTime.set(key, []);
    }
    rangesByTime.get(key).push(...days);
  });

  const segments = [];
  rangesByTime.forEach((dayList, key) => {
    const [start, end] = key.split("-");
    const sorted = [...new Set(dayList)].sort(
      (a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b),
    );
    const ranges = [];
    let rangeStart = sorted[0];
    let prev = sorted[0];
    for (let i = 1; i < sorted.length; i += 1) {
      const current = sorted[i];
      if (DAY_ORDER.indexOf(current) === DAY_ORDER.indexOf(prev) + 1) {
        prev = current;
        continue;
      }
      ranges.push([rangeStart, prev]);
      rangeStart = current;
      prev = current;
    }
    ranges.push([rangeStart, prev]);
    const label = ranges
      .map(([startDay, endDay]) => {
        if (startDay === endDay) return DAY_LABEL[startDay];
        return `${DAY_LABEL[startDay]}–${DAY_LABEL[endDay]}`;
      })
      .join(", ");
    segments.push(`${label} ${formatTime(start)}–${formatTime(end)}`);
  });

  return segments.join("; ") || AVAILABILITY_FALLBACK;
};

const stripZip = (text) => text.replace(/\b\d{5}(?:-\d{4})?\b/g, "");

const formatLocationLabel = (entry) => {
  if (!entry) return null;
  if (typeof entry === "string") {
    const cleaned = stripZip(entry).replace(/\s+/g, " ").trim();
    return cleaned || null;
  }
  if (typeof entry !== "object") return null;
  const name = toStringSafe(
    entry.name ?? entry.title ?? entry.venue ?? entry.club ?? entry.location ?? entry.location_name,
  );
  const city = toStringSafe(entry.city ?? entry.city_name ?? entry.cityName ?? entry.address?.city);
  const state = toStringSafe(
    entry.state ?? entry.state_code ?? entry.stateCode ?? entry.address?.state ?? entry.address?.stateCode,
  );
  if (!name && !city) return null;
  const locationParts = [];
  if (name) locationParts.push(name);
  if (city || state) {
    const cityState = [city, state].filter(Boolean).join(", ");
    if (cityState) locationParts.push(cityState);
  }
  const label = locationParts.join(" — ");
  return stripZip(label).replace(/\s+/g, " ").trim() || null;
};

export const formatCoachLocations = (source, maxVisible = DEFAULT_VISIBLE_LOCATIONS) => {
  const entries = [];
  if (Array.isArray(source)) {
    entries.push(...source);
  } else if (source && typeof source === "object") {
    if (Array.isArray(source.locations)) entries.push(...source.locations);
    if (Array.isArray(source.results)) entries.push(...source.results);
  } else if (source) {
    entries.push(source);
  }
  const labels = entries
    .map((entry) => formatLocationLabel(entry))
    .filter(Boolean);
  const unique = Array.from(new Set(labels));
  return {
    all: unique,
    visible: unique.slice(0, maxVisible),
    hiddenCount: Math.max(unique.length - maxVisible, 0),
  };
};

const formatCurrency = (amount, currency) => {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "USD",
      maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
    }).format(amount);
  } catch {
    return `$${amount}`;
  }
};

export const formatCoachRate = (source) => {
  if (!source) {
    return { display: RATE_FALLBACK, amount: null, currency: null };
  }
  if (typeof source === "string") {
    const label = source.trim();
    return { display: label || RATE_FALLBACK, amount: null, currency: null };
  }
  if (typeof source === "number" && Number.isFinite(source)) {
    return { display: `${formatCurrency(source, "USD")}/hr`, amount: source, currency: "USD" };
  }
  if (typeof source === "object") {
    const amount = Number(source.amount ?? source.value ?? source.price ?? source.rate);
    const currency = toStringSafe(source.currency || source.currency_code || source.currencyCode || "USD");
    const unit = toStringSafe(source.unit || source.interval || source.unit_label);
    if (Number.isFinite(amount)) {
      const formatted = formatCurrency(amount, currency || "USD");
      const suffix = unit ? `/${unit}` : "/hr";
      return { display: `${formatted}${suffix}`, amount, currency: currency || "USD" };
    }
    if (source.display) {
      const display = toStringSafe(source.display);
      return { display: display || RATE_FALLBACK, amount: null, currency: currency || null };
    }
  }
  return { display: RATE_FALLBACK, amount: null, currency: null };
};

const buildInitials = (name) => {
  const parts = toStringSafe(name)
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return "??";
  const first = parts[0][0];
  const last = parts.length > 1 ? parts[parts.length - 1][0] : parts[0][1];
  return [first, last].filter(Boolean).join("").toUpperCase();
};

const truncateHeadline = (text) => {
  const trimmed = toStringSafe(text);
  if (!trimmed) return "Coach profile";
  if (trimmed.length <= MAX_HEADLINE_LENGTH) return trimmed;
  const sliced = trimmed.slice(0, MAX_HEADLINE_LENGTH).replace(/[\s\u00a0]+$/u, "");
  return `${sliced}…`;
};

const extractCoaches = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === "object") {
    if (Array.isArray(payload.results)) return payload.results;
    if (Array.isArray(payload.data)) return payload.data;
    if (Array.isArray(payload.coaches)) return payload.coaches;
    if (Array.isArray(payload.items)) return payload.items;
  }
  return [];
};

const pick = (obj, keys) => {
  if (!obj || typeof obj !== "object") return undefined;
  for (let i = 0; i < keys.length; i += 1) {
    const value = obj[keys[i]];
    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }
  return undefined;
};

export const normalizeCoach = (coach) => {
  if (!coach || typeof coach !== "object") return null;
  const id =
    pick(coach, [
      "id",
      "coach_id",
      "coachId",
      "player_coach_id",
      "uuid",
      "user_id",
      "userId",
    ]) ?? null;
  if (id === null) return null;
  const slug = pick(coach, ["slug", "seo_slug", "slugName", "profile_slug"]);
  const firstName = pick(coach, ["first_name", "firstName", "given_name", "givenName"]);
  const lastName = pick(coach, ["last_name", "lastName", "family_name", "familyName"]);
  const name =
    pick(coach, ["name", "full_name", "fullName", "display_name", "displayName", "coach_name"]) ||
    [firstName, lastName].filter(Boolean).join(" ") ||
    firstName ||
    lastName ||
    "Coach";
  const bio =
    pick(coach, [
      "bio",
      "about",
      "short_bio",
      "shortBio",
      "description",
      "summary",
      "headline",
    ]) || "";
  const headline = truncateHeadline(bio);
  const avatarUrl = pick(coach, [
    "profile_image",
    "profileImage",
    "profile_photo",
    "profilePhoto",
    "avatar",
    "avatar_url",
    "avatarUrl",
    "photo",
  ]);
  const availabilitySource =
    pick(coach, [
      "availability",
      "availability_summary",
      "availabilitySummary",
      "schedule",
      "schedule_summary",
      "scheduleSummary",
      "general_availability",
    ]) ?? coach.availability;
  const rateSource =
    pick(coach, [
      "hourly_rate",
      "hourlyRate",
      "rate",
      "price_per_hour",
      "pricePerHour",
      "lesson_rate",
      "lessonRate",
      "private_lesson_rate",
      "privateLessonRate",
      "rate_display",
      "rateDisplay",
      "pricing",
      "pricing_summary",
    ]) ?? coach.lesson_rate ?? coach.lessonRate;
  const locationSource =
    pick(coach, [
      "locations",
      "location_list",
      "locationList",
      "coach_locations",
      "coachLocations",
      "venues",
      "location_names",
      "locationNames",
    ]) ?? coach.location;

  return {
    id,
    slug: slug ? String(slug) : undefined,
    name,
    bio: toStringSafe(bio) || undefined,
    headline,
    avatarUrl: toStringSafe(avatarUrl) || undefined,
    availability: formatCoachAvailability(availabilitySource),
    rate: formatCoachRate(rateSource),
    locations: formatCoachLocations(locationSource),
    initials: buildInitials(name),
  };
};

export const normalizeCoaches = (payload) => extractCoaches(payload).map(normalizeCoach).filter(Boolean);

export const AVAILABILITY_PLACEHOLDER = AVAILABILITY_FALLBACK;
export const RATE_PLACEHOLDER = RATE_FALLBACK;
