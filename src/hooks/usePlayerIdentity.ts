import { useMemo } from "react";
import { useAuth } from "../context/AuthContext";

const FALLBACK_EMAIL = "player@matchplay.app";

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

const usePlayerIdentity = () => {
  const auth = useAuth() as { user?: unknown } | undefined;
  const user = auth?.user;

  const displayName = useMemo(() => extractDisplayName(user), [user]);
  const email = (user as { email?: string } | undefined)?.email || FALLBACK_EMAIL;
  const initials = useMemo(
    () => getInitialsFromIdentity(displayName, email),
    [displayName, email],
  );

  return { displayName, email, initials };
};

export default usePlayerIdentity;
export { getInitialsFromIdentity };
