import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Calendar,
  Loader2,
  MapPin,
  RefreshCcw,
  Search,
  SlidersHorizontal,
  Star,
  Users2,
} from "lucide-react";
import api, { unwrap } from "../services/api";
import { useAuth } from "../context/AuthContext";
import useDebouncedValue from "../hooks/useDebouncedValue";
import "./PlayerCoachListPage.css";

const PER_PAGE = 10;
const DEFAULT_RADIUS = 10;
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  "https://ttp-api.codemymobile.com/api";

const buildQueryValue = (value) =>
  value !== undefined && value !== null ? String(value).trim() : "";

const sanitizeLocationSearch = (location) => {
  if (!location) return "";
  if (location.isCurrentLocation) return "";
  const label = buildQueryValue(location.address);
  if (!label) return "";
  if (label.replace(/\s+/g, " ").trim().toLowerCase() === "current location") {
    return "";
  }
  return label;
};

const parseCoachList = (payload) => {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.results)) return payload.results;
  if (Array.isArray(payload?.coaches)) return payload.coaches;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
};

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
  if (/^[\d.,\-\/\s]+$/.test(text)) score -= 150;
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
  let best = { value: "", score: Number.NEGATIVE_INFINITY };
  for (const source of sources) {
    if (!source) continue;
    for (const key of keys) {
      if (!Object.prototype.hasOwnProperty.call(source, key)) continue;
      const candidate = extractMeaningfulString(source[key], options);
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
  } catch (error) {
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

const normalizeCoach = (coach) => {
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
    "profile_bio",
    "profileBio",
    "profile_summary",
    "profileSummary",
  ];
  const bio =
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
        coach.user?.bio,
        coach.user?.about,
        coach.user?.profile?.bio,
        coach.user?.profile?.about,
        coach.user?.profile?.summary,
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
  const lessonsCount =
    parseNumber(
      coach.lessons_booked ??
        coach.lessons_count ??
        coach.sessions_count ??
        coach.total_lessons,
    ) ?? null;
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
    lessonsCount,
    badge: typeof badge === "string" && badge.trim() ? badge : null,
    status,
    slug,
  };
};

const FilterModal = ({
  title,
  isOpen,
  onClose,
  onClearAll,
  onDone,
  children,
}) => {
  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKey = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKey);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKey);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div className="filter-modal-overlay" role="dialog" aria-modal="true">
      <div className="filter-modal-content">
        <header className="filter-modal-header">
          <button
            type="button"
            className="filter-modal-clear"
            onClick={onClearAll}
          >
            Clear All
          </button>
          <h2>{title}</h2>
          <button type="button" className="filter-modal-done" onClick={onDone}>
            Done
          </button>
        </header>
        <div className="filter-modal-body">{children}</div>
      </div>
      <button
        type="button"
        className="filter-modal-backdrop"
        aria-label="Close filters"
        onClick={onClose}
      />
    </div>,
    document.body,
  );
};

const CoachCard = ({ coach, variant = "standard" }) => {
  const initials = useMemo(() => {
    if (!coach?.name) return "CC";
    const parts = coach.name
      .split(" ")
      .map((part) => part.trim())
      .filter(Boolean);
    if (!parts.length) return "CC";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }, [coach?.name]);

  const statusLabel = useMemo(() => {
    if (!coach?.status) return null;
    if (coach.status === "inactive") return "Inactive";
    if (coach.status === "pending") return "Pending";
    return null;
  }, [coach?.status]);

  const statusClass = useMemo(() => {
    if (!coach?.status) return "";
    if (coach.status === "inactive") return "coach-card-banner inactive";
    if (coach.status === "pending") return "coach-card-banner pending";
    return "";
  }, [coach?.status]);

  const ratingDisplay =
    typeof coach?.ratingValue === "number" && !Number.isNaN(coach.ratingValue)
      ? coach.ratingValue.toFixed(1)
      : null;
  const ratingCountDisplay =
    typeof coach?.ratingCount === "number" && coach.ratingCount > 0
      ? coach.ratingCount
      : null;
  const locationEntries = useMemo(() => {
    if (Array.isArray(coach?.locationPlaces) && coach.locationPlaces.length) {
      return coach.locationPlaces;
    }
    if (Array.isArray(coach?.locationList) && coach.locationList.length) {
      return coach.locationList.map((label, index) => ({
        id: `location-${index}-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
        label,
      }));
    }
    return [];
  }, [coach?.locationList, coach?.locationPlaces]);
  const displayedLocations = locationEntries.slice(0, 3);
  const remainingLocations = Math.max(locationEntries.length - displayedLocations.length, 0);
  const facilityDisplay =
    typeof coach?.facility === "string" ? coach.facility.trim() : coach?.facility;
  const primaryLocation =
    displayedLocations[0]?.label || facilityDisplay || coach?.locationList?.[0] || null;
  const specialties = Array.isArray(coach?.specialties)
    ? coach.specialties.filter(Boolean).slice(0, variant === "featured" ? 4 : 3)
    : [];

  const lessonsDisplay =
    typeof coach?.lessonsCount === "number" && coach.lessonsCount > 0
      ? `${coach.lessonsCount.toLocaleString()} lessons`
      : null;

  return (
    <article className={`coach-card ${variant}`}>
      {statusLabel ? <div className={statusClass}>{statusLabel}</div> : null}
      {coach?.badge ? (
        <div className="coach-card-accent" aria-label={coach.badge}>
          {coach.badge}
        </div>
      ) : null}
      <div className="coach-card-main">
        <div className="coach-card-avatar" aria-hidden={coach.avatar ? undefined : true}>
          {coach.avatar ? (
            <img src={coach.avatar} alt={coach.name} loading="lazy" />
          ) : (
            <span>{initials}</span>
          )}
        </div>
        <div className="coach-card-body">
          <header className="coach-card-header">
            <div className="coach-card-title">
              <h3>{coach.name}</h3>
              {ratingDisplay ? (
                <div
                  className="coach-card-rating"
                  aria-label={`Rated ${ratingDisplay} out of 5${
                    ratingCountDisplay ? ` from ${ratingCountDisplay} reviews` : ""
                  }`}
                >
                  <Star size={16} aria-hidden />
                  <span>{ratingDisplay}</span>
                  {ratingCountDisplay ? (
                    <span className="coach-card-rating-count">({ratingCountDisplay})</span>
                  ) : null}
                </div>
              ) : null}
            </div>
            {coach.hourlyRate ? (
              <span className="coach-card-rate">{coach.hourlyRate}</span>
            ) : null}
          </header>
          {coach.bio ? <p className="coach-card-bio">{coach.bio}</p> : null}
          {specialties.length ? (
            <ul className="coach-card-specialties" aria-label="Specialties">
              {specialties.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : null}
          <div className="coach-card-meta">
            {displayedLocations.length ? (
              <div
                className="coach-card-locations"
                aria-label={
                  primaryLocation
                    ? `Coaching locations including ${primaryLocation}`
                    : "Coaching locations"
                }
              >
                <MapPin size={14} aria-hidden />
                <div className="coach-card-locations-body">
                  <ul className="coach-card-locations-list">
                    {displayedLocations.map((location) => (
                      <li key={location.id}>{location.label}</li>
                    ))}
                  </ul>
                  <div className="coach-card-locations-footer">
                    {remainingLocations > 0 ? (
                      <span className="coach-card-locations-more">+{remainingLocations} more</span>
                    ) : null}
                    {coach.distanceLabel ? (
                      <span className="coach-card-distance">{coach.distanceLabel}</span>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}
            {coach.availability ? (
              <div className="coach-card-meta-item">
                <Calendar size={14} aria-hidden />
                <span>{coach.availability}</span>
              </div>
            ) : null}
            {lessonsDisplay ? (
              <div className="coach-card-meta-item">
                <Users2 size={14} aria-hidden />
                <span>{lessonsDisplay}</span>
              </div>
            ) : null}
          </div>
        </div>
      </div>
      <div className="coach-card-footer">
        <Link className="coach-card-cta" to={`/coaches/${coach.slug || coach.id}`}>
          View Profile
          <ArrowRight size={16} />
        </Link>
      </div>
    </article>
  );
};

const PlayerCoachListPage = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("all");
  const [allCoachPlayers, setAllCoachPlayers] = useState([]);
  const [addedCoachPlayers, setAddedCoachPlayers] = useState([]);
  const [allCoachesPage, setAllCoachesPage] = useState(1);
  const [myCoachesPage, setMyCoachesPage] = useState(1);
  const [allMiniLoader, setAllMiniLoader] = useState(false);
  const [addedMiniLoader, setAddedMiniLoader] = useState(false);
  const [locationLoader, setLocationLoader] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isAllCoachesListEnd, setIsAllCoachesListEnd] = useState(false);
  const [isMyCoachesListEnd, setIsMyCoachesListEnd] = useState(false);
  const [filterText, setFilterText] = useState("");
  const [myCoachesFilterText, setMyCoachesFilterText] = useState("");
  const [radius, setRadius] = useState(DEFAULT_RADIUS);
  const [locationFilter, setLocationFilter] = useState(null);
  const [userPos, setUserPos] = useState(null);
  const [openFilter, setOpenFilter] = useState(null);
  const [dynamicFilters, setDynamicFilters] = useState([]);
  const [selectedFilters, setSelectedFilters] = useState({});
  const [locationQuery, setLocationQuery] = useState("");
  const [locationSuggestions, setLocationSuggestions] = useState([]);
  const [locationSuggestionLoading, setLocationSuggestionLoading] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [nameDraft, setNameDraft] = useState("");
  const [locationPreview, setLocationPreview] = useState(null);
  const [focusFilterSection, setFocusFilterSection] = useState(null);
  const [resultsAnnouncement, setResultsAnnouncement] = useState("");
  const [specialtySelection, setSpecialtySelection] = useState([]);
  const [sortValue, setSortValue] = useState("recommended");

  const allListSentinelRef = useRef(null);
  const myListSentinelRef = useRef(null);
  const locationInputRef = useRef(null);
  const radiusInputRef = useRef(null);
  const nameFilterInputRef = useRef(null);
  const hasRequestedLocationRef = useRef(false);
  const dynamicFilterRefs = useRef({});

  const debouncedUserPos = useDebouncedValue(userPos, 400);
  const filtersSignature = useMemo(() => {
    const activeEntries = Object.entries(selectedFilters).filter(([, value]) => {
      if (Array.isArray(value)) return value.length > 0;
      return Boolean(value);
    });
    if (!activeEntries.length) return "";
    return JSON.stringify(Object.fromEntries(activeEntries));
  }, [selectedFilters]);

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationError("Location is not supported in this browser.");
      return;
    }
    setLocationLoader(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserPos({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setLocationPreview({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setLocationFilter((prev) =>
          prev && prev.address
            ? prev
            : {
                address: "Current location",
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                isCurrentLocation: true,
              },
        );
        setLocationLoader(false);
      },
      (error) => {
        console.error("Failed to obtain location", error);
        setLocationError(error.message || "Unable to fetch location");
        setLocationLoader(false);
      },
      { enableHighAccuracy: true, maximumAge: 1000 * 60 * 5, timeout: 1000 * 20 },
    );
  }, []);

  useEffect(() => {
    if (hasRequestedLocationRef.current) return;
    hasRequestedLocationRef.current = true;
    requestLocation();
  }, [requestLocation]);

  useEffect(() => {
    if (locationFilter) return;
    if (!debouncedUserPos?.latitude || !debouncedUserPos?.longitude) return;
    setLocationFilter({
      address: "Current location",
      latitude: debouncedUserPos.latitude,
      longitude: debouncedUserPos.longitude,
      isCurrentLocation: true,
    });
    setLocationPreview({
      latitude: debouncedUserPos.latitude,
      longitude: debouncedUserPos.longitude,
    });
    setLocationError("");
  }, [debouncedUserPos, locationFilter]);

  const canQueryAllCoaches = useMemo(() => {
    if (locationFilter?.latitude && locationFilter?.longitude) return true;
    if (debouncedUserPos?.latitude && debouncedUserPos?.longitude) return true;
    return false;
  }, [debouncedUserPos, locationFilter]);

  const dynamicFilterPills = useMemo(() => {
    return dynamicFilters.map((filter) => {
      const selection = selectedFilters[filter.key];
      let suffix = "";
      if (Array.isArray(selection) && selection.length) {
        suffix = `${selection.length}`;
      } else if (selection) {
        suffix = selection;
      }
      return {
        key: filter.key,
        label: suffix ? `${filter.title} • ${suffix}` : filter.title,
        isActive: Array.isArray(selection) ? selection.length > 0 : Boolean(selection),
      };
    });
  }, [dynamicFilters, selectedFilters]);

  const heroStats = useMemo(() => {
    const available = allCoachPlayers.length;
    const ratingValues = allCoachPlayers
      .map((coach) => coach.ratingValue)
      .filter((value) => typeof value === "number");
    const hourlyValues = allCoachPlayers
      .map((coach) => coach.hourlyRateValue)
      .filter((value) => typeof value === "number");
    const lessonsValues = allCoachPlayers
      .map((coach) => coach.lessonsCount)
      .filter((value) => typeof value === "number");
    const avgRating = ratingValues.length
      ? ratingValues.reduce((sum, value) => sum + value, 0) / ratingValues.length
      : null;
    const avgRate = hourlyValues.length
      ? hourlyValues.reduce((sum, value) => sum + value, 0) / hourlyValues.length
      : null;
    const totalLessons = lessonsValues.length
      ? lessonsValues.reduce((sum, value) => sum + value, 0)
      : null;
    return {
      available,
      avgRating: avgRating ? avgRating.toFixed(1) : null,
      avgHourlyRate: avgRate ? `$${Math.round(avgRate)}/hr` : null,
      lessons: totalLessons ? totalLessons.toLocaleString() : null,
    };
  }, [allCoachPlayers]);

  const specialtyChips = useMemo(
    () => [
      { label: "Serve Technique", value: "serve-technique" },
      { label: "Match Strategy", value: "match-strategy" },
      { label: "Junior Development", value: "junior-development" },
      { label: "Beginner Friendly", value: "beginner-friendly" },
      { label: "Doubles Strategy", value: "doubles-strategy" },
      { label: "Mental Game", value: "mental-game" },
    ],
    [],
  );

  const toggleSpecialty = useCallback((value) => {
    setSpecialtySelection((prev) => {
      if (prev.includes(value)) {
        return prev.filter((item) => item !== value);
      }
      return [...prev, value];
    });
  }, []);

  const handleSortChange = useCallback((event) => {
    setSortValue(event.target.value);
  }, []);

  const handleSearchChange = useCallback((event) => {
    setNameDraft(event.target.value);
  }, []);

  const resultsCount = activeTab === "all" ? allCoachPlayers.length : addedCoachPlayers.length;

  useEffect(() => {
    const count = activeTab === "all" ? allCoachPlayers.length : addedCoachPlayers.length;
    setResultsAnnouncement(`${count} coach${count === 1 ? "" : "es"} found`);
  }, [activeTab, addedCoachPlayers.length, allCoachPlayers.length]);

  const resetAllPagination = useCallback(() => {
    setAllCoachesPage(1);
    setIsAllCoachesListEnd(false);
  }, []);

  const resetMyPagination = useCallback(() => {
    setMyCoachesPage(1);
    setIsMyCoachesListEnd(false);
  }, []);

  const buildFilterQueryParam = useCallback(() => {
    if (!filtersSignature) return "";
    return `&filters=${encodeURIComponent(filtersSignature)}`;
  }, [filtersSignature]);

  const buildFilterBody = useCallback(() => {
    if (!filtersSignature) return undefined;
    try {
      return JSON.parse(filtersSignature);
    } catch {
      return undefined;
    }
  }, [filtersSignature]);

  const fetchDynamicFilters = useCallback(async () => {
    try {
      const response = await unwrap(api("/player/filters"));
      const items = parseCoachList(response).length
        ? parseCoachList(response)
        : Array.isArray(response?.filters)
          ? response.filters
          : [];
      const normalized = items
        .map((item) => ({
          key: item.key ?? item.id ?? item.slug,
          title: item.title ?? item.name ?? item.label ?? "Filter",
          filterType: (() => {
            const rawType = (item.filterType ?? item.type ?? "single").toLowerCase();
            if (rawType === "multiple" || rawType === "multi-select") return "multi";
            return rawType;
          })(),
          options:
            Array.isArray(item.options) && item.options.length
              ? item.options
              : Array.isArray(item.values)
                ? item.values
                : [],
        }))
        .filter((item) => item.key);
      setDynamicFilters(normalized);
    } catch (error) {
      console.error("Failed to fetch dynamic filters", error);
    }
  }, []);

  useEffect(() => {
    fetchDynamicFilters();
  }, [fetchDynamicFilters]);

  useEffect(() => {
    if (openFilter === "filters") {
      setLocationQuery(locationFilter?.address ?? "");
      setLocationPreview(
        locationFilter?.latitude && locationFilter?.longitude
          ? {
              latitude: locationFilter.latitude,
              longitude: locationFilter.longitude,
            }
          : debouncedUserPos || null,
      );
      setLocationError("");
      setNameDraft(activeTab === "all" ? filterText : myCoachesFilterText);
    }
  }, [
    activeTab,
    debouncedUserPos,
    filterText,
    locationFilter,
    myCoachesFilterText,
    openFilter,
  ]);

  useEffect(() => {
    if (openFilter !== "filters") {
      setLocationSuggestions([]);
    }
  }, [openFilter]);

  useEffect(() => {
    if (openFilter !== "filters") return;
    const trimmed = locationQuery.trim();
    if (trimmed.length < 3) {
      setLocationSuggestions([]);
      return;
    }
    let cancelled = false;
    setLocationSuggestionLoading(true);
    unwrap(
      api(
        `/player/locations-geojson?search=${encodeURIComponent(trimmed)}`,
        {
          method: "GET",
        },
      ),
    )
      .then((data) => {
        if (cancelled) return;
        const features = Array.isArray(data?.features)
          ? data.features
          : Array.isArray(data?.data)
            ? data.data
            : [];
        const mapped = features
          .map((feature) => {
            const properties = feature.properties ?? feature;
            const geometry = feature.geometry ?? {};
            const coordinates = geometry.coordinates ?? [];
            const latitude = coordinates[1] ?? properties.latitude ?? null;
            const longitude = coordinates[0] ?? properties.longitude ?? null;
            const label =
              properties.label ??
              properties.title ??
              properties.name ??
              feature.label ??
              feature.name ??
              "";
            if (!label) return null;
            return {
              id: feature.id ?? properties.id ?? label,
              label,
              latitude,
              longitude,
            };
          })
          .filter(Boolean);
        setLocationSuggestions(mapped);
      })
      .catch((error) => {
        if (cancelled) return;
        console.error("Location search failed", error);
        setLocationSuggestions([]);
      })
      .finally(() => {
        if (!cancelled) {
          setLocationSuggestionLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [locationQuery, openFilter]);

  useEffect(() => {
    if (openFilter === "filters") return;
    if (focusFilterSection === null) return;
    setFocusFilterSection(null);
  }, [focusFilterSection, openFilter]);

  useEffect(() => {
    if (openFilter !== "filters") return;
    const timer = window.setTimeout(() => {
      if (focusFilterSection === "location" && locationInputRef.current) {
        locationInputRef.current.focus();
      } else if (focusFilterSection === "radius" && radiusInputRef.current) {
        radiusInputRef.current.focus();
      } else if (focusFilterSection === "name" && nameFilterInputRef.current) {
        nameFilterInputRef.current.focus();
      } else if (focusFilterSection && dynamicFilterRefs.current[focusFilterSection]) {
        const node = dynamicFilterRefs.current[focusFilterSection];
        if (node?.scrollIntoView) {
          node.scrollIntoView({ behavior: "smooth", block: "start" });
        }
        if (node?.focus) {
          node.focus();
        }
      }
    }, 80);
    return () => window.clearTimeout(timer);
  }, [
    dynamicFilterRefs,
    focusFilterSection,
    locationInputRef,
    nameFilterInputRef,
    openFilter,
    radiusInputRef,
  ]);

  const normalizeListResponse = useCallback(
    (payload) =>
      parseCoachList(payload)
        .map(normalizeCoach)
        .filter((coach) => coach && coach.id && coach.id !== user?.id),
    [user?.id],
  );

  const fetchAllCoaches = useCallback(
    async ({ page = 1, append = false } = {}) => {
      if (!canQueryAllCoaches) {
        setAllCoachPlayers([]);
        setIsAllCoachesListEnd(false);
        return;
      }
      setAllMiniLoader(true);
      if (!append) {
        setIsAllCoachesListEnd(false);
      }
      const position = locationFilter?.latitude
        ? {
            latitude: locationFilter.latitude,
            longitude: locationFilter.longitude,
            latitudeDelta: 0.25,
            longitudeDelta: 0.25,
          }
        : debouncedUserPos
          ? {
              latitude: debouncedUserPos.latitude,
              longitude: debouncedUserPos.longitude,
              latitudeDelta: 0.25,
              longitudeDelta: 0.25,
            }
          : null;
      try {
        const searchTerm = buildQueryValue(filterText);
        const locationSearch = sanitizeLocationSearch(locationFilter);
        const filterParams = buildFilterQueryParam();
        const response = await unwrap(
          api(
            `/player/getchecklocation?perPage=${PER_PAGE}&page=${page}&search=${encodeURIComponent(searchTerm)}${
              locationSearch ? `&locationSearch=${encodeURIComponent(locationSearch)}` : ""
            }&radius=${encodeURIComponent(radius)}${filterParams}`,
            {
              method: "POST",
              json: {
                position,
                filters: buildFilterBody(),
              },
            },
          ),
        );
        const normalized = normalizeListResponse(response);
        setAllCoachPlayers((prev) =>
          append ? [...prev, ...normalized] : [...normalized],
        );
        setIsAllCoachesListEnd(normalized.length < PER_PAGE);
        if (!append) {
          setAllCoachesPage(1);
        }
      } catch (error) {
        console.error("Failed to load coaches", error);
        if (!append) {
          setAllCoachPlayers([]);
        }
      } finally {
        setAllMiniLoader(false);
      }
    },
    [
      buildFilterBody,
      buildFilterQueryParam,
      canQueryAllCoaches,
      debouncedUserPos,
      filterText,
      locationFilter,
      normalizeListResponse,
      radius,
    ],
  );

  const fetchMyCoaches = useCallback(
    async ({ page = 1, append = false } = {}) => {
      setAddedMiniLoader(true);
      if (!append) {
        setIsMyCoachesListEnd(false);
      }
      try {
        const searchTerm = buildQueryValue(myCoachesFilterText);
        const locationSearch = sanitizeLocationSearch(locationFilter);
        const filterParams = buildFilterQueryParam();
        const response = await unwrap(
          api(
            `/player/coaches?perPage=${PER_PAGE}&page=${page}&search=${encodeURIComponent(searchTerm)}${
              locationSearch ? `&locationSearch=${encodeURIComponent(locationSearch)}` : ""
            }${filterParams}`,
            {
              method: "GET",
            },
          ),
        );
        const normalized = normalizeListResponse(response);
        setAddedCoachPlayers((prev) =>
          append ? [...prev, ...normalized] : [...normalized],
        );
        setIsMyCoachesListEnd(normalized.length < PER_PAGE);
        if (!append) {
          setMyCoachesPage(1);
        }
      } catch (error) {
        console.error("Failed to load added coaches", error);
        if (!append) {
          setAddedCoachPlayers([]);
        }
      } finally {
        setAddedMiniLoader(false);
      }
    },
    [
      buildFilterQueryParam,
      locationFilter?.address,
      locationFilter?.isCurrentLocation,
      myCoachesFilterText,
      normalizeListResponse,
    ],
  );

  useEffect(() => {
    if (activeTab !== "all") return;
    if (!canQueryAllCoaches) return;
    fetchAllCoaches({ page: 1, append: false });
  }, [
    activeTab,
    canQueryAllCoaches,
    fetchAllCoaches,
    filterText,
    radius,
    locationFilter,
    filtersSignature,
  ]);

  useEffect(() => {
    if (activeTab !== "my") return;
    fetchMyCoaches({ page: 1, append: false });
  }, [activeTab, fetchMyCoaches, myCoachesFilterText, locationFilter, filtersSignature]);

  useEffect(() => {
    if (activeTab !== "all") return;
    if (allCoachesPage <= 1) return;
    fetchAllCoaches({ page: allCoachesPage, append: true });
  }, [activeTab, allCoachesPage, fetchAllCoaches]);

  useEffect(() => {
    if (activeTab !== "my") return;
    if (myCoachesPage <= 1) return;
    fetchMyCoaches({ page: myCoachesPage, append: true });
  }, [activeTab, fetchMyCoaches, myCoachesPage]);

  const loadMoreAllCoaches = useCallback(() => {
    if (allMiniLoader || isAllCoachesListEnd) return;
    setAllCoachesPage((prev) => prev + 1);
  }, [allMiniLoader, isAllCoachesListEnd]);

  const loadMoreMyCoaches = useCallback(() => {
    if (addedMiniLoader || isMyCoachesListEnd) return;
    setMyCoachesPage((prev) => prev + 1);
  }, [addedMiniLoader, isMyCoachesListEnd]);

  useEffect(() => {
    if (activeTab !== "all") return;
    const node = allListSentinelRef.current;
    if (!node) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) {
        loadMoreAllCoaches();
      }
    });
    observer.observe(node);
    return () => {
      observer.disconnect();
    };
  }, [activeTab, allCoachPlayers.length, loadMoreAllCoaches]);

  useEffect(() => {
    if (activeTab !== "my") return;
    const node = myListSentinelRef.current;
    if (!node) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) {
        loadMoreMyCoaches();
      }
    });
    observer.observe(node);
    return () => {
      observer.disconnect();
    };
  }, [activeTab, addedCoachPlayers.length, loadMoreMyCoaches]);

  const handleLocationSelect = useCallback((suggestion) => {
    setLocationFilter({
      address: suggestion.label,
      latitude: suggestion.latitude,
      longitude: suggestion.longitude,
      isCurrentLocation: false,
    });
    if (suggestion.latitude && suggestion.longitude) {
      setLocationPreview({
        latitude: suggestion.latitude,
        longitude: suggestion.longitude,
      });
    }
  }, []);

  const commitNameFilter = useCallback(() => {
    if (activeTab === "all") {
      setFilterText(nameDraft.trim());
      resetAllPagination();
    } else {
      setMyCoachesFilterText(nameDraft.trim());
      resetMyPagination();
    }
  }, [activeTab, nameDraft, resetAllPagination, resetMyPagination]);

  const handleSearchSubmit = useCallback(
    (event) => {
      event.preventDefault();
      commitNameFilter();
    },
    [commitNameFilter],
  );

  const handleSearchClear = useCallback(() => {
    setNameDraft("");
    if (activeTab === "all") {
      setFilterText("");
      resetAllPagination();
    } else {
      setMyCoachesFilterText("");
      resetMyPagination();
    }
  }, [activeTab, resetAllPagination, resetMyPagination]);

  const handleFiltersClear = useCallback(() => {
    if (debouncedUserPos?.latitude && debouncedUserPos?.longitude) {
      setLocationFilter({
        address: "Current location",
        latitude: debouncedUserPos.latitude,
        longitude: debouncedUserPos.longitude,
        isCurrentLocation: true,
      });
      setLocationPreview({
        latitude: debouncedUserPos.latitude,
        longitude: debouncedUserPos.longitude,
      });
    } else {
      setLocationFilter(null);
      setLocationPreview(null);
    }
    setLocationQuery("");
    setLocationSuggestions([]);
    setLocationError("");
    setRadius(DEFAULT_RADIUS);
    setNameDraft("");
    setFilterText("");
    setMyCoachesFilterText("");
    setSelectedFilters({});
    setSpecialtySelection([]);
    resetAllPagination();
    resetMyPagination();
  }, [
    debouncedUserPos,
    resetAllPagination,
    resetMyPagination,
  ]);

  const handleFiltersDone = useCallback(() => {
    commitNameFilter();
    setOpenFilter(null);
    setFocusFilterSection(null);
  }, [commitNameFilter]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (activeTab === "all") {
        await fetchAllCoaches({ page: 1, append: false });
      } else {
        await fetchMyCoaches({ page: 1, append: false });
      }
    } finally {
      setRefreshing(false);
    }
  }, [activeTab, fetchAllCoaches, fetchMyCoaches]);

  const shouldShowLocationPrompt =
    activeTab === "all" && !canQueryAllCoaches && !locationLoader;

  useEffect(() => {
    if (activeTab === "all" && !canQueryAllCoaches) {
      setAllCoachPlayers([]);
      setIsAllCoachesListEnd(false);
    }
  }, [activeTab, canQueryAllCoaches]);

  const activeList = activeTab === "all" ? allCoachPlayers : addedCoachPlayers;
  const isActiveLoading = activeTab === "all" ? allMiniLoader : addedMiniLoader;
  const activeListEnd = activeTab === "all" ? isAllCoachesListEnd : isMyCoachesListEnd;
  const activeSentinelRef = activeTab === "all" ? allListSentinelRef : myListSentinelRef;
  const featuredCoaches = activeTab === "all" ? activeList.slice(0, 2) : [];
  const remainingCoaches = activeTab === "all" ? activeList.slice(2) : activeList;
  const resultsHeading = activeTab === "all" ? "All Coaches" : "My Coaches";
  const resultsDescription =
    activeTab === "all"
      ? "Browse certified coaches tailored to your goals."
      : "Coaches you have already connected with.";
  const showInitialLoader = isActiveLoading && !activeList.length;
  const showEmptyState = !isActiveLoading && !activeList.length;

  const renderDynamicFilterControls = (filter) => {
    const selection = selectedFilters[filter.key] ?? (filter.filterType === "multi" ? [] : "");
    if (filter.filterType === "multi") {
      return (
        <div className="filter-options">
          {filter.options.map((option) => {
            const optionValue =
              typeof option === "object" && option !== null
                ? option.value ?? option.id ?? option.slug ?? option.label ?? option.name
                : option;
            const value = optionValue ?? option;
            const label =
              typeof option === "object" && option !== null
                ? option.label ?? option.name ?? option.title ?? String(value)
                : String(option ?? value ?? "");
            const checked = Array.isArray(selection) && selection.includes(value);
            return (
              <label key={value} className="filter-option">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(event) => {
                    const { checked: isChecked } = event.target;
                    setSelectedFilters((prev) => {
                      const current = Array.isArray(prev[filter.key])
                        ? [...prev[filter.key]]
                        : [];
                      if (isChecked) {
                        current.push(value);
                        return {
                          ...prev,
                          [filter.key]: Array.from(new Set(current)),
                        };
                      }
                      const reduced = current.filter((item) => item !== value);
                      if (!reduced.length) {
                        const next = { ...prev };
                        delete next[filter.key];
                        return next;
                      }
                      return {
                        ...prev,
                        [filter.key]: reduced,
                      };
                    });
                  }}
                />
                <span>{label}</span>
              </label>
            );
          })}
        </div>
      );
    }

    return (
      <div className="filter-options">
        {filter.options.map((option) => {
          const optionValue =
            typeof option === "object" && option !== null
              ? option.value ?? option.id ?? option.slug ?? option.label ?? option.name
              : option;
          const value = optionValue ?? option;
          const label =
            typeof option === "object" && option !== null
              ? option.label ?? option.name ?? option.title ?? String(value)
              : String(option ?? value ?? "");
          return (
            <label key={value} className="filter-option">
              <input
                type="radio"
                name={`filter-${filter.key}`}
                checked={selection === value}
                onChange={() => {
                  setSelectedFilters((prev) => ({
                    ...prev,
                    [filter.key]: value,
                  }));
                }}
              />
              <span>{label}</span>
            </label>
          );
        })}
      </div>
    );
  };

  return (
    <div className="coach-list-page">
      <header className="coach-hero">
        <div className="coach-hero-copy">
          <p className="coach-hero-eyebrow">Player Experience</p>
          <h1>Find Your Perfect Coach</h1>
          <p className="coach-hero-subtitle">
            Get matched with certified tennis professionals in your area.
          </p>
          <div className="coach-tab-bar" role="tablist" aria-label="Coach views">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "all"}
              className={`coach-tab${activeTab === "all" ? " active" : ""}`}
              onClick={() => {
                setActiveTab("all");
                resetAllPagination();
              }}
            >
              <Users2 size={16} aria-hidden />
              All Coaches
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "my"}
              className={`coach-tab${activeTab === "my" ? " active" : ""}`}
              onClick={() => {
                setActiveTab("my");
                resetMyPagination();
              }}
            >
              <SlidersHorizontal size={16} aria-hidden />
              My Coaches
            </button>
          </div>
        </div>
        <dl className="coach-hero-stats">
          <div className="coach-hero-stat">
            <dt>Available Coaches</dt>
            <dd>{heroStats.available.toLocaleString()}</dd>
          </div>
          <div className="coach-hero-stat">
            <dt>Avg Rating</dt>
            <dd>{heroStats.avgRating ?? "—"}</dd>
          </div>
          <div className="coach-hero-stat">
            <dt>Avg Hourly Rate</dt>
            <dd>{heroStats.avgHourlyRate ?? "—"}</dd>
          </div>
          <div className="coach-hero-stat">
            <dt>Lessons Booked</dt>
            <dd>{heroStats.lessons ?? "—"}</dd>
          </div>
        </dl>
      </header>

      <section className="coach-controls" aria-label="Search and filters">
        <div className="coach-controls-bar">
          <button
            type="button"
            className="coach-location-trigger"
            onClick={() => {
              setFocusFilterSection("location");
              setOpenFilter("filters");
            }}
            aria-label={
              locationFilter?.address
                ? `Change location from ${locationFilter.address}`
                : "Select a location"
            }
            aria-haspopup="dialog"
          >
            <MapPin size={16} aria-hidden />
            <span>
              {locationFilter?.address
                ? locationFilter.address
                : debouncedUserPos?.latitude && debouncedUserPos?.longitude
                  ? "Current location"
                  : "Select location"}
            </span>
          </button>
          <form className="coach-search" role="search" onSubmit={handleSearchSubmit}>
            <Search size={16} aria-hidden />
            <input
              type="search"
              value={nameDraft}
              onChange={handleSearchChange}
              placeholder="Search coaches by name…"
              aria-label="Search coaches by name"
            />
            {nameDraft ? (
              <button type="button" className="coach-search-clear" onClick={handleSearchClear}>
                <span className="sr-only">Clear search</span>
                ×
              </button>
            ) : null}
          </form>
          <button
            type="button"
            className="coach-filters-toggle"
            onClick={() => {
              setFocusFilterSection(null);
              setOpenFilter("filters");
            }}
            aria-haspopup="dialog"
            aria-expanded={openFilter === "filters"}
          >
            <SlidersHorizontal size={16} aria-hidden />
            Filters
          </button>
          <div className="coach-sort">
            <label htmlFor="coach-sort-select">Sort by</label>
            <select
              id="coach-sort-select"
              value={sortValue}
              onChange={handleSortChange}
              aria-label="Sort coaches"
            >
              <option value="recommended">Recommended</option>
              <option value="price">Price</option>
              <option value="rating">Rating</option>
              <option value="distance">Distance</option>
            </select>
          </div>
        </div>
        <div
          id="coach-specialty-chips"
          className="coach-chip-toolbar"
          role="toolbar"
          aria-label="Specialty filters"
        >
          {specialtyChips.map((chip) => {
            const isSelected = specialtySelection.includes(chip.value);
            return (
              <button
                key={chip.value}
                type="button"
                className={`coach-chip${isSelected ? " selected" : ""}`}
                onClick={() => toggleSpecialty(chip.value)}
                aria-pressed={isSelected}
              >
                {chip.label}
              </button>
            );
          })}
        </div>
        {dynamicFilterPills.some((pill) => pill.isActive) ? (
          <div className="coach-active-filters" role="list" aria-label="Active filters">
            {dynamicFilterPills
              .filter((pill) => pill.isActive)
              .map((pill) => (
                <button
                  type="button"
                  key={pill.key}
                  className="filter-pill"
                  role="listitem"
                  onClick={() => {
                    setFocusFilterSection(pill.key);
                    setOpenFilter("filters");
                  }}
                  aria-haspopup="dialog"
                >
                  <span>{pill.label}</span>
                </button>
              ))}
          </div>
        ) : null}
      </section>

      <div className="coach-results-header">
        <div>
          <h2>{resultsHeading}</h2>
          <p>{resultsDescription}</p>
        </div>
        <div className="coach-results-meta">
          <span className="coach-results-count" aria-live="polite">
            {resultsCount.toLocaleString()} results
          </span>
          <button
            type="button"
            className={`refresh-button${refreshing ? " refreshing" : ""}`}
            onClick={handleRefresh}
          >
            <RefreshCcw size={16} aria-hidden />
            Refresh
          </button>
        </div>
      </div>

      <section className="coach-results" aria-label="Coach results">
        <div className="sr-only" role="status" aria-live="polite">
          {resultsAnnouncement}
        </div>

        {shouldShowLocationPrompt ? (
          <div className="location-permission-card">
            <div className="location-permission-copy">
              <h3>Enable location to find nearby coaches</h3>
              <p>
                Turn on your device location or pick a location to see coaches close to you.
              </p>
              {locationError ? <p className="location-error">{locationError}</p> : null}
            </div>
            <div className="location-permission-actions">
              <button type="button" className="primary" onClick={requestLocation}>
                {locationLoader ? <Loader2 className="spin" size={16} aria-hidden /> : null}
                Enable Location
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  setFocusFilterSection("location");
                  setOpenFilter("filters");
                }}
              >
                Enter Manually
              </button>
            </div>
          </div>
        ) : null}

        {!shouldShowLocationPrompt && showInitialLoader ? (
          <div className="coach-list-loader">
            <Loader2 className="spin" size={32} aria-hidden />
            <p>Loading coaches…</p>
          </div>
        ) : null}

        {!shouldShowLocationPrompt && !showInitialLoader && showEmptyState ? (
          <div className="coach-list-empty">No coaches found.</div>
        ) : null}

        {!shouldShowLocationPrompt && !showInitialLoader && !showEmptyState ? (
          <Fragment>
            {activeTab === "all" && featuredCoaches.length ? (
              <section className="coach-section" aria-labelledby="featured-coaches-heading">
                <div className="coach-section-header">
                  <h3 id="featured-coaches-heading">Featured Coaches</h3>
                  <p>Coaches with outstanding reviews and engagement.</p>
                </div>
                <div className="coach-featured-grid">
                  {featuredCoaches.map((coach) => (
                    <CoachCard key={`featured-${coach.id}`} coach={coach} variant="featured" />
                  ))}
                </div>
              </section>
            ) : null}

            <section className="coach-section" aria-labelledby="all-coaches-heading">
              <div className="coach-section-header">
                <h3 id="all-coaches-heading">{resultsHeading}</h3>
                <p>{resultsDescription}</p>
              </div>
              <div className={`coach-grid ${activeTab === "all" ? "all" : "mine"}`}>
                {remainingCoaches.map((coach) => (
                  <CoachCard
                    key={coach.id}
                    coach={coach}
                    variant={activeTab === "all" ? "standard" : "compact"}
                  />
                ))}
              </div>
              <div ref={activeSentinelRef} className="list-sentinel" aria-hidden>
                {isActiveLoading && activeList.length ? (
                  <Loader2 className="spin" size={20} aria-hidden />
                ) : null}
                {activeListEnd ? <span>End of results</span> : null}
              </div>
            </section>
          </Fragment>
        ) : null}
      </section>

      <FilterModal
        title="Filters"
        isOpen={openFilter === "filters"}
        onClose={() => setOpenFilter(null)}
        onClearAll={handleFiltersClear}
        onDone={handleFiltersDone}
      >
        <div className="filters-panel">
          <section className="filter-group" aria-labelledby="filter-location-heading">
            <div className="filter-group-header">
              <h3 id="filter-location-heading">Location</h3>
              <p>Choose where to search from.</p>
            </div>
            <label className="field-label" htmlFor="coach-location-search">
              Search address
            </label>
            <div className="field-with-icon">
              <Search size={16} aria-hidden />
              <input
                id="coach-location-search"
                ref={locationInputRef}
                type="text"
                value={locationQuery}
                placeholder="Search for a city, club, or court"
                onChange={(event) => setLocationQuery(event.target.value)}
              />
            </div>
            <button type="button" className="use-my-location" onClick={requestLocation}>
              Use my current location
            </button>
            {locationSuggestionLoading ? (
              <div className="location-suggestions loading">
                <Loader2 className="spin" size={16} aria-hidden /> Searching…
              </div>
            ) : null}
            {locationSuggestions.length ? (
              <ul className="location-suggestions">
                {locationSuggestions.map((suggestion) => (
                  <li key={suggestion.id}>
                    <button
                      type="button"
                      onClick={() => {
                        handleLocationSelect(suggestion);
                        setLocationQuery(suggestion.label);
                      }}
                    >
                      <MapPin size={16} aria-hidden />
                      <span>{suggestion.label}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="location-preview">
              <h4>Selected location</h4>
              {locationFilter?.address ? (
                <p>{locationFilter.address}</p>
              ) : locationPreview?.latitude && locationPreview?.longitude ? (
                <p>
                  Lat {locationPreview.latitude.toFixed(4)}, Lng {" "}
                  {locationPreview.longitude.toFixed(4)}
                </p>
              ) : (
                <p>No location selected yet.</p>
              )}
              {locationError ? <p className="location-error">{locationError}</p> : null}
            </div>
          </section>

          <section className="filter-group" aria-labelledby="filter-radius-heading">
            <div className="filter-group-header">
              <h3 id="filter-radius-heading">Radius</h3>
              <p>Adjust how far to search from your location.</p>
            </div>
            <div className="radius-filter">
              <div className="radius-value">
                <span>{radius} miles</span>
              </div>
              <input
                ref={radiusInputRef}
                type="range"
                min="1"
                max="100"
                value={radius}
                onChange={(event) => setRadius(Number(event.target.value))}
                onMouseUp={(event) => setRadius(Number(event.target.value))}
                onTouchEnd={(event) => setRadius(Number(event.target.value))}
                aria-label="Search radius in miles"
              />
              <p className="radius-hint">Adjust the search radius to expand or narrow results.</p>
            </div>
          </section>

          <section className="filter-group" aria-labelledby="filter-name-heading">
            <div className="filter-group-header">
              <h3 id="filter-name-heading">Name</h3>
              <p>Filter coaches by name to find a specific pro.</p>
            </div>
            <label className="field-label" htmlFor="coach-name-filter">
              Coach name
            </label>
            <input
              id="coach-name-filter"
              ref={nameFilterInputRef}
              type="text"
              value={nameDraft}
              placeholder="Search by coach name"
              onChange={(event) => setNameDraft(event.target.value)}
              className="filter-text-input"
            />
            <button type="button" className="apply-button" onClick={commitNameFilter}>
              Apply name filter
            </button>
          </section>

          {dynamicFilters.length ? (
            <section className="filter-group" aria-labelledby="filter-more-heading">
              <div className="filter-group-header">
                <h3 id="filter-more-heading">Additional filters</h3>
                <p>Refine by specialties, programs, and more.</p>
              </div>
              <div className="dynamic-filter-list">
                {dynamicFilters.map((filter) => (
                  <div
                    key={filter.key}
                    className="dynamic-filter-group"
                    ref={(node) => {
                      if (node) {
                        dynamicFilterRefs.current[filter.key] = node;
                      } else {
                        delete dynamicFilterRefs.current[filter.key];
                      }
                    }}
                    tabIndex={-1}
                    data-filter-key={filter.key}
                    role="group"
                    aria-labelledby={`filter-${filter.key}-heading`}
                  >
                    <h4 id={`filter-${filter.key}-heading`}>{filter.title}</h4>
                    {filter.options?.length ? (
                      renderDynamicFilterControls(filter)
                    ) : (
                      <p className="filter-empty">No options available.</p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </FilterModal>
    </div>
  );
};

export default PlayerCoachListPage;
