import api, { unwrap } from "./api";

const buildQuery = (params = {}) => {
  const search = new URLSearchParams();
  const normalizeKey = (key) => {
    switch (key) {
      case "perPage":
        return "per_page";
      case "matchId":
        return "match_id";
      default:
        return key;
    }
  };

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    const normalizedKey = normalizeKey(key);
    search.set(normalizedKey, value);
    if (normalizedKey !== key) {
      search.set(key, value);
    }
  });
  const str = search.toString();
  return str ? `?${str}` : "";
};

export const getInvitePreview = async (token, { filter } = {}) => {
  const query = buildQuery({ filter });
  const data = await unwrap(api(`/invites/${token}${query}`));
  return data.invite || data;
};

export const beginInviteVerification = (token, payload) =>
  unwrap(
    api(`/invites/${token}/begin`, {
      method: "POST",
      body: JSON.stringify(payload || {}),
    })
  );

export const verifyInviteCode = (token, code) =>
  unwrap(
    api(`/invites/${token}/verify`, {
      method: "POST",
      body: JSON.stringify({ code }),
    })
  );

export const claimInvite = (token, payload) =>
  unwrap(
    api(`/invites/${token}/claim`, {
      method: "POST",
      body: JSON.stringify(payload || {}),
    })
  );

export const listInvites = ({ status, page, perPage, filter } = {}) => {
  const query = buildQuery({ status, page, perPage, filter });
  return unwrap(api(`/invites${query}`));
};

export const acceptInvite = (token) =>
  unwrap(
    api(`/invites/accept`, {
      method: "POST",
      body: JSON.stringify({ token }),
    })
  );

export const rejectInvite = (token) =>
  unwrap(
    api(`/invites/reject`, {
      method: "POST",
      body: JSON.stringify({ token }),
    })
  );

export const rejectInviteByToken = (token) =>
  unwrap(
    api(`/invites/${token}/reject`, {
      method: "POST",
      json: {},
      authToken: null,
    })
  );

export const getInviteByToken = (token, { filter } = {}) => {
  const query = buildQuery({ filter });
  return unwrap(api(`/invites/${token}${query}`));
};
