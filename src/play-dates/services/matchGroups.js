import api, { unwrap } from "./api";

const pickGroups = (data) => {
  if (Array.isArray(data?.groups)) return data.groups;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data)) return data;
  return [];
};

export const listMatchGroups = async () => {
  const data = await unwrap(api("/player/match-groups"));
  return {
    ...(data && typeof data === "object" && !Array.isArray(data) ? data : {}),
    groups: pickGroups(data),
  };
};

export const getMatchGroup = (id) =>
  unwrap(api(`/player/match-groups/${id}`));

export const createMatchGroup = (payload = {}) =>
  unwrap(
    api("/player/match-groups", {
      method: "POST",
      json: payload,
    }),
  );

export const updateMatchGroup = (id, payload = {}) =>
  unwrap(
    api(`/player/match-groups/${id}`, {
      method: "PATCH",
      json: payload,
    }),
  );

export const deleteMatchGroup = (id) =>
  unwrap(
    api(`/player/match-groups/${id}`, {
      method: "DELETE",
    }),
  );

export const listMatchGroupPlayers = ({
  search = "",
  page = 1,
  perPage = 12,
} = {}) =>
  unwrap(
    api(
      `/player/match-groups/players?${new URLSearchParams({
        ...(search ? { search } : {}),
        page: String(page),
        perPage: String(perPage),
      }).toString()}`,
    ),
  );
