import { useCallback, useEffect, useMemo, useState } from "react";

import { fetchPlayerCoaches, requestCoachPlayer, type PlayerCoachRoster } from "../api/playerCoaches";

export type CoachRosterStatus = "unknown" | "not_requested" | "pending" | "accepted";

export const normalizeStatus = (entry?: PlayerCoachRoster | null): CoachRosterStatus => {
  if (!entry) {
    return "not_requested";
  }
  const rawStatus =
    entry.status ??
    entry.status_text ??
    entry.player_status ??
    entry.player_coach_status ??
    entry.coach_status;
  if (typeof rawStatus === "number") {
    if (rawStatus === 1) {
      return "accepted";
    }
    if (rawStatus === 2) {
      return "pending";
    }
    return rawStatus === 0 ? "not_requested" : "unknown";
  }
  if (typeof rawStatus === "string") {
    const normalized = rawStatus.trim().toUpperCase();
    if (["APPROVED", "ACCEPTED", "ACTIVE", "CONNECTED", "CONFIRMED"].includes(normalized)) {
      return "accepted";
    }
    if (["PENDING", "REQUESTED", "WAITING", "INVITED"].includes(normalized)) {
      return "pending";
    }
    if (!normalized || ["DECLINED", "REJECTED", "REMOVED"].includes(normalized)) {
      return "not_requested";
    }
  }
  return "not_requested";
};

export const getComparableCoachIds = (entry?: PlayerCoachRoster | null) => {
  if (!entry) {
    return [];
  }
  return [entry.coach_id, entry.id, entry.user_id].map((value) =>
    typeof value === "number" ? value : value ? Number(value) : undefined,
  );
};

export const useCoachRoster = (coachId?: number, token?: string) => {
  const [rosterStatus, setRosterStatus] = useState<CoachRosterStatus>("unknown");
  const [rosterLoading, setRosterLoading] = useState(false);
  const [rosterError, setRosterError] = useState<string | null>(null);
  const [rosterEntry, setRosterEntry] = useState<PlayerCoachRoster | null>(null);
  const [requestingJoin, setRequestingJoin] = useState(false);
  const [requestJoinError, setRequestJoinError] = useState<string | null>(null);
  const [requestJoinSuccess, setRequestJoinSuccess] = useState(false);

  const refreshRoster = useCallback(async () => {
    if (!coachId) {
      setRosterStatus("unknown");
      setRosterEntry(null);
      setRosterError(null);
      return;
    }
    if (!token) {
      setRosterStatus("not_requested");
      setRosterEntry(null);
      setRosterError(null);
      return;
    }
    setRosterLoading(true);
    setRosterError(null);
    try {
      const coaches = await fetchPlayerCoaches({
        token,
        perPage: 100,
        page: 1,
      });
      const normalizedCoachId = Number(coachId);
      const match =
        coaches.find((entry) => getComparableCoachIds(entry).some((value) => value === normalizedCoachId)) ?? null;
      setRosterEntry(match);
      setRosterStatus(normalizeStatus(match));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load your coach list.";
      setRosterError(message);
      setRosterStatus("unknown");
      setRosterEntry(null);
    } finally {
      setRosterLoading(false);
    }
  }, [coachId, token]);

  useEffect(() => {
    setRequestJoinError(null);
    setRequestJoinSuccess(false);
    refreshRoster();
  }, [refreshRoster]);

  const requestJoin = useCallback(async () => {
    if (!coachId) {
      setRequestJoinError("Select a coach first.");
      return;
    }
    if (!token) {
      setRequestJoinError("Sign in to request this coach.");
      return;
    }
    setRequestingJoin(true);
    setRequestJoinError(null);
    setRequestJoinSuccess(false);
    try {
      await requestCoachPlayer({
        token,
        coachId,
        status: "PENDING",
      });
      setRequestJoinSuccess(true);
      setRosterStatus("pending");
      await refreshRoster();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to submit your coach request.";
      setRequestJoinError(message);
    } finally {
      setRequestingJoin(false);
    }
  }, [coachId, token, refreshRoster]);

  const currentEntry = useMemo(() => rosterEntry, [rosterEntry]);

  return {
    rosterStatus,
    rosterLoading,
    rosterError,
    rosterEntry: currentEntry,
    requestJoin,
    requestingJoin,
    requestJoinError,
    requestJoinSuccess,
    refreshRoster,
  };
};
