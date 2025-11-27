import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Activity,
  Calendar,
  Copy,
  Link,
  MapPin,
  MessageCircle,
  ShieldAlert,
  Star,
  Users,
} from "lucide-react";

import {
  getMatchById,
  getMatchShareLink,
  joinMatch,
  leaveMatch,
  normalizeMatchDetail,
  removeMatchParticipant,
  sendMatchInvites,
  type NormalizedMatch,
  updateMatch,
} from "../api/matches";
import MainLayout from "../components/MainLayout";
import { useAuth } from "../context/AuthContext";
import { getStoredAuthToken } from "../services/authToken";

import "./MatchDetailsPage.css";

type Participant = {
  id?: string;
  name?: string;
  contact?: string;
  status?: string;
  hosting?: boolean;
  isCurrentUser?: boolean;
};

type ParticipantGroups = {
  accepted: Participant[];
  waiting: Participant[];
  declined: Participant[];
  everyone: Participant[];
  hasStatuses: boolean;
};

type StatusBanner = {
  tone: "success" | "error" | "info";
  message: string;
};

const pickString = (...values: Array<unknown>): string | undefined => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
};

const pickBoolean = (...values: Array<unknown>): boolean => {
  for (const value of values) {
    if (value === true) return true;
    if (value === false) return false;
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (["true", "1", "yes"].includes(normalized)) return true;
      if (["false", "0", "no"].includes(normalized)) return false;
    }
  }
  return false;
};

const pickNumber = (...values: Array<unknown>): number | undefined => {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
      const parsed = Number.parseFloat(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return undefined;
};

const deriveShareLink = (record?: Record<string, unknown> | null) =>
  pickString(
    record?.share_link,
    record?.shareLink,
    record?.share_url,
    record?.shareUrl,
    record?.url,
  );

const toInputDate = (value?: string) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
};

const toInputTime = (value?: string) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(11, 16);
};

const mergeDateAndTime = (date: string, time: string): string | undefined => {
  if (!date) return undefined;
  if (!time) return new Date(date).toISOString();
  const iso = new Date(`${date}T${time}`).toISOString();
  if (!iso || iso === "Invalid Date") return undefined;
  return iso;
};

const normalizeParticipants = (record?: Record<string, unknown> | null): ParticipantGroups => {
  const source =
    (Array.isArray(record?.participants) && record?.participants) ||
    (Array.isArray(record?.invitees) && record?.invitees) ||
    (Array.isArray(record?.roster) && record?.roster) ||
    [];

  const everyone: Participant[] = source
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const data = entry as Record<string, unknown>;
      const profile = data.profile as Record<string, unknown> | undefined;
      const status = pickString(
        data.status,
        data.response,
        data.rsvp_status,
        data.rsvpStatus,
        data.invite_status,
        data.inviteStatus,
      );
      const contact = pickString(
        data.phone,
        data.phone_number,
        data.phoneNumber,
        data.contact,
        data.email,
        profile?.phone,
        profile?.email,
      );
      const id = pickString(
        data.id,
        data.identity_id,
        data.user_id,
        data.player_id,
        profile?.id,
      );
      const name = pickString(
        data.name,
        data.full_name,
        data.fullName,
        data.display_name,
        data.displayName,
        data.player_name,
        profile?.name,
        profile?.full_name,
        profile?.display_name,
      );
      return {
        id: id ?? undefined,
        name: name ?? "Unknown player",
        contact: contact ?? undefined,
        status: status ?? undefined,
        hosting: pickBoolean(data.hosting, data.is_host, data.isHost),
        isCurrentUser: pickBoolean(data.is_current_user, data.isCurrentUser),
      } as Participant;
    })
    .filter(Boolean) as Participant[];

  const accepted: Participant[] = [];
  const waiting: Participant[] = [];
  const declined: Participant[] = [];

  const mapStatus = (value?: string) => value?.trim().toLowerCase();

  everyone.forEach((participant) => {
    const normalizedStatus = mapStatus(participant.status);
    if (!normalizedStatus) return waiting.push(participant);
    if (["accepted", "yes", "confirmed", "joined"].some((flag) => normalizedStatus.includes(flag))) {
      accepted.push(participant);
      return;
    }
    if (["declined", "no", "rejected", "cancelled"].some((flag) => normalizedStatus.includes(flag))) {
      declined.push(participant);
      return;
    }
    waiting.push(participant);
  });

  const hasStatuses = accepted.length > 0 || declined.length > 0 || waiting.some((p) => Boolean(p.status));

  return { accepted, waiting, declined, everyone, hasStatuses };
};

const buildFormStateFromMatch = (
  match: NormalizedMatch | null,
  record: Record<string, unknown> | null,
): {
  date: string;
  time: string;
  location: string;
  matchFormat: string;
  skillLevel: string;
  playerLimit: string;
  notes: string;
} => {
  const startIso =
    match?.startDateTimeIso ||
    pickString(record?.start_date_time as string, record?.startDateTime as string, record?.start_at as string);

  const locationText =
    match?.location ||
    pickString(
      record?.location_text as string,
      record?.locationText as string,
      record?.location as string,
      record?.location_name as string,
    ) ||
    "";

  const matchFormat =
    match?.format ||
    pickString(record?.match_format as string, record?.matchFormat as string, record?.format as string) ||
    "";

  const skillLevel =
    match?.level?.summary ||
    pickString(record?.skill_level as string, record?.skillLevel as string, record?.level as string) ||
    "";

  const playerLimit =
    pickNumber(
      match?.totalSpots,
      record?.player_limit,
      record?.playerLimit,
      record?.player_cap,
      record?.max_players,
    );

  const notes = pickString(record?.notes as string, record?.description as string) || "";

  return {
    date: toInputDate(startIso),
    time: toInputTime(startIso),
    location: locationText,
    matchFormat,
    skillLevel,
    playerLimit: playerLimit !== undefined ? String(playerLimit) : "",
    notes,
  };
};

const MatchDetailsPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useAuth() as { user?: unknown };

  const [match, setMatch] = useState<NormalizedMatch | null>(null);
  const [matchRecord, setMatchRecord] = useState<Record<string, unknown> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshIndex, setRefreshIndex] = useState(0);
  const [statusBanner, setStatusBanner] = useState<StatusBanner | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formState, setFormState] = useState(() =>
    buildFormStateFromMatch(null, {
      location: "",
    }),
  );
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [shareLink, setShareLink] = useState<string | undefined>(undefined);
  const [isShareLoading, setIsShareLoading] = useState(false);
  const [inviteForm, setInviteForm] = useState({ playerIds: "", phoneNumbers: "" });

  const statusLabel = pickString(
    matchRecord?.status as string,
    matchRecord?.match_status as string,
    matchRecord?.state as string,
  );
  const isCancelled =
    pickBoolean(matchRecord?.cancelled, matchRecord?.is_cancelled, matchRecord?.isCancelled) ||
    statusLabel?.toLowerCase?.().includes("cancel") === true;
  const isArchived =
    pickBoolean(matchRecord?.archived, matchRecord?.is_archived, matchRecord?.hidden) ||
    statusLabel?.toLowerCase?.().includes("archive") === true;

  const participantGroups = useMemo(() => normalizeParticipants(matchRecord), [matchRecord]);

  const canEdit = match?.relationship === "host" && !isArchived && !isCancelled;
  const isParticipant = match?.relationship === "participant";
  const isHost = match?.relationship === "host";
  const isOpenMatch = (match?.access || "").toLowerCase() === "open";

  const loadMatch = async (signal: AbortSignal) => {
    if (!id) return;
    setIsLoading(true);
    setError(null);

    try {
      const token = getStoredAuthToken({ preferScheme: "Token" });
      const includeHidden = Boolean(token);
      const response = await getMatchById(id, {
        token: token ?? undefined,
        signal,
        includeHidden,
      });
      const normalized = normalizeMatchDetail(response, { currentUser: user });
      setMatch(normalized);
      setMatchRecord(response as Record<string, unknown>);
      setShareLink(deriveShareLink(response as Record<string, unknown>));
      setFormState(buildFormStateFromMatch(normalized, response as Record<string, unknown>));
    } catch (loadError) {
      if (signal.aborted) return;
      console.error("Failed to load match details", loadError);
      setError(loadError instanceof Error ? loadError.message : "Not found or access denied.");
    } finally {
      if (!signal.aborted) {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    loadMatch(controller.signal);
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user, refreshIndex]);

  const handleRetry = () => setRefreshIndex((value) => value + 1);

  const handlePrimaryAction = () => {
    if (!match) return;
    navigate(`/matches/${match.id}`);
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!formState.date) errors.date = "Date is required";
    if (!formState.time) errors.time = "Start time is required";
    if (!formState.location.trim()) errors.location = "Location is required";
    if (formState.playerLimit) {
      const parsed = Number.parseInt(formState.playerLimit, 10);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        errors.playerLimit = "Player limit must be a positive number";
      }
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!id) return;
    if (!validateForm()) return;
    const token = getStoredAuthToken({ preferScheme: "Token" });
    if (!token) {
      setStatusBanner({ tone: "error", message: "Please sign in to update this match." });
      return;
    }

    try {
      const startDateTime = mergeDateAndTime(formState.date, formState.time);
      await updateMatch(id, {
        startDateTime,
        locationText: formState.location,
        matchFormat: formState.matchFormat || null,
        skillLevel: isOpenMatch ? formState.skillLevel || null : null,
        playerLimit: formState.playerLimit ? Number(formState.playerLimit) : null,
        notes: formState.notes || null,
      }, {
        token,
      });
      setStatusBanner({ tone: "success", message: "Match updated successfully." });
      setIsEditing(false);
      setRefreshIndex((value) => value + 1);
    } catch (updateError) {
      console.error(updateError);
      setStatusBanner({
        tone: "error",
        message:
          (updateError as Error | undefined)?.message ?? "Unable to save changes. Please try again.",
      });
    }
  };

  const handleJoin = async () => {
    if (!id) return;
    const token = getStoredAuthToken({ preferScheme: "Token" });
    if (!token) {
      setStatusBanner({ tone: "error", message: "Please sign in to join this match." });
      return;
    }
    try {
      await joinMatch(id, { token });
      setStatusBanner({ tone: "success", message: "You have joined this match." });
      setRefreshIndex((value) => value + 1);
    } catch (joinError) {
      console.error(joinError);
      setStatusBanner({ tone: "error", message: (joinError as Error | undefined)?.message ?? "Unable to join." });
    }
  };

  const handleLeave = async () => {
    if (!id) return;
    const token = getStoredAuthToken({ preferScheme: "Token" });
    if (!token) {
      setStatusBanner({ tone: "error", message: "Please sign in to leave this match." });
      return;
    }
    try {
      await leaveMatch(id, { token });
      setStatusBanner({ tone: "info", message: "You left this match." });
      setRefreshIndex((value) => value + 1);
    } catch (leaveError) {
      console.error(leaveError);
      setStatusBanner({ tone: "error", message: (leaveError as Error | undefined)?.message ?? "Unable to leave." });
    }
  };

  const handleRemoveParticipant = async (participantId?: string) => {
    if (!participantId || !id) return;
    const token = getStoredAuthToken({ preferScheme: "Token" });
    if (!token) {
      setStatusBanner({ tone: "error", message: "Please sign in to manage participants." });
      return;
    }
    try {
      await removeMatchParticipant(id, participantId, { token });
      setStatusBanner({ tone: "info", message: "Participant removed." });
      setRefreshIndex((value) => value + 1);
    } catch (removeError) {
      console.error(removeError);
      setStatusBanner({
        tone: "error",
        message: (removeError as Error | undefined)?.message ?? "Unable to remove participant.",
      });
    }
  };

  const handleSendInvites = async () => {
    if (!id) return;
    const token = getStoredAuthToken({ preferScheme: "Token" });
    if (!token) {
      setStatusBanner({ tone: "error", message: "Please sign in to send invites." });
      return;
    }

    const playerIds = inviteForm.playerIds
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    const phoneNumbers = inviteForm.phoneNumbers
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

    try {
      await sendMatchInvites(
        id,
        {
          playerIds,
          phoneNumbers,
        },
        { token },
      );
      setStatusBanner({ tone: "success", message: "Invites sent." });
      setInviteForm({ playerIds: "", phoneNumbers: "" });
      setRefreshIndex((value) => value + 1);
    } catch (inviteError) {
      console.error(inviteError);
      setStatusBanner({
        tone: "error",
        message: (inviteError as Error | undefined)?.message ?? "Unable to send invites.",
      });
    }
  };

  const handleGenerateShareLink = async () => {
    if (!id) return;
    const token = getStoredAuthToken({ preferScheme: "Token" });
    if (!token) {
      setStatusBanner({ tone: "error", message: "Please sign in to generate a share link." });
      return;
    }
    try {
      setIsShareLoading(true);
      const response = await getMatchShareLink(id, { token });
      if (response.shareLink) setShareLink(response.shareLink);
      setStatusBanner({ tone: "success", message: "Share link ready." });
    } catch (shareError) {
      console.error(shareError);
      setStatusBanner({ tone: "error", message: (shareError as Error | undefined)?.message ?? "Unable to fetch link." });
    } finally {
      setIsShareLoading(false);
    }
  };

  const handleCopyShareLink = () => {
    if (!shareLink) return;
    navigator.clipboard.writeText(shareLink).catch(() => {
      /* ignore */
    });
    setStatusBanner({ tone: "info", message: "Link copied to clipboard." });
  };

  const detailItems = [
    {
      icon: <Calendar size={18} aria-hidden="true" />,
      title: match?.startDisplay || "Date & time to be announced",
      subtitle: match?.startDateTimeIso,
    },
    {
      icon: <MapPin size={18} aria-hidden="true" />,
      title: match?.location || "Location to be announced",
      subtitle: match?.locationDetail,
    },
    {
      icon: <Users size={18} aria-hidden="true" />,
      title:
        match?.playersJoined !== undefined && match?.totalSpots !== undefined
          ? `${match.playersJoined}/${match.totalSpots} players`
          : undefined,
      subtitle:
        match?.playersNeeded !== undefined
          ? `${match.playersNeeded} spot${match.playersNeeded === 1 ? "" : "s"} available`
          : undefined,
    },
    match?.level
      ? {
          icon: <Star size={18} aria-hidden="true" />,
          title: `Skill level: ${match.level.summary}`,
          subtitle: match.level.detail,
        }
      : null,
    match?.format
      ? {
          icon: <Activity size={18} aria-hidden="true" />,
          title: `Match format: ${match.format}`,
        }
      : null,
  ].filter(Boolean) as Array<{ icon: JSX.Element; title?: string; subtitle?: string }>;

  return (
    <MainLayout>
      <div className="match-details-page">
        <header className="match-details-header">
          <div>
            <p className="match-details-kicker">Match Details</p>
            <h1 className="match-details-title">{match?.location || "Match"}</h1>
            <p className="match-details-meta">Hosted by {match?.hostName || "Unknown host"}</p>
            <div className="match-details-badges" aria-live="polite">
              {isCancelled ? <span className="match-badge match-badge--warning">Cancelled</span> : null}
              {isArchived ? <span className="match-badge match-badge--neutral">Archived</span> : null}
              {match?.visibilityLabel ? (
                <span className="match-badge match-badge--outline">{match.visibilityLabel}</span>
              ) : null}
            </div>
          </div>
          <div className="match-details-header__actions">
            {!isHost && !isParticipant ? (
              <button type="button" className="match-action" onClick={handleJoin} disabled={isCancelled || isArchived}>
                Join match
              </button>
            ) : null}
            {isParticipant && !isHost ? (
              <button type="button" className="match-action match-action--secondary" onClick={handleLeave}>
                Leave match
              </button>
            ) : null}
          </div>
        </header>

        {statusBanner ? (
          <div className={`match-feedback match-feedback--${statusBanner.tone}`} role="status">
            {statusBanner.message}
          </div>
        ) : null}

        {isLoading ? (
          <div className="match-details-state" role="status">
            Loading…
          </div>
        ) : error ? (
          <div className="match-details-state match-details-state--error" role="alert">
            <p className="match-details-state__title">Not found or access denied.</p>
            <p className="match-details-state__detail">{error}</p>
            <button type="button" className="match-details-state__button" onClick={handleRetry}>
              Try again
            </button>
          </div>
        ) : match ? (
          <article className="match-details-card">
            <header className="match-details-card__header">
              <div className="match-details-card__pills" aria-label="Match context">
                <span className="match-details-pill match-details-pill--success">{match.access}</span>
                {match.relationship === "host" ? (
                  <span className="match-details-pill match-details-pill--info">Hosting</span>
                ) : null}
                {match.relationship === "participant" ? (
                  <span className="match-details-pill match-details-pill--info">Joined</span>
                ) : null}
              </div>
              <div className="match-details-card__header-row">
                <h2 className="section-title">Essentials</h2>
                {canEdit ? (
                  <button
                    type="button"
                    className="match-action match-action--ghost"
                    onClick={() => setIsEditing((value) => !value)}
                  >
                    {isEditing ? "Close editor" : "Edit"}
                  </button>
                ) : null}
              </div>
              <p className="section-helper">
                View or update the core details for this match. Edits are disabled for cancelled or archived matches.
              </p>
            </header>

            <div className="match-details-card__body">
              {isEditing ? (
                <div className="match-edit-grid" role="form" aria-label="Edit match">
                  <label className="match-field">
                    <span className="match-field__label">Date</span>
                    <input
                      type="date"
                      value={formState.date}
                      onChange={(event) => setFormState((state) => ({ ...state, date: event.target.value }))}
                      disabled={isCancelled || isArchived}
                    />
                    {formErrors.date ? <span className="match-field__error">{formErrors.date}</span> : null}
                  </label>
                  <label className="match-field">
                    <span className="match-field__label">Time</span>
                    <input
                      type="time"
                      value={formState.time}
                      onChange={(event) => setFormState((state) => ({ ...state, time: event.target.value }))}
                      disabled={isCancelled || isArchived}
                    />
                    {formErrors.time ? <span className="match-field__error">{formErrors.time}</span> : null}
                  </label>
                  <label className="match-field match-field--wide">
                    <span className="match-field__label">Location</span>
                    <input
                      type="text"
                      placeholder="Court name or address"
                      value={formState.location}
                      onChange={(event) => setFormState((state) => ({ ...state, location: event.target.value }))}
                      disabled={isCancelled || isArchived}
                    />
                    <span className="match-field__helper">Use the court name or street address. Autocomplete is supported when available.</span>
                    {formErrors.location ? (
                      <span className="match-field__error">{formErrors.location}</span>
                    ) : null}
                  </label>
                  <label className="match-field">
                    <span className="match-field__label">Match format</span>
                    <select
                      value={formState.matchFormat}
                      onChange={(event) => setFormState((state) => ({ ...state, matchFormat: event.target.value }))}
                      disabled={isCancelled || isArchived}
                    >
                      <option value="">Select format</option>
                      <option value="Singles">Singles</option>
                      <option value="Doubles">Doubles</option>
                      <option value="Mixed Doubles">Mixed Doubles</option>
                      <option value="King/Queen of the Court">King/Queen of the Court</option>
                    </select>
                  </label>
                  {isOpenMatch ? (
                    <label className="match-field">
                      <span className="match-field__label">Skill level</span>
                      <input
                        type="text"
                        value={formState.skillLevel}
                        onChange={(event) => setFormState((state) => ({ ...state, skillLevel: event.target.value }))}
                        placeholder="3.0-3.5"
                        disabled={isCancelled || isArchived}
                      />
                    </label>
                  ) : null}
                  <label className="match-field">
                    <span className="match-field__label">Player limit</span>
                    <input
                      type="number"
                      min={1}
                      value={formState.playerLimit}
                      onChange={(event) => setFormState((state) => ({ ...state, playerLimit: event.target.value }))}
                      disabled={isCancelled || isArchived}
                    />
                    <span className="match-field__helper">Leave blank for unlimited roster size.</span>
                    {formErrors.playerLimit ? (
                      <span className="match-field__error">{formErrors.playerLimit}</span>
                    ) : null}
                  </label>
                  <label className="match-field match-field--wide">
                    <span className="match-field__label">Notes</span>
                    <textarea
                      rows={3}
                      value={formState.notes}
                      onChange={(event) => setFormState((state) => ({ ...state, notes: event.target.value }))}
                      disabled={isCancelled || isArchived}
                    />
                  </label>
                  <div className="match-edit-actions">
                    <button type="button" className="match-action" onClick={handleSave} disabled={isCancelled || isArchived}>
                      Save changes
                    </button>
                    <button
                      type="button"
                      className="match-action match-action--secondary"
                      onClick={() => {
                        setIsEditing(false);
                        setFormState(buildFormStateFromMatch(match, matchRecord));
                        setFormErrors({});
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="match-summary">
                  <dl>
                    <div className="match-summary__item">
                      <dt>Date &amp; time</dt>
                      <dd>{match?.startDisplay || "TBD"}</dd>
                    </div>
                    <div className="match-summary__item">
                      <dt>Location</dt>
                      <dd>{formState.location || "TBD"}</dd>
                    </div>
                    <div className="match-summary__item">
                      <dt>Match format</dt>
                      <dd>{formState.matchFormat || "Not set"}</dd>
                    </div>
                    {isOpenMatch ? (
                      <div className="match-summary__item">
                        <dt>Skill level</dt>
                        <dd>{formState.skillLevel || "Not specified"}</dd>
                      </div>
                    ) : null}
                    <div className="match-summary__item">
                      <dt>Player limit</dt>
                      <dd>{formState.playerLimit || "Unlimited"}</dd>
                    </div>
                    <div className="match-summary__item match-summary__item--wide">
                      <dt>Notes</dt>
                      <dd>{formState.notes || "No notes shared."}</dd>
                    </div>
                  </dl>
                </div>
              )}
            </div>

            <section className="match-details-section">
              <div className="section-heading">
                <h3 className="section-title">Participants</h3>
                <p className="section-helper">{participantGroups.everyone.length} total</p>
              </div>
              {participantGroups.hasStatuses ? (
                <div className="participant-columns">
                  <div>
                    <h4 className="participant-title">Accepted</h4>
                    <ul className="participant-list">
                      {participantGroups.accepted.map((participant) => (
                        <li key={`${participant.id}-${participant.name}`} className="participant-row">
                          <div>
                            <p className="participant-name">{participant.name}</p>
                            <p className="participant-meta">{participant.contact || participant.status || "Accepted"}</p>
                          </div>
                          {isHost ? (
                            <button
                              type="button"
                              className="pill-button"
                              onClick={() => handleRemoveParticipant(participant.id)}
                            >
                              Remove
                            </button>
                          ) : null}
                        </li>
                      ))}
                      {participantGroups.accepted.length === 0 ? (
                        <li className="participant-empty">No accepted players yet.</li>
                      ) : null}
                    </ul>
                  </div>
                  <div>
                    <h4 className="participant-title">Waiting on responses</h4>
                    <ul className="participant-list">
                      {participantGroups.waiting.map((participant) => (
                        <li key={`${participant.id}-${participant.name}`} className="participant-row">
                          <div>
                            <p className="participant-name">{participant.name}</p>
                            <p className="participant-meta">{participant.contact || participant.status || "Invited"}</p>
                          </div>
                          {isHost ? (
                            <button
                              type="button"
                              className="pill-button"
                              onClick={() => handleRemoveParticipant(participant.id)}
                            >
                              Remove
                            </button>
                          ) : null}
                        </li>
                      ))}
                      {participantGroups.waiting.length === 0 ? (
                        <li className="participant-empty">No pending invitations.</li>
                      ) : null}
                    </ul>
                  </div>
                  <div>
                    <h4 className="participant-title">Declined</h4>
                    <ul className="participant-list">
                      {participantGroups.declined.map((participant) => (
                        <li key={`${participant.id}-${participant.name}`} className="participant-row">
                          <div>
                            <p className="participant-name">{participant.name}</p>
                            <p className="participant-meta">{participant.contact || participant.status || "Declined"}</p>
                          </div>
                          {isHost ? (
                            <button
                              type="button"
                              className="pill-button"
                              onClick={() => handleRemoveParticipant(participant.id)}
                            >
                              Remove
                            </button>
                          ) : null}
                        </li>
                      ))}
                      {participantGroups.declined.length === 0 ? (
                        <li className="participant-empty">No declines.</li>
                      ) : null}
                    </ul>
                  </div>
                </div>
              ) : (
                <ul className="participant-list participant-list--single">
                  {participantGroups.everyone.map((participant) => (
                    <li key={`${participant.id}-${participant.name}`} className="participant-row">
                      <div>
                        <p className="participant-name">{participant.name}</p>
                        <p className="participant-meta">{participant.contact || "Joined"}</p>
                      </div>
                      {participant.hosting ? <span className="match-badge match-badge--outline">Host</span> : null}
                      {isHost ? (
                        <button
                          type="button"
                          className="pill-button"
                          onClick={() => handleRemoveParticipant(participant.id)}
                        >
                          Remove
                        </button>
                      ) : null}
                    </li>
                  ))}
                  {participantGroups.everyone.length === 0 ? (
                    <li className="participant-empty">No participants yet.</li>
                  ) : null}
                </ul>
              )}
            </section>

            <section className="match-details-section">
              <div className="section-heading">
                <h3 className="section-title">Host tools</h3>
                <p className="section-helper">Keep the roster organized and share with players.</p>
              </div>
              <div className="host-tools">
                {isOpenMatch ? (
                  <div className="host-tile">
                    <div className="host-tile__header">
                      <div>
                        <p className="tile-eyebrow">Open match</p>
                        <h4>Share this match</h4>
                        <p className="tile-helper">Send the public link to players.</p>
                      </div>
                      <button
                        type="button"
                        className="pill-button"
                        onClick={handleGenerateShareLink}
                        disabled={isShareLoading}
                      >
                        {isShareLoading ? "Loading…" : "Generate link"}
                      </button>
                    </div>
                    <div className="share-row">
                      <div className="share-chip">
                        <Link size={16} aria-hidden="true" />
                        <span>{shareLink || "Link not generated yet"}</span>
                      </div>
                      <button
                        type="button"
                        className="pill-button"
                        onClick={handleCopyShareLink}
                        disabled={!shareLink}
                      >
                        <Copy size={14} aria-hidden="true" /> Copy
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="host-tile">
                    <div className="host-tile__header">
                      <div>
                        <p className="tile-eyebrow">Invite-only</p>
                        <h4>Invite players</h4>
                        <p className="tile-helper">Share invites directly via player IDs or phone numbers.</p>
                      </div>
                    </div>
                    <div className="invite-form">
                      <label className="match-field match-field--wide">
                        <span className="match-field__label">Player IDs</span>
                        <input
                          type="text"
                          value={inviteForm.playerIds}
                          onChange={(event) => setInviteForm((state) => ({ ...state, playerIds: event.target.value }))}
                          placeholder="Comma separated IDs"
                        />
                      </label>
                      <label className="match-field match-field--wide">
                        <span className="match-field__label">Phone numbers</span>
                        <input
                          type="text"
                          value={inviteForm.phoneNumbers}
                          onChange={(event) => setInviteForm((state) => ({ ...state, phoneNumbers: event.target.value }))}
                          placeholder="Comma separated numbers"
                        />
                      </label>
                      <button type="button" className="match-action" onClick={handleSendInvites}>
                        Send invites
                      </button>
                    </div>
                  </div>
                )}

                <div className="host-tile host-tile--muted">
                  <div className="host-tile__header">
                    <div>
                      <p className="tile-eyebrow">Status</p>
                      <h4>{isCancelled ? "Cancelled" : isArchived ? "Archived" : "Active"}</h4>
                      <p className="tile-helper">Badges appear on cancelled or archived matches.</p>
                    </div>
                    {(isCancelled || isArchived) && <ShieldAlert size={18} aria-hidden="true" />}
                  </div>
                  <div className="match-details-card__list">
                    {detailItems.map((item) => (
                      <div key={item.title} className="match-details-card__item">
                        <div className="match-details-card__icon">{item.icon}</div>
                        <div className="match-details-card__text">
                          <p className="match-details-card__primary">{item.title}</p>
                          {item.subtitle ? <p className="match-details-card__secondary">{item.subtitle}</p> : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <footer className="match-details-card__footer">
              <div className="match-details-card__actions" aria-label="Actions">
                <button type="button" className="match-details-card__button" onClick={handlePrimaryAction}>
                  View &amp; manage
                </button>
                <button type="button" className="match-details-card__button match-details-card__button--secondary">
                  <MessageCircle size={16} aria-hidden="true" />
                  Message group
                </button>
              </div>
            </footer>
          </article>
        ) : (
          <div className="match-details-state" role="status">
            Match unavailable.
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default MatchDetailsPage;
