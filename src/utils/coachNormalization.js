const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  "https://ttp-api.codemymobile.com/api";

const parseNumber = (value) => {
  if (value === null || value === undefined) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const IGNORED_OBJECT_KEYS = new Set([
  "type",
  "__typename",
  "__component",
  "id",
  "uid",
  "uuid",
  "slug",
  "key",
  "identifier",
  "created_at",
  "createdAt",
  "updated_at",
  "updatedAt",
  "published_at",
  "publishedAt",
]);

const PRIORITIZED_VALUE_KEYS = [
  "url",
  "href",
  "src",
  "asset",
  "value",
  "label",
  "title",
  "name",
  "headline",
  "heading",
  "text",
  "body",
  "content",
  "copy",
  "description",
  "summary",
  "location",
  "image",
  "profile_image",
  "profileImage",
  "profile_photo",
  "profilePhoto",
  "avatar",
  "photo",
  "picture",
  "html",
  "plain",
  "document",
  "children",
  "data",
  "attributes",
  "blocks",
  "nodes",
];

const HTML_ENTITY_LOOKUP = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
};

const normalizeCandidateText = (value) => {
  if (value === null || value === undefined) return "";
  let text = typeof value === "string" ? value : value.toString();
  if (!text) return "";
  text = text.replace(/<br\s*\/?>(?=\s|$)/gi, " ");
  text = text.replace(/<p[^>]*>/gi, " ");
  text = text.replace(/<\/p>/gi, " ");
  text = text.replace(/<[^>]+>/g, " ");
  text = text.replace(/&(nbsp|#160);/gi, " ");
  text = text
    .replace(/&(amp|lt|gt|quot|#39);/gi, (match) => {
      const lower = match.toLowerCase();
      return HTML_ENTITY_LOOKUP[lower] ?? " ";
    });
  return text.replace(/\s+/g, " ").trim();
};

const collectStringCandidates = (value, state) => {
  if (!state) {
    state = {
      visited: new WeakSet(),
      seen: new Set(),
      results: [],
      order: 0,
    };
  }
  if (value === null || value === undefined) return state;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    const normalized = normalizeCandidateText(value);
    if (!normalized) return state;
    const key = normalized.toLowerCase();
    if (state.seen.has(key)) return state;
    state.seen.add(key);
    state.results.push({ text: normalized, order: state.order++ });
    return state;
  }
  if (typeof value === "object") {
    if (state.visited.has(value)) return state;
    state.visited.add(value);
    if (Array.isArray(value)) {
      value.forEach((item) => collectStringCandidates(item, state));
      return state;
    }
    PRIORITIZED_VALUE_KEYS.forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        collectStringCandidates(value[key], state);
      }
    });
    Object.entries(value).forEach(([nestedKey, nestedValue]) => {
      if (IGNORED_OBJECT_KEYS.has(nestedKey)) return;
      if (PRIORITIZED_VALUE_KEYS.includes(nestedKey)) return;
      collectStringCandidates(nestedValue, state);
    });
  }
  return state;
};

const scoreCandidateString = (text, options = {}) => {
  if (!text) return Number.NEGATIVE_INFINITY;
  const { preferLonger = false } = options;
  const length = text.length;
  let score = preferLonger ? Math.min(length, 600) : Math.min(length, 160);
  if (/[a-z]/i.test(text)) score += 30;
  if (/\s/.test(text)) score += 25;
  if (/[.?!]/.test(text)) score += 10;
  if (/[,;]/.test(text)) score += 5;
  if (/^(https?:)?\/\//i.test(text)) score -= 250;
  if (text.startsWith("data:")) score -= 250;
  if (/^\d{5}(?:-\d{4})?$/.test(text)) score -= 120;
  if (/^zip\s*\d+/i.test(text)) score -= 120;
  if (/^[\d.,/\s-]+$/.test(text)) score -= 150;
  if (/^n\/?a$/i.test(text)) score -= 80;
  if (length <= 3) score -= 60;
  return score;
};

const extractMeaningfulString = (value, options = {}) => {
  const state = collectStringCandidates(value);
  const candidates = state.results.map(({ text, order }) => ({
    value: text,
    score: scoreCandidateString(text, options),
    order,
  }));
  if (!candidates.length) {
    return { value: "", score: Number.NEGATIVE_INFINITY };
  }
  candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.order - b.order;
  });
  const { minLength = 0, requireMinLength = false } = options;
  const selected =
    candidates.find((candidate) => candidate.value.length >= minLength) ?? candidates[0];
  if (requireMinLength && selected.value.length < minLength) {
    return { value: "", score: Number.NEGATIVE_INFINITY };
  }
  return selected;
};

const pickMeaningfulStringFromSources = (sources, keys, options = {}) => {
  if (!Array.isArray(sources) || !sources.length || !Array.isArray(keys) || !keys.length) {
    return "";
  }
  const normalizedTargets = keys.map((key) => key.toLowerCase());
  let best = { value: "", score: Number.NEGATIVE_INFINITY };
  for (const source of sources) {
    if (!source || typeof source !== "object") continue;
    const processed = new Set();
    for (const key of keys) {
      if (!Object.prototype.hasOwnProperty.call(source, key)) continue;
      const normalized = key.toLowerCase();
      if (processed.has(normalized)) continue;
      processed.add(normalized);
      const candidate = extractMeaningfulString(source[key], options);
      if (!candidate.value) continue;
      if (
        candidate.score > best.score ||
        (candidate.score === best.score && candidate.value.length > best.value.length)
      ) {
        best = candidate;
      }
    }
    for (const [rawKey, rawValue] of Object.entries(source)) {
      const normalizedKey = rawKey.toLowerCase();
      if (processed.has(normalizedKey)) continue;
      if (!normalizedTargets.includes(normalizedKey)) continue;
      processed.add(normalizedKey);
      const candidate = extractMeaningfulString(rawValue, options);
      if (!candidate.value) continue;
      if (
        candidate.score > best.score ||
        (candidate.score === best.score && candidate.value.length > best.value.length)
      ) {
        best = candidate;
      }
    }
  }
  return best.value;
};

const coalesceMeaningfulStrings = (values, options = {}) => {
  for (const value of values) {
    const candidate = extractMeaningfulString(value, options);
    if (!candidate.value) continue;
    if (options.requireMinLength && candidate.value.length < (options.minLength ?? 0)) {
      continue;
    }
    if (!options.requireMinLength || candidate.value.length >= (options.minLength ?? 0)) {
      return candidate.value;
    }
  }
  return "";
};

const extractString = (value, visited) => {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return value.toString();
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "object") {
    if (!visited) visited = new WeakSet();
    if (visited.has(value)) return "";
    visited.add(value);
    if (Array.isArray(value)) {
      for (const item of value) {
        const resolved = extractString(item, visited);
        if (resolved) return resolved;
      }
      return "";
    }
    for (const key of PRIORITIZED_VALUE_KEYS) {
      if (key in value) {
        const resolved = extractString(value[key], visited);
        if (resolved) return resolved;
      }
    }
    for (const [nestedKey, nestedValue] of Object.entries(value)) {
      if (IGNORED_OBJECT_KEYS.has(nestedKey)) continue;
      const resolved = extractString(nestedValue, visited);
      if (resolved) return resolved;
    }
  }
  return "";
};

const coalesceStrings = (...values) => {
  for (const value of values) {
    const resolved = extractString(value);
    if (resolved) return resolved;
  }
  return "";
};

const formatDateOnly = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const normalizeDateValue = (value) => {
  if (!value) return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return formatDateOnly(value);
  }
  const text = value.toString().trim();
  if (!text) return "";
  const isoMatch = text.match(/\d{4}-\d{2}-\d{2}/);
  if (isoMatch) {
    return isoMatch[0];
  }
  const slashMatch = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (slashMatch) {
    const [, month, day, year] = slashMatch;
    const normalizedYear = year.length === 2 ? Number(`20${year}`) : Number(year);
    const parsed = new Date(normalizedYear, Number(month) - 1, Number(day));
    if (!Number.isNaN(parsed.getTime())) {
      return formatDateOnly(parsed);
    }
  }
  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) {
    return formatDateOnly(parsed);
  }
  return "";
};

const normalizeDateTimeValue = (value) => {
  if (!value) return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }
  const text = value.toString().trim();
  if (!text) return "";
  const isoCandidate = Date.parse(text);
  if (!Number.isNaN(isoCandidate)) {
    return new Date(isoCandidate).toISOString();
  }
  return text;
};

const normalizeAvailabilitySlot = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" || typeof value === "number") {
    const label = normalizeCandidateText(value);
    if (!label) return null;
    return { label };
  }
  if (typeof value === "object") {
    const label = normalizeCandidateText(
      coalesceStrings(
        value.label,
        value.summary,
        value.title,
        value.name,
        value.text,
        value.description,
        value.note,
        value.copy,
      ),
    );
    const start = normalizeDateTimeValue(
      coalesceStrings(
        value.startDateTime,
        value.start_date_time,
        value.start_time,
        value.startTime,
        value.start,
        value.from,
        value.begin,
        value.time,
        value.starts_at,
        value.startsAt,
      ),
    );
    const end = normalizeDateTimeValue(
      coalesceStrings(
        value.endDateTime,
        value.end_date_time,
        value.end_time,
        value.endTime,
        value.end,
        value.to,
        value.finish,
        value.until,
        value.ends_at,
        value.endsAt,
      ),
    );
    if (!label && !start && !end) {
      return null;
    }
    return {
      label: label || null,
      start: start || null,
      end: end || null,
    };
  }
  return null;
};

const parseAvailabilityCalendar = (coach) => {
  const calendarMap = new Map();

  const addEntry = (date) => {
    if (!date) return;
    if (!calendarMap.has(date)) {
      calendarMap.set(date, { date, slots: [], _keys: new Set() });
    }
  };

  const addSlot = (date, slot) => {
    if (!date || !slot) return;
    addEntry(date);
    const entry = calendarMap.get(date);
    const key = `${slot.start ?? ""}|${slot.end ?? ""}|${slot.label ?? ""}`;
    if (entry._keys.has(key)) return;
    entry._keys.add(key);
    entry.slots.push(slot);
  };

  const parseValue = (value, contextDate = "") => {
    if (value === null || value === undefined) return;
    if (Array.isArray(value)) {
      value.forEach((item) => parseValue(item, contextDate));
      return;
    }
    if (typeof value === "string" || typeof value === "number") {
      const asDate = normalizeDateValue(value);
      if (asDate) {
        addEntry(asDate);
        return;
      }
      if (contextDate) {
        const slot = normalizeAvailabilitySlot(value);
        if (slot) addSlot(contextDate, slot);
      }
      return;
    }
    if (typeof value === "object") {
      const objectKeys = Object.keys(value);
      let handledKeys = false;
      objectKeys.forEach((key) => {
        const keyDate = normalizeDateValue(key);
        if (keyDate) {
          handledKeys = true;
          const nested = value[key];
          if (nested && typeof nested === "object" && !Array.isArray(nested)) {
            parseValue({ date: keyDate, ...nested }, keyDate);
          } else {
            parseValue(nested, keyDate);
          }
        }
      });
      if (handledKeys) return;

      const date =
        normalizeDateValue(
          value.date ??
            value.day ??
            value.date_key ??
            value.dateKey ??
            value.date_value ??
            value.dateValue ??
            value.calendar_date ??
            value.calendarDate ??
            value.dateString ??
            value.day_key ??
            value.dayKey ??
            value.start_date ??
            value.startDate ??
            value.on,
        ) || contextDate;

      if (date) {
        addEntry(date);
        const slotCandidates =
          value.slots ??
          value.times ??
          value.time_slots ??
          value.timeSlots ??
          value.available_slots ??
          value.availableSlots ??
          value.availability ??
          value.entries ??
          value.windows ??
          value.blocks ??
          value.schedule ??
          value.sessions ??
          value.lessons ??
          value.items ??
          value.values ??
          null;
        if (slotCandidates !== null && slotCandidates !== undefined) {
          parseValue(slotCandidates, date);
        }
        const label = normalizeAvailabilitySlot({
          label: normalizeCandidateText(
            coalesceStrings(
              value.label,
              value.summary,
              value.headline,
              value.description,
              value.note,
              value.text,
              value.copy,
              value.status,
            ),
          ),
        });
        if (label?.label) {
          addSlot(date, label);
        }
        return;
      }

      Object.values(value).forEach((nested) => parseValue(nested, contextDate));
    }
  };

  const sources = [
    coach.availability_calendar,
    coach.availabilityCalendar,
    coach.available_dates,
    coach.availableDates,
    coach.available_slots,
    coach.availableSlots,
    coach.calendar,
    coach.calendar_entries,
    coach.calendarEntries,
    coach.schedule?.calendar,
    coach.schedule_calendar,
    coach.profile?.availability_calendar,
    coach.profile?.calendar,
    coach.user?.availability_calendar,
    coach.user?.calendar,
  ];

  sources.forEach((source) => parseValue(source));

  const entries = Array.from(calendarMap.values()).map(({ date, slots }) => ({
    date,
    slots,
  }));

  return entries
    .filter((entry) => entry.date)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((entry) => ({
      ...entry,
      slots: Array.isArray(entry.slots)
        ? entry.slots.filter(Boolean).map((slot) => ({
            label: slot.label || null,
            start: slot.start || null,
            end: slot.end || null,
          }))
        : [],
    }));
};

const normalizeAssetUrl = (value) => {
  if (!value) return "";
  const trimmed = value.toString().trim();
  if (!trimmed) return "";
  if (/^data:/i.test(trimmed)) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("//")) {
    return `https:${trimmed}`;
  }
  try {
    return new URL(trimmed, API_BASE_URL).href;
  } catch {
    return trimmed;
  }
};

const collectObjectSources = (coach) => {
  const sources = [];
  const visited = new WeakSet();
  const queue = [];

  const enqueue = (value) => {
    if (!value || typeof value !== "object") return;
    if (visited.has(value)) return;
    visited.add(value);
    if (Array.isArray(value)) {
      value.forEach((item) => enqueue(item));
      return;
    }
    sources.push(value);
    queue.push(value);
  };

  enqueue(coach);

  while (queue.length) {
    const current = queue.shift();
    Object.values(current).forEach((child) => enqueue(child));
  }

  return sources;
};

const pickStringFromSources = (sources, keys) => {
  for (const source of sources) {
    for (const key of keys) {
      if (source && Object.prototype.hasOwnProperty.call(source, key)) {
        const resolved = extractString(source[key]);
        if (resolved) return resolved;
      }
    }
  }
  return "";
};

export const normalizeCoach = (coach) => {
  if (!coach || typeof coach !== "object") return null;
  const sourceObjects = collectObjectSources(coach);
  const id =
    coach.id ??
    coach.coach_id ??
    coach.player_coach_id ??
    coach.user_id ??
    coach.uuid ??
    null;
  const firstName = coach.first_name ?? coach.firstName ?? "";
  const lastName = coach.last_name ?? coach.lastName ?? "";
  const displayName =
    coach.name ??
    coach.full_name ??
    coach.fullName ??
    coach.coach_name ??
    [firstName, lastName].filter(Boolean).join(" ");
  const hourlyRate =
    coach.hourly_rate ??
    coach.rate ??
    coach.hourlyRate ??
    coach.price_per_hour ??
    coach.hourly_price ??
    null;
  const hourlyRateValue = parseNumber(
    coach.hourly_rate ??
      coach.hourlyRate ??
      coach.price_per_hour ??
      coach.hourly_price ??
      coach.rate,
  );
  const avatarKeys = [
    "avatar",
    "avatar_url",
    "avatarUrl",
    "avatarURL",
    "profile_image",
    "profileImage",
    "profile_image_url",
    "profileImageUrl",
    "profileImageURL",
    "profile_photo",
    "profilePhoto",
    "profile_photo_url",
    "profilePhotoUrl",
    "profilePic",
    "profile_pic",
    "profile_picture",
    "profilePicture",
    "profilePictureUrl",
    "profile_picture_url",
    "photo",
    "photo_url",
    "photoUrl",
    "photoURL",
    "image",
    "image_url",
    "imageUrl",
    "imageURL",
    "picture",
    "picture_url",
    "pictureUrl",
    "headshot",
    "headshot_url",
    "headshotUrl",
    "media_url",
    "mediaUrl",
  ];
  const avatarRaw =
    pickStringFromSources(sourceObjects, avatarKeys) ||
    coalesceStrings(
      coach.avatar,
      coach.profile_image,
      coach.profile_image_url,
      coach.profilePhoto,
      coach.photo,
      coach.profile_picture,
      coach.profilePicture,
      coach.photo_url,
      coach.image,
      coach.picture,
      coach.media?.profile_image,
      coach.media?.avatar,
      coach.media?.photo,
      coach.profile?.profile_image,
      coach.profile?.profile_picture,
      coach.profile?.avatar,
      coach.profile?.photo,
      coach.profile?.image,
      coach.user?.profile_image,
      coach.user?.profile_image_url,
      coach.user?.profile_picture,
      coach.user?.avatar,
      coach.user?.photo,
      coach.user?.image,
      coach.user?.profile?.avatar,
      coach.user?.profile?.profile_image,
      coach.user?.profile?.photo,
    );
  const avatar = normalizeAssetUrl(avatarRaw);
  const locationsRaw =
    coach.locations ??
    coach.locationList ??
    coach.location_list ??
    coach.location_names ??
    coach.locationName ??
    coach.coach_locations ??
    coach.coachLocations ??
    coach.venues ??
    coach.physical_locations ??
    coach.locationsServed ??
    coach.profile?.locations ??
    coach.user?.locations ??
    coach.user?.coach_locations ??
    [];
  let locationList = [];
  let locationPlaces = [];
  const bioKeys = [
    "bio",
    "short_bio",
    "shortBio",
    "biography",
    "bio_text",
    "bioText",
    "coach_bio",
    "coachBio",
    "description",
    "about",
    "summary",
    "about_me",
    "aboutMe",
    "coaching_philosophy",
    "coachingPhilosophy",
    "philosophy",
    "experience",
    "experience_summary",
    "experienceSummary",
    "background",
    "story",
    "profile_bio",
    "profileBio",
    "profile_summary",
    "profileSummary",
    "profile_about",
    "profileAbout",
    "profile_description",
    "profileDescription",
  ];
  const directBio = normalizeCandidateText(
    coalesceStrings(
      coach.bio,
      coach.short_bio,
      coach.description,
      coach.about,
      coach.summary,
      coach.profile?.bio,
      coach.profile?.about,
      coach.profile?.description,
      coach.profile?.short_bio,
      coach.profile?.summary,
      coach.profile?.profile_summary,
      coach.profile?.profile_about,
      coach.profile?.profile_description,
      coach.user?.bio,
      coach.user?.about,
      coach.user?.summary,
      coach.user?.profile?.bio,
      coach.user?.profile?.about,
      coach.user?.profile?.summary,
      coach.user?.profile?.profile_about,
      coach.user?.profile?.profile_description,
      coach.coach?.bio,
      coach.coach?.about,
      coach.coach_profile?.bio,
      coach.coach_profile?.about,
      coach.coach_profile?.summary,
    ),
  );

  let bio = directBio;

  if (!bio || bio.length < 24) {
    const scoredBio =
      pickMeaningfulStringFromSources(sourceObjects, bioKeys, {
        preferLonger: true,
        minLength: 24,
      }) ||
      coalesceMeaningfulStrings(
        [
          coach.bio,
          coach.short_bio,
          coach.description,
          coach.about,
          coach.summary,
          coach.profile?.bio,
          coach.profile?.about,
          coach.profile?.description,
          coach.profile?.short_bio,
          coach.profile?.summary,
          coach.profile?.profile_summary,
          coach.profile?.profile_about,
          coach.profile?.profile_description,
          coach.user?.bio,
          coach.user?.about,
          coach.user?.summary,
          coach.user?.profile?.bio,
          coach.user?.profile?.about,
          coach.user?.profile?.summary,
          coach.user?.profile?.profile_about,
          coach.user?.profile?.profile_description,
          coach.coach?.bio,
          coach.coach?.about,
          coach.coach_profile?.bio,
          coach.coach_profile?.about,
          coach.coach_profile?.summary,
        ],
        {
          preferLonger: true,
          minLength: 24,
        },
      ) ||
      "";

    if (scoredBio && scoredBio.length > bio.length) {
      bio = scoredBio;
    }
  }

  bio = normalizeCandidateText(bio);
  if (!bio) {
    const fallbackSources = [
      coach.profile,
      coach.user?.profile,
      coach.user,
      coach.coach_profile,
      coach,
    ];
    for (const fallbackSource of fallbackSources) {
      if (!fallbackSource) continue;
      const candidate = extractMeaningfulString(fallbackSource, {
        preferLonger: true,
        minLength: 32,
      });
      if (!candidate.value) continue;
      const wordCount = candidate.value.split(/\s+/).filter(Boolean).length;
      if (candidate.score < -40) continue;
      if (wordCount < 6 && candidate.value.length < 48) continue;
      bio = candidate.value;
      break;
    }
  }
  const ratingValue =
    parseNumber(
      coach.rating ??
        coach.average_rating ??
        coach.avg_rating ??
        coach.review_score ??
        coach.rating_value ??
        coach.score,
    ) ?? null;
  const ratingCount =
    parseNumber(
      coach.rating_count ??
        coach.reviews_count ??
        coach.review_count ??
        coach.ratings ??
        coach.total_reviews,
    ) ?? null;
  const specialtiesRaw =
    coach.specialties ??
    coach.speciality ??
    coach.expertise ??
    coach.tags ??
    coach.skill_tags ??
    coach.focus_areas ??
    [];
  let specialties = [];
  if (Array.isArray(specialtiesRaw)) {
    specialties = specialtiesRaw.filter(Boolean).map((item) => {
      if (typeof item === "string") return item.trim();
      if (typeof item === "object" && item !== null) {
        return (
          item.title ??
          item.name ??
          item.label ??
          item.value ??
          ""
        )
          .toString()
          .trim();
      }
      return String(item ?? "").trim();
    });
  } else if (typeof specialtiesRaw === "string") {
    specialties = specialtiesRaw
      .split(/,|\n|\|/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  const facility =
    coalesceStrings(
      coach.facility,
      coach.club,
      coach.club_name,
      coach.location_name,
      coach.primary_location,
      coach.venue,
      coach.profile?.facility,
      coach.profile?.primary_location,
      coach.user?.facility,
      coach.user?.club,
      coach.user?.primary_location,
    ) || null;
  const facilityLabel =
    typeof facility === "string"
      ? facility.trim()
      : typeof facility === "number"
        ? facility.toString()
        : facility;
  const city =
    coalesceStrings(
      coach.city,
      coach.city_name,
      coach.cityName,
      coach.location_city,
      coach.coach_city,
      coach.profile?.city,
      coach.profile?.city_name,
      coach.profile?.cityName,
      coach.user?.city,
      coach.user?.city_name,
      coach.user?.cityName,
    ) || null;
  const state =
    coalesceStrings(
      coach.state,
      coach.state_code,
      coach.stateCode,
      coach.region,
      coach.province,
      coach.location_state,
      coach.coach_state,
      coach.profile?.state,
      coach.profile?.state_code,
      coach.profile?.stateCode,
      coach.user?.state,
      coach.user?.state_code,
      coach.user?.stateCode,
    ) || null;
  const postalCode =
    coalesceStrings(
      coach.zip,
      coach.zip_code,
      coach.postal_code,
      coach.location_zip,
      coach.coach_zip,
      coach.profile?.zip,
      coach.profile?.postal_code,
      coach.user?.zip,
      coach.user?.postal_code,
    ) || null;
  const fallbackCityState = [city, state].filter(Boolean).join(", ");
  const fallbackRegion = [facilityLabel, fallbackCityState].filter(Boolean).join(" • ");

  const formatLocationLabel = (value) => {
    if (!value) return null;
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed) return null;
      if (/^\d{5}(?:-\d{4})?$/.test(trimmed)) {
        if (fallbackRegion) return `${fallbackRegion}`;
        if (fallbackCityState) return `${fallbackCityState}`;
        return null;
      }
      return trimmed;
    }
    if (typeof value === "object") {
      if (Array.isArray(value)) {
        const nestedLabels = value
          .map((item) => formatLocationLabel(item))
          .filter(Boolean);
        if (nestedLabels.length) return nestedLabels[0];
        return null;
      }
      if (value.location || value.place || value.venue || value.facility) {
        const nested = value.location ?? value.place ?? value.venue ?? value.facility;
        const nestedLabel = formatLocationLabel(nested);
        if (nestedLabel) return nestedLabel;
      }
      const name =
        value.name ??
        value.title ??
        value.label ??
        value.facility ??
        value.location_name ??
        value.club ??
        value.venue ??
        value.facility_name ??
        value.organization ??
        value.location ??
        null;
      const street =
        value.address ??
        value.address1 ??
        value.address_1 ??
        value.street ??
        value.street1 ??
        value.street_1 ??
        value.address_line1 ??
        value.address_line_1 ??
        null;
      const localCity =
        value.city ??
        value.city_name ??
        value.locality ??
        value.town ??
        value.county ??
        city ??
        null;
      const localState =
        value.state ??
        value.state_code ??
        value.region ??
        value.province ??
        value.state_abbr ??
        state ??
        null;
      const zip =
        value.zip ??
        value.zip_code ??
        value.postal ??
        value.postal_code ??
        value.postCode ??
        value.post_code ??
        null;
      const areaLabel = [localCity, localState].filter(Boolean).join(", ");
      const parts = [];
      if (name && typeof name === "string") parts.push(name.trim());
      if (street && typeof street === "string") parts.push(street.trim());
      const areaParts = [areaLabel, zip && typeof zip === "string" ? zip.trim() : zip]
        .filter(Boolean)
        .join(" ");
      if (areaParts) parts.push(areaParts);
      if (!parts.length) {
        const fallback =
          (typeof value.description === "string" && value.description.trim()) ||
          (typeof value.value === "string" && value.value.trim()) ||
          (typeof value.slug === "string" && value.slug.trim()) ||
          (typeof value.display_name === "string" && value.display_name.trim()) ||
          (typeof value.label === "string" && value.label.trim()) ||
          null;
        return fallback;
      }
      return parts.join(" • ");
    }
    const text = String(value ?? "").trim();
    return text || null;
  };

  const buildLocationEntry = (value, index) => {
    const label = formatLocationLabel(value);
    if (!label) return null;
    let id = null;
    if (value && typeof value === "object") {
      id =
        value.id ??
        value.uuid ??
        value.location_id ??
        value.locationId ??
        value.slug ??
        value.code ??
        null;
    }
    return {
      id: id ? id.toString() : `location-${index}-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      label,
    };
  };

  const locationEntries = [];
  if (Array.isArray(locationsRaw)) {
    locationsRaw.forEach((item, index) => {
      const entry = buildLocationEntry(item, index);
      if (entry) locationEntries.push(entry);
    });
  } else if (typeof locationsRaw === "string") {
    locationsRaw
      .split(/,|\n|\|/)
      .map((item) => item.trim())
      .filter(Boolean)
      .forEach((item, index) => {
        const entry = buildLocationEntry(item, index);
        if (entry) locationEntries.push(entry);
      });
  }

  const seenLabels = new Set();
  locationPlaces = locationEntries.filter((entry) => {
    const normalized = entry.label.toLowerCase();
    if (seenLabels.has(normalized)) return false;
    seenLabels.add(normalized);
    return true;
  });

  if (
    facilityLabel &&
    !locationPlaces.some((entry) => entry.label.toLowerCase().includes(facilityLabel.toLowerCase()))
  ) {
    locationPlaces.unshift({ id: "facility", label: facilityLabel });
  }

  if (!locationPlaces.length && fallbackCityState) {
    locationPlaces.push({ id: "region", label: fallbackCityState });
  }

  if (fallbackCityState) {
    const hasCityState = locationPlaces.some((entry) =>
      entry.label.toLowerCase().includes(fallbackCityState.toLowerCase()),
    );
    if (!hasCityState) {
      locationPlaces.push({ id: "region", label: fallbackCityState });
    }
  }

  if (postalCode) {
    const formattedPostal = postalCode.toString().trim();
    if (
      formattedPostal &&
      !locationPlaces.some((entry) => entry.label.includes(formattedPostal))
    ) {
      if (fallbackCityState) {
        locationPlaces.push({ id: "postal", label: `${fallbackCityState} (${formattedPostal})` });
      } else {
        locationPlaces.push({ id: "postal", label: `ZIP ${formattedPostal}` });
      }
    }
  }

  const hasNonZipLocation = locationPlaces.some(
    (entry) => !/^zip\s*\d{5}(?:-\d{4})?$/i.test(entry.label.trim()),
  );
  if (hasNonZipLocation) {
    locationPlaces = locationPlaces.filter(
      (entry) => !/^zip\s*\d{5}(?:-\d{4})?$/i.test(entry.label.trim()),
    );
  }

  locationList = locationPlaces.map((entry) => entry.label);
  const distanceValue =
    parseNumber(
      coach.distance ??
        coach.distance_miles ??
        coach.distanceMiles ??
        coach.distance_in_miles,
    ) ?? null;
  const distanceLabel =
    coach.distance_label ??
    coach.distanceLabel ??
    (distanceValue !== null
      ? `${distanceValue.toFixed(distanceValue >= 10 ? 0 : 1)} mi`
      : null);
  const availability =
    coach.availability ??
    coach.next_available ??
    coach.availability_summary ??
    coach.schedule_summary ??
    null;
  const responseTimeLabel = normalizeCandidateText(
    coalesceStrings(
      coach.response_time,
      coach.responseTime,
      coach.average_response_time,
      coach.avg_response_time,
      coach.response_time_label,
      coach.responseTimeLabel,
      coach.response_speed,
      coach.responseSpeed,
      coach.reply_time,
      coach.replyTime,
    ),
  );
  let typicalAvailability = normalizeCandidateText(
    coalesceStrings(
      coach.typical_availability,
      coach.typicalAvailability,
      coach.availability_highlight,
      coach.availabilityHighlight,
      coach.availability_window,
      coach.availabilityWindow,
      coach.preferred_schedule,
      coach.preferredSchedule,
      coach.preferred_times,
      coach.preferredTimes,
    ),
  );
  if (!typicalAvailability) {
    const availabilityCandidate =
      extractMeaningfulString(
        coalesceMeaningfulStrings(
          [
            coach.availability_details,
            coach.availabilityDetails,
            coach.schedule,
            coach.schedule_summary,
            coach.availability_summary,
            coach.profile?.availability,
            coach.profile?.availability_summary,
            coach.user?.availability,
            coach.user?.availability_summary,
            coach.user?.profile?.availability,
          ],
          { minLength: 6 },
        ),
        { minLength: 6 },
      ) ||
      extractMeaningfulString(coach.availability_notes, { minLength: 6 }) ||
      extractMeaningfulString(coach.profile?.availability_notes, { minLength: 6 });
    typicalAvailability = normalizeCandidateText(availabilityCandidate);
  }
  if (!typicalAvailability && typeof availability === "string") {
    typicalAvailability = availability;
  }
  const lessonTypesRaw =
    coach.lesson_types ??
    coach.lessonTypes ??
    coach.lessons_offered ??
    coach.lessonsOffered ??
    coach.lesson_options ??
    coach.lessonOptions ??
    coach.lesson_categories ??
    coach.lessonCategories ??
    coach.programs ??
    coach.program_types ??
    coach.programTypes ??
    coach.program_offerings ??
    coach.offerings ??
    coach.services ??
    coach.lessons ??
    coach.profile?.lesson_types ??
    coach.profile?.lessons ??
    coach.user?.lesson_types ??
    coach.user?.lessons ??
    [];
  const lessonTypeEntries = [];
  const lessonTypeSeen = new Set();
  const categorizeLesson = (value) => {
    if (!value) return "other";
    const text = value.toString().toLowerCase();
    if (/(^|\s)(1-?on-?1|one-?on-?one|private|individual)(\s|$)/.test(text)) {
      return "private";
    }
    if (
      /(group|semi-?private|team|doubles|pairs|clinic|camp|class|squad|workshop|match)/.test(
        text,
      )
    ) {
      return "group";
    }
    return "other";
  };
  const addLessonEntry = (label, description = null) => {
    const normalizedLabel = normalizeCandidateText(label);
    const normalizedDescription = normalizeCandidateText(description);
    if (!normalizedLabel) return;
    const category = categorizeLesson(label);
    const key = `${category}|${normalizedLabel}|${normalizedDescription || ""}`;
    if (lessonTypeSeen.has(key)) return;
    lessonTypeSeen.add(key);
    lessonTypeEntries.push({
      id: `lesson-${lessonTypeEntries.length}-${normalizedLabel
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")}`,
      label: normalizedLabel,
      description: normalizedDescription || null,
      category,
    });
  };
  const parseLessonValue = (value) => {
    if (!value && value !== 0) return;
    if (Array.isArray(value)) {
      value.forEach((item) => parseLessonValue(item));
      return;
    }
    if (typeof value === "object") {
      const label =
        value.label ??
        value.title ??
        value.name ??
        value.lesson_type ??
        value.lessonType ??
        value.program ??
        value.program_type ??
        value.programType ??
        value.type ??
        value.category ??
        value.value ??
        null;
      const description =
        value.description ??
        value.detail ??
        value.details ??
        value.summary ??
        value.note ??
        value.notes ??
        value.copy ??
        null;
      if (label) {
        addLessonEntry(label, description);
      } else {
        Object.values(value).forEach((nested) => {
          if (nested && typeof nested === "object") {
            parseLessonValue(nested);
          } else if (typeof nested === "string") {
            addLessonEntry(nested);
          }
        });
      }
      return;
    }
    if (typeof value === "string") {
      value
        .split(/,|\n|\|/)
        .map((item) => item.trim())
        .filter(Boolean)
        .forEach((item) => addLessonEntry(item));
      return;
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      addLessonEntry(value.toString());
    }
  };
  parseLessonValue(lessonTypesRaw);
  const lessonTypes = lessonTypeEntries;
  const lessonsCount =
    parseNumber(
      coach.lessons_booked ??
        coach.lessons_count ??
        coach.sessions_count ??
        coach.total_lessons,
    ) ?? null;
  const studentsCount =
    parseNumber(
      coach.students_count ??
        coach.student_count ??
        coach.players_count ??
        coach.players_coached ??
        coach.clients_count ??
        coach.client_count ??
        coach.learners_count ??
        coach.learners ??
        coach.athletes_count ??
        coach.athletes ??
        coach.students ??
        coach.total_students ??
        coach.totalStudents,
    ) ?? null;
  const certificationsRaw =
    coach.certifications ??
    coach.certification ??
    coach.credentials ??
    coach.qualifications ??
    coach.accreditations ??
    coach.achievements ??
    coach.awards ??
    coach.recognitions ??
    coach.honors ??
    coach.designations ??
    coach.badges_list ??
    coach.badgesList ??
    [];
  let certifications = [];
  if (Array.isArray(certificationsRaw)) {
    certifications = certificationsRaw
      .map((item) => {
        if (typeof item === "string") return item;
        if (typeof item === "object" && item !== null) {
          return (
            item.title ??
            item.name ??
            item.label ??
            item.badge ??
            item.value ??
            ""
          ).toString();
        }
        return (item ?? "").toString();
      })
      .filter(Boolean);
  } else if (typeof certificationsRaw === "string") {
    certifications = certificationsRaw
      .split(/,|\n|\|/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  const certificationSet = new Set();
  certifications.forEach((item) => {
    const text = normalizeCandidateText(item);
    if (text) certificationSet.add(text);
  });
  certifications = Array.from(certificationSet);
  const availabilityCalendar = parseAvailabilityCalendar(coach);
  const badge =
    coach.badge ??
    coach.highlight ??
    (coach.is_top_rated || (typeof ratingValue === "number" && ratingValue >= 4.8)
      ? "Top Rated"
      : null);
  const status = (coach.status ?? coach.coach_status ?? "").toString().toLowerCase();
  const slug = coach.slug ?? coach.username ?? id;
  const hourlyRateDisplay =
    typeof hourlyRate === "number"
      ? `$${hourlyRate.toFixed(0)}/hr`
      : hourlyRate && typeof hourlyRate === "string"
        ? hourlyRate
        : null;

  return {
    id,
    name: displayName || "Coach",
    hourlyRate: hourlyRateDisplay,
    hourlyRateValue,
    avatar,
    locationList,
    locationPlaces,
    bio,
    ratingValue,
    ratingCount,
    specialties: specialties.filter(Boolean),
    facility: facilityLabel || facility,
    distanceLabel,
    availability,
    typicalAvailability,
    responseTime: responseTimeLabel || null,
    lessonsCount,
    studentsCount,
    lessonTypes,
    badge: typeof badge === "string" && badge.trim() ? badge : null,
    status,
    slug,
    certifications,
    availabilityCalendar,
  };
};

