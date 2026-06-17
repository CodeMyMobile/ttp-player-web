import api, { unwrap } from "./api";
import { countUniqueMatchOccupants } from "../utils/participants";

const qs = (params) => {
  const search = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    search.set(key, value);
  });
  const str = search.toString();
  return str ? `?${str}` : "";
};

export const getMatch = async (
  id,
  { filter, includeHidden = false, include_hidden } = {},
) => {
  const queryParams = {};
  if (filter) queryParams.filter = filter;
  const includeHiddenFlag =
    includeHidden ||
    include_hidden === true ||
    include_hidden === "true" ||
    include_hidden === 1;
  if (includeHiddenFlag) {
    queryParams.includeHidden = true;
    queryParams.include_hidden = true;
  }
  const query = qs(queryParams);
  return unwrap(api(`/matches/${id}${query}`));
};

export const createMatch = async (match) => {
  const response = await unwrap(
    api(`/matches`, {
      method: "POST",
      body: JSON.stringify(match),
    })
  );

  const createdMatch =
    (response && typeof response === "object" && response.match) || response;
  const matchId =
    createdMatch?.id ?? createdMatch?.match_id ?? createdMatch?.matchId ?? null;

  let shareUrl =
    (response && typeof response === "object" && response.shareUrl) || null;

  if (matchId && !shareUrl) {
    try {
      const linkResponse = await getShareLink(matchId);
      shareUrl = linkResponse?.shareUrl || null;
    } catch (error) {
      console.warn("Failed to load share link after creating match", error);
    }
  }

  if (response && typeof response === "object" && !Array.isArray(response)) {
    return {
      ...response,
      match: createdMatch,
      shareUrl,
    };
  }

  return { match: createdMatch, shareUrl };
};

const pickArray = (...candidates) => {
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
  }
  return [];
};

const pickObject = (...candidates) => {
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
      continue;
    }
    return candidate;
  }
  return {};
};

const normalizePagination = (data) => {
  const explicit = pickObject(
    data?.pagination,
    data?.meta?.pagination,
    data?.meta?.page_info,
    data?.meta?.pageInfo,
  );
  if (explicit && Object.keys(explicit).length > 0) {
    return explicit;
  }

  const parseNumeric = (...values) => {
    for (const value of values) {
      if (value === undefined || value === null) continue;
      const numeric =
        typeof value === "string" ? Number.parseFloat(value) : Number(value);
      if (Number.isFinite(numeric)) {
        return numeric;
      }
    }
    return null;
  };

  const page = parseNumeric(
    data?.page,
    data?.current_page,
    data?.meta?.page,
    data?.meta?.current_page,
    data?.meta?.pageNumber,
  );
  const perPage = parseNumeric(
    data?.perPage,
    data?.per_page,
    data?.page_size,
    data?.meta?.perPage,
    data?.meta?.per_page,
    data?.meta?.page_size,
    data?.meta?.pageSize,
  );
  const total = parseNumeric(
    data?.total,
    data?.count,
    data?.meta?.total,
    data?.meta?.total_count,
    data?.meta?.count,
  );

  if (!Number.isFinite(perPage) || perPage <= 0) {
    return null;
  }

  return {
    page: Number.isFinite(page) && page > 0 ? page : 1,
    perPage,
    ...(Number.isFinite(total) && total >= 0 ? { total } : {}),
  };
};

const normalizeMatchesResponse = (data) => {
  const matches = pickArray(
    data?.matches,
    data?.data,
    data?.items,
    data?.results,
    Array.isArray(data) ? data : null,
  );

  const counts = pickObject(
    data?.counts,
    data?.summary,
    data?.meta?.counts,
    data?.meta?.summary,
  );

  const base = data && typeof data === "object" && !Array.isArray(data) ? data : {};

  return {
    ...base,
    matches,
    counts,
    pagination: normalizePagination(base) || null,
  };
};

export const listMatches = (
  filter,
  {
    status,
    search = "",
    page = 1,
    perPage = 10,
    when,
    created_by,
    level,
    format,
    gender,
    category,
    latitude,
    longitude,
    distance,
    radius,
    includeHidden = false,
    include_hidden,
    hidden: hiddenOption,
    hiddenOnly = false,
    visibility,
  } = {},
) => {
  const params = { page, perPage };
  if (filter) params.filter = filter;
  if (status) params.status = status;
  if (search) params.search = search;
  if (when) params.when = when;
  if (created_by) params.created_by = created_by;
  if (level) params.level = level;
  if (format) params.format = format;
  if (gender) params.gender = gender;
  if (category) params.category = category;
  const includeHiddenFlag =
    includeHidden ||
    include_hidden === true ||
    include_hidden === "true" ||
    include_hidden === 1;
  if (includeHiddenFlag) {
    params.includeHidden = true;
    params.include_hidden = true;
  } else if (include_hidden === false || include_hidden === "false" || include_hidden === 0) {
    params.include_hidden = false;
  }
  const normalizedVisibility = typeof visibility === "string" ? visibility.trim() : "";
  const visibilityLower = normalizedVisibility
    ? normalizedVisibility.toLowerCase()
    : "";
  const visibilityIndicatesHidden = Boolean(
    visibilityLower &&
      (visibilityLower === "hidden" ||
        visibilityLower === "link_only" ||
        visibilityLower === "link-only" ||
        visibilityLower === "link only" ||
        visibilityLower === "unlisted"),
  );
  const wantsHiddenOnly =
    hiddenOnly ||
    hiddenOption === true ||
    hiddenOption === "true" ||
    hiddenOption === 1 ||
    visibilityIndicatesHidden;
  if (wantsHiddenOnly) {
    params.hidden = true;
    params.visibility = visibilityIndicatesHidden
      ? normalizedVisibility || "hidden"
      : "hidden";
  } else if (
    hiddenOption === false ||
    hiddenOption === "false" ||
    hiddenOption === 0
  ) {
    params.hidden = false;
  } else if (visibilityLower) {
    params.visibility = normalizedVisibility;
  }
  const addNumericParam = (key, value) => {
    if (value === undefined || value === null) return;
    const numeric =
      typeof value === "string" ? Number.parseFloat(value) : value;
    if (Number.isFinite(numeric)) {
      params[key] = numeric;
    }
  };
  addNumericParam("latitude", latitude);
  addNumericParam("longitude", longitude);
  addNumericParam("distance", distance);
  if (!Object.prototype.hasOwnProperty.call(params, "distance")) {
    addNumericParam("radius", radius);
  }
  return unwrap(api(`/matches${qs(params)}`)).then(normalizeMatchesResponse);
};

// Derives roster occupancy from a raw match. The backend has no flat
// `current_players`/`spots_left` field — capacity lives in a `capacity` object
// (confirmed/limit/open) with a participants+invitees roster fallback. Mirrors
// the inline logic in TennisMatchApp.jsx so spots-left stays consistent.
export const getMatchSpots = (match) => {
  if (!match || typeof match !== "object") {
    return { joined: 0, total: null, spotsLeft: null };
  }

  const capacity =
    match.capacity && typeof match.capacity === "object" ? match.capacity : null;
  const confirmedFromCapacity = Number(capacity?.confirmed ?? capacity?.players);
  const limitFromCapacity = Number(
    capacity?.limit ?? capacity?.max ?? capacity?.capacity,
  );
  const openFromCapacity = Number(capacity?.open);

  const fallbackOccupied = countUniqueMatchOccupants(
    match.participants,
    match.invitees,
  );
  const joined =
    Number.isFinite(confirmedFromCapacity) && confirmedFromCapacity >= 0
      ? confirmedFromCapacity
      : fallbackOccupied;

  const total = (() => {
    if (Number.isFinite(limitFromCapacity) && limitFromCapacity > 0) {
      return limitFromCapacity;
    }
    const raw = match.player_limit;
    const numeric = typeof raw === "string" ? Number.parseInt(raw, 10) : raw;
    return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
  })();

  const spotsLeft = Number.isFinite(openFromCapacity)
    ? Math.max(openFromCapacity, 0)
    : total !== null
      ? Math.max(total - joined, 0)
      : null;

  return { joined, total, spotsLeft };
};

export const updateMatch = (id, updates) =>
  unwrap(
    api(`/matches/${id}`, {
      method: "PUT",
      body: JSON.stringify(updates),
    })
  );

export const listAttentionMatches = ({
  limit,
  withinHours,
  within_hours,
} = {}) => {
  const params = {};
  if (limit !== undefined && limit !== null && limit !== "") {
    params.limit = limit;
  }
  const normalizedWithinHours =
    withinHours ?? within_hours;
  if (
    normalizedWithinHours !== undefined &&
    normalizedWithinHours !== null &&
    normalizedWithinHours !== ""
  ) {
    params.withinHours = normalizedWithinHours;
    params.within_hours = normalizedWithinHours;
  }
  return unwrap(api(`/matches/attention${qs(params)}`));
};

export const cancelMatch = async (id) => {
  try {
    return await unwrap(
      api(`/matches/${id}/cancel`, {
        method: "POST",
        json: { match_id: id },
      }),
    );
  } catch (error) {
    const status = Number(error?.status ?? error?.response?.status);
    if (status && ![404, 405].includes(status)) {
      throw error;
    }
  }

  return unwrap(
    api(`/matches/${id}`, {
      method: "DELETE",
    }),
  );
};

export const joinMatch = (id) =>
  unwrap(
    api(`/matches/${id}/join`, {
      method: "POST",
      authSchemePreference: "token",
      json: { match_id: id },
    })
  );

export const leaveMatch = (id) =>
  unwrap(
    api(`/matches/${id}/leave`, {
      method: "POST",
      authSchemePreference: "token",
      json: { match_id: id },
    })
  );

export const removeParticipant = (matchId, playerId) =>
  unwrap(
    api(`/matches/${matchId}/participants/${playerId}`, {
      method: "DELETE",
    })
  );

export const sendInvites = (matchId, { playerIds = [], phoneNumbers = [] } = {}) =>
  unwrap(
    api(`/matches/${matchId}/invites`, {
      method: "POST",
      body: JSON.stringify({ playerIds, phoneNumbers }),
    })
  );

export const getShareLink = (matchId) =>
  unwrap(api(`/matches/${matchId}/share-link`));

export const notifyMatchPlayers = (matchId, payload = {}) =>
  unwrap(
    api(`/matches/${matchId}/notify`, {
      method: "POST",
      json: payload,
    }),
  );

export const listMatchNotifications = (matchId) =>
  unwrap(api(`/matches/${matchId}/notifications`));

export const deleteMatchNotification = (matchId, notificationId) =>
  unwrap(
    api(`/matches/${matchId}/notifications/${notificationId}`, {
      method: "DELETE",
    }),
  );

export const listMatchMessages = (matchId) =>
  unwrap(api(`/matches/${matchId}/messages`));

export const createMatchMessage = (matchId, payload = {}) =>
  unwrap(
    api(`/matches/${matchId}/messages`, {
      method: "POST",
      json: payload,
    }),
  );

export const sendMatchPlayerDirectMessage = (
  matchId,
  playerId,
  payload = {},
) =>
  unwrap(
    api(`/matches/${matchId}/players/${playerId}/dm`, {
      method: "POST",
      json: payload,
    }),
  );

export const searchPlayers = ({ search = "", page = 1, perPage = 12, ids } = {}) => {
  const params = { search, page, perPage };
  if (ids && ids.length) params.ids = ids.join(",");
  return unwrap(api(`/matches/players${qs(params)}`));
};
