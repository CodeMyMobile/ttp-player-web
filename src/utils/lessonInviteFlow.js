const decodeToken = (value) => {
  if (!value) return null;
  try {
    return decodeURIComponent(value.trim());
  } catch {
    return value.trim();
  }
};

const readTokenFromPath = (pathValue) => {
  if (!pathValue) return null;
  const [cleanPath] = String(pathValue).split(/[?#]/);
  const match = cleanPath.match(/\/li\/([^/]+)/);
  if (!match) return null;
  return decodeToken(match[1]);
};

export const extractInviteTokenFromRoute = ({ paramsToken, pathname, hash } = {}) => {
  const fromParams = decodeToken(paramsToken || "");
  if (fromParams) return fromParams;

  const fromPath = readTokenFromPath(pathname);
  if (fromPath) return fromPath;

  const cleanHash = hash ? String(hash).replace(/^#/, "") : "";
  const fromHash = readTokenFromPath(cleanHash);
  if (fromHash) return fromHash;

  return null;
};

const flagIsTrue = (value) => value === true;

export const shouldRequireInvitePayment = ({ beginPayload, claimPayload } = {}) =>
  flagIsTrue(claimPayload?.requires_payment) ||
  flagIsTrue(claimPayload?.paymentRequired) ||
  flagIsTrue(beginPayload?.requires_payment) ||
  flagIsTrue(beginPayload?.paymentRequired);

export const decideInviteNextAction = ({ beginPayload, claimPayload } = {}) =>
  shouldRequireInvitePayment({ beginPayload, claimPayload }) ? "pay" : "accept";
