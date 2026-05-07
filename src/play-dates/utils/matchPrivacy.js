const normalizePrivacyValue = (value) => {
  if (typeof value !== "string") return "";
  const normalized = value.trim().toLowerCase();
  if (!normalized) return "";
  if (normalized === "private" || normalized === "closed") {
    return "private";
  }
  if (normalized === "open" || normalized === "public") {
    return "open";
  }
  return normalized;
};

const getMatchPrivacy = (match) => {
  if (!match || typeof match !== "object") {
    return "open";
  }

  const candidates = [
    match.privacy,
    match.privacy_status,
    match.match_type,
    match.matchType,
    match.type,
  ];

  for (const candidate of candidates) {
    const normalized = normalizePrivacyValue(candidate);
    if (normalized) {
      return normalized;
    }
  }

  return "open";
};

const isPrivateMatch = (match) => getMatchPrivacy(match) === "private";

const isOpenMatch = (match) => getMatchPrivacy(match) !== "private";

export { getMatchPrivacy, isOpenMatch, isPrivateMatch };
