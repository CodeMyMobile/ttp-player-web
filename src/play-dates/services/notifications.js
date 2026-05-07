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

  const applyValue = (targetKey, targetValue) => {
    if (targetKey && targetValue !== undefined && targetValue !== null) {
      search.set(targetKey, String(targetValue));
    }
  };

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;

    const normalizedKey = normalizeKey(key);

    if (Array.isArray(value)) {
      const normalizedValues = value
        .map((entry) => {
          if (entry === undefined || entry === null) return "";
          const str = String(entry).trim();
          return str;
        })
        .filter((entry) => entry.length > 0);
      if (normalizedValues.length === 0) return;
      const joined = normalizedValues.join(",");
      applyValue(normalizedKey, joined);
      if (normalizedKey !== key) {
        applyValue(key, joined);
      }
      return;
    }

    if (typeof value === "boolean") {
      const stringValue = value ? "1" : "0";
      applyValue(normalizedKey, stringValue);
      if (normalizedKey !== key) {
        applyValue(key, stringValue);
      }
      return;
    }

    applyValue(normalizedKey, value);
    if (normalizedKey !== key) {
      applyValue(key, value);
    }
  });

  const str = search.toString();
  return str ? `?${str}` : "";
};

export const listNotifications = ({ page, perPage, unread, type, types } = {}) => {
  const query = buildQuery({
    page,
    perPage,
    unread,
    type,
    types,
  });
  return unwrap(api(`/notifications${query}`));
};

export const markNotificationsRead = ({ ids } = {}) =>
  unwrap(
    api(`/notifications/read`, {
      method: "POST",
      body: JSON.stringify({ ids: Array.isArray(ids) ? ids : ids ? [ids] : [] }),
    }),
  );

export default {
  listNotifications,
  markNotificationsRead,
};
