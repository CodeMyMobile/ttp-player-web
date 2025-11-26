import api, { unwrap } from "./api";

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

export const updateMatch = (id, updates) =>
  unwrap(
    api(`/matches/${id}`, {
      method: "PUT",
      body: JSON.stringify(updates),
    })
  );

export const cancelMatch = (id) =>
  unwrap(
    api(`/matches/${id}`, {
      method: "DELETE",
    })
  );

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

export const searchPlayers = ({ search = "", page = 1, perPage = 12, ids } = {}) => {
  const params = { search, page, perPage };
  if (ids && ids.length) params.ids = ids.join(",");
  return unwrap(api(`/matches/players${qs(params)}`));
};
