import { useCallback, useEffect, useState } from "react";
import { addToCircle, getMyCircle, removeFromCircle } from "../api/circle";
import { ANALYTICS_EVENTS, track } from "../utils/analytics";
import { getStoredAuthToken } from "../services/authToken";

// Whether one person is in the signed-in player's circle, and a toggle for the "Add to circle"
// button on player and coach profiles. The member ids are loaded once per page load and shared,
// so moving between profiles doesn't refetch; an add or remove updates the shared set.

let memberIds: Promise<Set<number>> | null = null;

const loadMemberIds = () => {
  if (!memberIds) {
    memberIds = getMyCircle()
      .then((response) => new Set((response?.members ?? []).map((member) => Number(member.id))))
      .catch((error) => {
        memberIds = null;
        throw error;
      });
  }
  return memberIds;
};

/** After the Circle tab adds or removes someone, so profiles opened next agree with it. */
export const forgetCircleMembership = () => {
  memberIds = null;
};

export interface CircleMembership {
  /** null until known, and when the circle can't be loaded (the button then stays hidden). */
  inCircle: boolean | null;
  saving: boolean;
  error: string;
  toggle: () => Promise<void>;
}

export function useCircleMembership(userId: number | null | undefined, enabled = true): CircleMembership {
  const [inCircle, setInCircle] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const id = Number(userId);
  const active = enabled && Number.isFinite(id) && id > 0 && Boolean(getStoredAuthToken());

  useEffect(() => {
    setInCircle(null);
    setError("");
    if (!active) return undefined;
    let cancelled = false;
    loadMemberIds()
      .then((ids) => {
        if (!cancelled) setInCircle(ids.has(id));
      })
      .catch(() => {
        if (!cancelled) setInCircle(null);
      });
    return () => {
      cancelled = true;
    };
  }, [active, id]);

  const toggle = useCallback(async () => {
    if (!active || inCircle === null || saving) return;
    setSaving(true);
    setError("");
    try {
      if (inCircle) await removeFromCircle(id);
      else {
        await addToCircle(id);
        track(ANALYTICS_EVENTS.circleAdd, { source: "profile" });
      }
      const next = !inCircle;
      setInCircle(next);
      const ids = await loadMemberIds().catch(() => null);
      if (ids) {
        if (next) ids.add(id);
        else ids.delete(id);
      }
    } catch {
      setError(inCircle ? "Couldn't remove them. Try again." : "Couldn't add them. Try again.");
    } finally {
      setSaving(false);
    }
  }, [active, id, inCircle, saving]);

  return { inCircle, saving, error, toggle };
}
