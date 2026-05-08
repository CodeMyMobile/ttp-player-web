import { useMemo } from "react";
import { useAuth } from "../context/AuthContext";

const FALLBACK_EMAIL = "player@matchplay.app";
const PLAYER_PERSONAL_DETAILS_KEY = "playerPersonalDetails";

const readStoredPersonalDetails = (): Record<string, unknown> | null => {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(PLAYER_PERSONAL_DETAILS_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
};

const getInitialsFromIdentity = (name: string | null | undefined, email: string | null | undefined) => {
  if (name) {
    const parts = name.split(" ").filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    if (parts[0]) {
      return parts[0].slice(0, 2).toUpperCase();
    }
  }

  if (email) {
    return email.slice(0, 2).toUpperCase();
  }

  return "MP";
};

const extractDisplayName = (user: unknown): string => {
  if (!user || typeof user !== "object") {
    return "Paul";
  }

  const profile = user as Record<string, unknown>;

  const nameFields = ["name", "full_name", "first_name", "displayName"] as const;
  for (const field of nameFields) {
    const value = profile[field];
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }

  const email = profile.email;
  if (typeof email === "string" && email.includes("@")) {
    return email.split("@")[0];
  }

  return "Paul";
};

const getAvatarFromIdentity = (user: unknown): string | null => {
  if (!user || typeof user !== "object") {
    return null;
  }

  const profile = user as Record<string, unknown>;
  const avatarFields = ["profile_picture", "avatar_url", "avatar", "picture", "image", "photoURL", "photoUrl"] as const;

  for (const field of avatarFields) {
    const value = profile[field];
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }

  return null;
};

const usePlayerIdentity = () => {
  const auth = useAuth() as { user?: unknown } | undefined;
  const user = auth?.user;
  const personalDetails = useMemo(() => readStoredPersonalDetails(), [user]);
  const identity = useMemo(
    () => ({ ...((user && typeof user === "object") ? user as Record<string, unknown> : {}), ...(personalDetails ?? {}) }),
    [personalDetails, user],
  );

  const displayName = useMemo(() => extractDisplayName(identity), [identity]);
  const email =
    (identity as { email?: string } | undefined)?.email ||
    FALLBACK_EMAIL;
  const initials = useMemo(
    () => getInitialsFromIdentity(displayName, email),
    [displayName, email],
  );
  const avatarUrl = useMemo(() => getAvatarFromIdentity(identity), [identity]);

  return { displayName, email, initials, avatarUrl };
};

export default usePlayerIdentity;
export { getInitialsFromIdentity };
