import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Activity,
  BadgeInfo,
  Calendar,
  Copy,
  MapPin,
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
  updateMatch,
  type NormalizedMatch,
} from "../api/matches";
import MainLayout from "../components/MainLayout";
import { useAuth } from "../context/AuthContext";
import { getStoredAuthToken } from "../services/authToken";

import "./MatchDetailsPage.css";

type BannerState = { type: "success" | "error"; message: string } | null;

type Invitation = {
  id?: string;
  name?: string;
  contact?: string;
  status?: string;
};

const formatDateInput = (value?: string) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
};

const formatTimeInput = (value?: string) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(11, 16);
};

const normalizeInvitation = (record: unknown): Invitation | null => {
  if (!record || typeof record !== "object") return null;
  const data = record as Record<string, unknown>;
  const profile = (data.profile as Record<string, unknown> | undefined) ?? undefined;

  const name = [
    data.name,
    data.full_name,
    data.fullName,
    data.display_name,
    data.displayName,
    data.player_name,
    profile?.name,
    profile?.full_name,
    profile?.display_name,
  ].find((value) => typeof value === "string" && value.trim()) as string | undefined;

  const contactCandidate = [
    data.phone,
    data.phone_number,
    data.phoneNumber,
    data.email,
    profile?.phone,
    profile?.phone_number,
    profile?.phoneNumber,
    profile?.email,
  ].find((value) => typeof value === "string" && value.trim()) as string | undefined;

  const status = [data.status, data.invitation_status, data.response_status]
    .map((value) => (typeof value === "string" ? value.toLowerCase() : ""))
    .find((value) => value);

  const id = [
    data.id,
    data.uuid,
    data.identity_id,
    data.profile_id,
    data.player_id,
    data.user_id,
  ]
    .map((value) => (value === undefined || value === null ? undefined : String(value)))
    .find(Boolean);

  if (!id && !name && !contactCandidate) return null;

  return {
    id,
    name,
    contact: contactCandidate,
    status,
  };
};

const splitInvitations = (records?: Invitation[]) => {
  if (!records || records.length === 0) {
    return { hasStatuses: false, accepted: [], waiting: [], declined: [] } as {
      hasStatuses: boolean;
      accepted: Invitation[];
      waiting: Invitation[];
      declined: Invitation[];
    };
  }

  const accepted: Invitation[] = [];
  const waiting: Invitation[] = [];
  const declined: Invitation[] = [];

  records.forEach((invite) => {
    const status = invite.status ?? "";
    if (!status) {
      waiting.push(invite);
      return;
    }
    if (["accepted", "joined", "yes"].includes(status)) {
      accepted.push(invite);
      return;
    }
    if (["declined", "rejected", "no"].includes(status)) {
      declined.push(invite);
      return;
    }
    waiting.push(invite);
  });

  const hasStatuses = accepted.length + declined.length > 0;
  return { hasStatuses, accepted, waiting, declined };
};

const MatchDetailsPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useAuth() as { user?: unknown };
  const [match, setMatch] = useState<NormalizedMatch | null>(null);
  const [rawMatch, setRawMatch] = useState<Record<string, unknown> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshIndex, setRefreshIndex] = useState(0);
  const [banner, setBanner] = useState<BannerState>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [shareLink, setShareLink] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [joining, setJoining] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [sendingInvites, setSendingInvites] = useState(false);
  const [formState, setFormState] = useState({
    date: "",
    time: "",
    location: "",
    matchFormat: "",
    skillLevel: "",
    playerLimit: "",
    notes: "",
  });
  const [inviteInputs, setInviteInputs] = useState({ players: "", phones: "" });

  const token = useMemo(() => getStoredAuthToken({ preferScheme: "Bearer" }), []);

  const loadMatch = useMemo(() => {
    return async (signal: AbortSignal) => {
      if (!id) return;
      setIsLoading(true);
      setError(null);

      try {
        const response = await getMatchById(id, {
          token: token ?? undefined,
          signal,
          includeHidden: true,
        });
        const normalized = normalizeMatchDetail(response, { currentUser: user });
        const raw = (response as Record<string, unknown>)?.match ?? (response as Record<string, unknown>);
        setRawMatch(raw as Record<string, unknown>);
        setMatch(normalized);
        setShareLink((raw as Record<string, unknown>)?.share_link as string);
        setBanner(null);
      } catch (loadError) {
        if (signal.aborted) return;
        console.error("Failed to load match details", loadError);
        setError(loadError instanceof Error ? loadError.message : "Unable to load match details.");
      } finally {
        if (!signal.aborted) {
          setIsLoading(false);
        }
      }
    };
  }, [id, token, user]);

  useEffect(() => {
    const controller = new AbortController();
    loadMatch(controller.signal);
    return () => controller.abort();
  }, [loadMatch, refreshIndex]);

  useEffect(() => {
    if (!match) return;
    setFormState({
      date: formatDateInput(match.startDateTimeIso),
      time: formatTimeInput(match.startDateTimeIso),
      location: (rawMatch?.location_text as string) || match.location || "",
      matchFormat: (rawMatch?.match_format as string) || match.format || "",
      skillLevel: (rawMatch?.skill_level_min as string) || (rawMatch?.skillLevel as string) || "",
      playerLimit:
        (rawMatch?.player_limit as string | number) !== undefined
          ? String(rawMatch?.player_limit ?? "")
          : match.totalSpots
            ? String(match.totalSpots)
            : "",
      notes: (rawMatch?.notes as string) || "",
    });
  }, [match, rawMatch]);

  const playersJoined = match?.playersJoined ?? 0;
  const totalSpots = match?.totalSpots ?? playersJoined;
  const spotsAvailable = Math.max((match?.playersNeeded ?? 0) || totalSpots - playersJoined, 0);
  const playersLabel = totalSpots ? `${playersJoined}/${totalSpots} players` : `${playersJoined} players`;
  const availabilityLabel =
    totalSpots > 0
      ? spotsAvailable === 0
        ? "Match is full"
        : `${spotsAvailable} spot${spotsAvailable === 1 ? "" : "s"} available`
      : "Spots available";

  const handleRetry = () => setRefreshIndex((value) => value + 1);

  const pills = useMemo(() => {
    if (!match) return [] as Array<{ label: string; tone: "success" | "warning" | "info" }>;
    const values: Array<{ label: string; tone: "success" | "warning" | "info" }> = [];
    values.push({ label: match.access, tone: "success" });
    const isInviteOnlyVisibility =
      match.visibility === "private" || match.visibilityLabel?.toLowerCase() === "invite only";
    if (match.visibilityLabel && match.visibilityLabel !== "Open" && !isInviteOnlyVisibility) {
      values.push({ label: match.visibilityLabel, tone: "warning" });
    }
    if (match.relationship === "host") values.push({ label: "Hosting", tone: "info" });
    if (match.relationship === "participant") values.push({ label: "Joined", tone: "info" });
    return values;
  }, [match]);

  const invitations = useMemo(() => {
    const invitesArray = [
      (rawMatch?.invites as unknown[] | undefined),
      (rawMatch?.invitations as unknown[] | undefined),
      (rawMatch?.invitees as unknown[] | undefined),
    ].find((value) => Array.isArray(value));

    const normalized = invitesArray?.map((invite) => normalizeInvitation(invite)).filter(Boolean) as Invitation[] | undefined;
    return splitInvitations(normalized);
  }, [rawMatch]);

  const isHost = match?.relationship === "host";
  const isOpenMatch = match?.access === "Open";
  const isArchived = rawMatch?.archived === true || rawMatch?.status === "archived";
  const isCancelled = rawMatch?.cancelled === true || rawMatch?.status === "cancelled";

  const detailItems = [
    {
      label: "Date & time",
      value: match?.startDisplay,
      helper: match?.startDateTimeIso,
    },
    {
      label: "Location",
      value: match?.location,
      helper: [match?.locationDetail, match?.distance].filter(Boolean).join(" · ") || undefined,
    },
    {
      label: "Match format",
      value: match?.format || "Not set",
    },
    isOpenMatch
      ? {
          label: "Skill level",
          value: match?.level?.summary || "Open level",
          helper: match?.level?.detail,
        }
      : null,
    {
      label: "Players",
      value: playersLabel,
      helper: availabilityLabel,
    },
    {
      label: "Notes",
      value: (rawMatch?.notes as string) || "No notes yet",
    },
  ].filter(Boolean) as Array<{ label: string; value?: string; helper?: string }>;

  const handleFormChange = (
    field: keyof typeof formState,
    value: string,
  ) => setFormState((prev) => ({ ...prev, [field]: value }));

  const handleSave = async () => {
    if (!match?.id || isArchived || isCancelled) return;
    setSaving(true);
    setBanner(null);
    try {
      await updateMatch(match.id, {
        startDate: formState.date,
        startTime: formState.time,
        locationText: formState.location,
        matchFormat: formState.matchFormat,
        skillLevel: isOpenMatch ? formState.skillLevel || null : null,
        playerLimit: formState.playerLimit ? Number(formState.playerLimit) : null,
        notes: formState.notes,
        token: token ?? undefined,
      });
      setBanner({ type: "success", message: "Match updated." });
      setIsEditing(false);
      setRefreshIndex((value) => value + 1);
    } catch (saveError) {
      console.error("Failed to update match", saveError);
      setBanner({ type: "error", message: saveError instanceof Error ? saveError.message : "Update failed." });
    } finally {
      setSaving(false);
    }
  };

  const handleJoin = async () => {
    if (!match?.id) return;
    setJoining(true);
    setBanner(null);
    try {
      await joinMatch(match.id, { token: token ?? undefined });
      setBanner({ type: "success", message: "You joined the match." });
      setRefreshIndex((value) => value + 1);
    } catch (joinError) {
      console.error("Failed to join", joinError);
      setBanner({ type: "error", message: joinError instanceof Error ? joinError.message : "Unable to join." });
    } finally {
      setJoining(false);
    }
  };

  const handleLeave = async () => {
    if (!match?.id) return;
    setLeaving(true);
    setBanner(null);
    try {
      await leaveMatch(match.id, { token: token ?? undefined });
      setBanner({ type: "success", message: "You left the match." });
      setRefreshIndex((value) => value + 1);
    } catch (leaveError) {
      console.error("Failed to leave", leaveError);
      setBanner({ type: "error", message: leaveError instanceof Error ? leaveError.message : "Unable to leave." });
    } finally {
      setLeaving(false);
    }
  };

  const handleRemoveParticipant = async (participantId?: string) => {
    if (!match?.id || !participantId) return;
    try {
      await removeMatchParticipant(match.id, participantId, { token: token ?? undefined });
      setBanner({ type: "success", message: "Participant removed." });
      setRefreshIndex((value) => value + 1);
    } catch (removeError) {
      console.error("Failed to remove participant", removeError);
      setBanner({ type: "error", message: removeError instanceof Error ? removeError.message : "Unable to remove." });
    }
  };

  const handleSendInvites = async () => {
    if (!match?.id) return;
    setSendingInvites(true);
    setBanner(null);
    try {
      const playerIds = inviteInputs.players
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
      const phoneNumbers = inviteInputs.phones
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
      await sendMatchInvites(match.id, { playerIds, phoneNumbers, token: token ?? undefined });
      setBanner({ type: "success", message: "Invites sent." });
      setInviteInputs({ players: "", phones: "" });
    } catch (inviteError) {
      console.error("Failed to send invites", inviteError);
      setBanner({ type: "error", message: inviteError instanceof Error ? inviteError.message : "Unable to invite." });
    } finally {
      setSendingInvites(false);
    }
  };

  const handleShareLink = async () => {
    if (!match?.id) return;
    try {
      const response = (await getMatchShareLink(match.id, { token: token ?? undefined })) as Record<string, unknown>;
      const link =
        (response?.share_link as string) ||
        (response?.shareLink as string) ||
        (response?.url as string) ||
        "";
      setShareLink(link);
      setBanner({ type: "success", message: "Share link ready." });
    } catch (shareError) {
      console.error("Failed to fetch share link", shareError);
      setBanner({ type: "error", message: shareError instanceof Error ? shareError.message : "Unable to load share link." });
    }
  };

  const handleCopyLink = async () => {
    if (!shareLink) return;
    try {
      await navigator.clipboard.writeText(shareLink);
      setBanner({ type: "success", message: "Share link copied." });
    } catch {
      setBanner({ type: "error", message: "Could not copy link." });
    }
  };

  const handlePrimaryAction = () => {
    if (!match) return;
    navigate(`/matches/${match.id}`);
  };

  const participantGroups = invitations.hasStatuses
    ? invitations
    : {
        hasStatuses: false,
        accepted: match?.participants ?? [],
        waiting: [],
        declined: [],
      };

  const participantCount =
    (participantGroups.accepted?.length ?? 0) +
    (participantGroups.waiting?.length ?? 0) +
    (participantGroups.declined?.length ?? 0);

  return (
    <MainLayout>
      <div className="match-details-page">
        {banner ? (
          <div className={`match-banner match-banner--${banner.type}`} role={banner.type === "error" ? "alert" : "status"}>
            {banner.message}
          </div>
        ) : null}

        {isLoading ? (
          <div className="match-details-state" role="status">
            Loading…
          </div>
        ) : error ? (
          <div className="match-details-state match-details-state--error" role="alert">
            <p className="match-details-state__title">We couldn't load this match.</p>
            <p className="match-details-state__detail">{error}</p>
            <button type="button" className="match-details-state__button" onClick={handleRetry}>
              Try again
            </button>
          </div>
        ) : match ? (
          <article className="match-details-card">
            <header className="match-details-card__header">
              <div className="match-details-card__headline">
                <div>
                  <p className="match-details-card__eyebrow">Match Details</p>
                  <h1 className="match-details-card__title">{match.location || "Match"}</h1>
                  {match.hostName ? <p className="match-details-card__meta">Hosted by {match.hostName}</p> : null}
                </div>
                <div className="match-details-card__badges" aria-live="polite">
                  {isCancelled ? (
                    <span className="match-badge match-badge--warning">CANCELLED</span>
                  ) : null}
                  {isArchived ? <span className="match-badge match-badge--muted">ARCHIVED</span> : null}
                </div>
              </div>
              <div className="match-details-card__pills" aria-live="polite">
                {pills.map((pill) => (
                  <span
                    key={`${pill.label}-${pill.tone}`}
                    className={`match-details-pill match-details-pill--${pill.tone}`}
                  >
                    {pill.label}
                  </span>
                ))}
              </div>

              <div className="match-details-card__toolbar">
                <div className="match-details-card__status">
                  <Users size={18} /> {playersLabel} · {availabilityLabel}
                </div>
                <div className="match-details-card__actions" aria-label="Actions">
                  <button type="button" className="match-details-card__button" onClick={handlePrimaryAction}>
                    Open full view
                  </button>
                  {isHost ? (
                    <button
                      type="button"
                      className="match-details-card__button match-details-card__button--secondary"
                      onClick={() => setIsEditing((value) => !value)}
                      disabled={isArchived || isCancelled}
                    >
                      {isEditing ? "Close editor" : "Edit"}
                    </button>
                  ) : null}
                </div>
              </div>
            </header>

            <section className="match-section" aria-label="Match details">
              <div className="match-section__header">
                <h2>Details</h2>
                {(isArchived || isCancelled) && (
                  <div className="match-section__hint">
                    <ShieldAlert size={16} /> This match can no longer be edited.
                  </div>
                )}
              </div>

              {isEditing && isHost ? (
                <form
                  className="match-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    handleSave();
                  }}
                >
                  <div className="match-form__grid">
                    <label className="match-field">
                      <span>Date</span>
                      <input
                        type="date"
                        value={formState.date}
                        onChange={(event) => handleFormChange("date", event.target.value)}
                        required
                        disabled={saving || isArchived || isCancelled}
                      />
                    </label>
                    <label className="match-field">
                      <span>Time</span>
                      <input
                        type="time"
                        value={formState.time}
                        onChange={(event) => handleFormChange("time", event.target.value)}
                        required
                        disabled={saving || isArchived || isCancelled}
                      />
                    </label>
                    <label className="match-field match-field--wide">
                      <span>Location</span>
                      <input
                        type="text"
                        placeholder="Court or address"
                        value={formState.location}
                        onChange={(event) => handleFormChange("location", event.target.value)}
                        disabled={saving || isArchived || isCancelled}
                      />
                      <small>Start typing to search Google Places (optional).</small>
                    </label>
                    <label className="match-field">
                      <span>Match format</span>
                      <select
                        value={formState.matchFormat}
                        onChange={(event) => handleFormChange("matchFormat", event.target.value)}
                        disabled={saving || isArchived || isCancelled}
                      >
                        <option value="">Select format</option>
                        <option value="Singles">Singles</option>
                        <option value="Doubles">Doubles</option>
                        <option value="Mixed">Mixed</option>
                        <option value="Practice">Practice</option>
                      </select>
                    </label>
                    {isOpenMatch ? (
                      <label className="match-field">
                        <span>Skill level</span>
                        <select
                          value={formState.skillLevel}
                          onChange={(event) => handleFormChange("skillLevel", event.target.value)}
                          disabled={saving || isArchived || isCancelled}
                        >
                          <option value="">Open to all</option>
                          <option value="2.5">2.5</option>
                          <option value="3.0">3.0</option>
                          <option value="3.5">3.5</option>
                          <option value="4.0">4.0</option>
                          <option value="4.5">4.5</option>
                          <option value="5.0">5.0</option>
                        </select>
                      </label>
                    ) : null}
                    <label className="match-field">
                      <span>Player limit</span>
                      <input
                        type="number"
                        min={1}
                        value={formState.playerLimit}
                        onChange={(event) => handleFormChange("playerLimit", event.target.value)}
                        disabled={saving || isArchived || isCancelled}
                      />
                      <small>Set how many players can join.</small>
                    </label>
                    <label className="match-field match-field--wide">
                      <span>Notes</span>
                      <textarea
                        rows={3}
                        value={formState.notes}
                        onChange={(event) => handleFormChange("notes", event.target.value)}
                        disabled={saving || isArchived || isCancelled}
                      />
                    </label>
                  </div>
                  <div className="match-form__actions">
                    <button type="button" className="match-secondary" onClick={() => setIsEditing(false)} disabled={saving}>
                      Cancel
                    </button>
                    <button type="submit" className="match-primary" disabled={saving || isArchived || isCancelled}>
                      {saving ? "Saving…" : "Save"}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="match-summary">
                  {detailItems.map((item) => (
                    <div key={item.label} className="match-summary__item">
                      <p className="match-summary__label">{item.label}</p>
                      <p className="match-summary__value">{item.value || "Not provided"}</p>
                      {item.helper ? <p className="match-summary__helper">{item.helper}</p> : null}
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="match-section" aria-label="Participants">
              <div className="match-section__header">
                <div>
                  <h2>Participants</h2>
                  <p className="match-section__helper">{participantCount} players</p>
                </div>
                {match?.relationship === "participant" ? (
                  <button
                    type="button"
                    className="match-secondary"
                    onClick={handleLeave}
                    disabled={leaving}
                  >
                    {leaving ? "Leaving…" : "Leave match"}
                  </button>
                ) : match?.relationship === "viewer" ? (
                  <button type="button" className="match-primary" onClick={handleJoin} disabled={joining}>
                    {joining ? "Joining…" : "Join match"}
                  </button>
                ) : null}
              </div>

              {participantGroups.hasStatuses ? (
                <div className="match-columns">
                  <div className="match-column">
                    <p className="match-column__title">Accepted</p>
                    <ul className="match-list">
                      {participantGroups.accepted.map((participant) => (
                        <li key={participant.id ?? participant.name} className="match-list__item">
                          <div>
                            <p className="match-list__name">{participant.name || "Player"}</p>
                            {participant.contact ? (
                              <p className="match-list__meta">{participant.contact}</p>
                            ) : null}
                          </div>
                          {isHost ? (
                            <button
                              type="button"
                              className="match-link"
                              onClick={() => handleRemoveParticipant(participant.id)}
                            >
                              Remove
                            </button>
                          ) : null}
                        </li>
                      ))}
                      {participantGroups.accepted.length === 0 ? <li className="match-list__empty">No accepted players.</li> : null}
                    </ul>
                  </div>
                  <div className="match-column">
                    <p className="match-column__title">Waiting on responses</p>
                    <ul className="match-list">
                      {participantGroups.waiting.map((participant) => (
                        <li key={participant.id ?? participant.name} className="match-list__item">
                          <div>
                            <p className="match-list__name">{participant.name || "Player"}</p>
                            {participant.contact ? (
                              <p className="match-list__meta">{participant.contact}</p>
                            ) : null}
                          </div>
                          <span className="match-chip">Waiting</span>
                        </li>
                      ))}
                      {participantGroups.waiting.length === 0 ? <li className="match-list__empty">No pending invites.</li> : null}
                    </ul>
                  </div>
                  <div className="match-column">
                    <p className="match-column__title">Declined</p>
                    <ul className="match-list">
                      {participantGroups.declined.map((participant) => (
                        <li key={participant.id ?? participant.name} className="match-list__item">
                          <div>
                            <p className="match-list__name">{participant.name || "Player"}</p>
                            {participant.contact ? (
                              <p className="match-list__meta">{participant.contact}</p>
                            ) : null}
                          </div>
                          <span className="match-chip match-chip--muted">Declined</span>
                        </li>
                      ))}
                      {participantGroups.declined.length === 0 ? <li className="match-list__empty">No declines.</li> : null}
                    </ul>
                  </div>
                </div>
              ) : (
                <ul className="match-list">
                  {(match.participants ?? []).map((participant) => (
                    <li key={participant.id ?? participant.name} className="match-list__item">
                      <div>
                        <p className="match-list__name">{participant.name || "Player"}</p>
                        {participant.hosting ? <p className="match-list__meta">Host</p> : null}
                      </div>
                      {isHost && !participant.hosting ? (
                        <button
                          type="button"
                          className="match-link"
                          onClick={() => handleRemoveParticipant(participant.id)}
                        >
                          Remove
                        </button>
                      ) : null}
                    </li>
                  ))}
                  {(match.participants ?? []).length === 0 ? (
                    <li className="match-list__empty">No participants yet.</li>
                  ) : null}
                </ul>
              )}
            </section>

            <section className="match-section" aria-label="Host actions">
              <div className="match-section__header">
                <h2>Host tools</h2>
              </div>

              {isHost ? (
                <div className="match-columns">
                  {isOpenMatch ? (
                    <div className="match-column match-column--panel">
                      <div className="match-panel__header">
                        <div>
                          <p className="match-panel__eyebrow">Open match</p>
                          <h3>Share this match</h3>
                          <p className="match-panel__helper">Send a public link to let players join.</p>
                        </div>
                        <BadgeInfo size={18} />
                      </div>
                      <div className="match-share">
                        <input type="text" value={shareLink || ""} readOnly placeholder="Generate a link" />
                        <div className="match-share__actions">
                          <button type="button" className="match-secondary" onClick={handleShareLink}>
                            Generate share link
                          </button>
                          <button type="button" className="match-primary" onClick={handleCopyLink} disabled={!shareLink}>
                            <Copy size={14} /> Copy
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="match-column match-column--panel">
                      <div className="match-panel__header">
                        <div>
                          <p className="match-panel__eyebrow">Invite-only</p>
                          <h3>Invite players</h3>
                          <p className="match-panel__helper">Send invites by player ID or phone.</p>
                        </div>
                        <BadgeInfo size={18} />
                      </div>
                      <div className="match-invite">
                        <label className="match-field match-field--wide">
                          <span>Player IDs</span>
                          <input
                            type="text"
                            placeholder="Separate with commas"
                            value={inviteInputs.players}
                            onChange={(event) => setInviteInputs((prev) => ({ ...prev, players: event.target.value }))}
                          />
                        </label>
                        <label className="match-field match-field--wide">
                          <span>Phone numbers</span>
                          <input
                            type="text"
                            placeholder="e.g., 555-123-4567"
                            value={inviteInputs.phones}
                            onChange={(event) => setInviteInputs((prev) => ({ ...prev, phones: event.target.value }))}
                          />
                        </label>
                        <div className="match-form__actions">
                          <button
                            type="button"
                            className="match-primary"
                            onClick={handleSendInvites}
                            disabled={sendingInvites}
                          >
                            {sendingInvites ? "Sending…" : "Send invites"}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="match-section__helper">Only the host can invite or share.</p>
              )}
            </section>

            {(isCancelled || isArchived) && (
              <div className="match-alert" role="status">
                <ShieldAlert size={18} />
                <div>
                  <p className="match-alert__title">Match unavailable</p>
                  <p className="match-alert__body">This match is {isCancelled ? "cancelled" : "archived"}. Details are read only.</p>
                </div>
              </div>
            )}
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
