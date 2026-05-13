/// <reference types="google.maps" />

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import Autocomplete from "react-google-autocomplete";
import { Activity, AlertCircle, Calendar, MapPin, Share2, Star, Users, X } from "lucide-react";

import { normalizeMatchRecord, type NormalizedMatch } from "../api/matches";
import { useAuth } from "../context/AuthContext";
import MainLayout from "../components/MainLayout";
import { formatPhoneDisplay } from "../services/phone";
import { getMatch, getShareLink, removeParticipant, updateMatch } from "../services/matches";
import { ARCHIVE_FILTER_VALUE, isMatchArchivedError } from "../utils/archive";

import "./MatchDetailsPage.css";

type MatchFormState = {
  date: string;
  time: string;
  location: string;
  latitude: number | null;
  longitude: number | null;
  matchFormat: string;
  level: string;
  notes: string;
  playerLimit: string;
};

const MATCH_FORMAT_OPTIONS = ["Singles", "Doubles", "Mixed Doubles", "Dingles", "Round Robin", "Other"];
const SKILL_LEVEL_OPTIONS = [
  "2.5 - Beginner",
  "3.0 - Beginner/Intermediate",
  "3.5 - Intermediate",
  "4.0 - Advanced",
  "4.5 - Strong Advanced",
  "5.0+ - Tournament",
];

const DEFAULT_FORM: MatchFormState = {
  date: "",
  time: "",
  location: "",
  latitude: null,
  longitude: null,
  matchFormat: "",
  level: "",
  notes: "",
  playerLimit: "",
};

const toDateInput = (value?: string) => {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const toTimeInput = (value?: string) => {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  const hours = String(parsed.getHours()).padStart(2, "0");
  const minutes = String(parsed.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
};

const combineDateTime = (date: string, time: string) => {
  if (!date || !time) return "";
  const iso = `${date}T${time}`;
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
};

const parseCoordinate = (value: unknown): number | null => {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const numeric = Number.parseFloat(value);
    return Number.isFinite(numeric) ? numeric : null;
  }
  return null;
};

const idsMatch = (a: unknown, b: unknown) => {
  if (a === undefined || a === null || b === undefined || b === null) return false;
  return String(a).trim() === String(b).trim();
};

const uniqueActiveParticipants = (participants: unknown[]): Array<Record<string, unknown>> => {
  if (!Array.isArray(participants)) return [];
  return participants.filter((participant) => {
    if (!participant || typeof participant !== "object") return false;
    const record = participant as Record<string, unknown>;
    if (record.is_active === false || record.active === false) return false;
    const status = (record.status ?? record.participant_status ?? record.participantStatus ?? "") as string;
    const normalized = typeof status === "string" ? status.toLowerCase() : "";
    if (["left", "removed", "cancelled", "canceled", "declined", "rejected", "withdrawn"].includes(normalized)) {
      return false;
    }
    if (record.left_at || record.removed_at || record.cancelled_at || record.canceled_at) return false;
    return true;
  }) as Array<Record<string, unknown>>;
};

const getParticipantPlayerId = (participant: Record<string, unknown>) => {
  const profile =
    participant.profile && typeof participant.profile === "object"
      ? (participant.profile as Record<string, unknown>)
      : {};
  const player =
    participant.player && typeof participant.player === "object"
      ? (participant.player as Record<string, unknown>)
      : {};

  return (
    participant.player_id ??
    participant.playerId ??
    player.id ??
    player.player_id ??
    player.playerId ??
    profile.player_id ??
    profile.playerId ??
    profile.id ??
    null
  );
};

const buildInitialForm = (match: Record<string, unknown> | null): MatchFormState => {
  if (!match) return { ...DEFAULT_FORM };
  const start = (match.start_date_time as string) || (match.startDateTime as string) || (match.start_time as string);
  const latitude = parseCoordinate(match.latitude ?? match.lat);
  const longitude = parseCoordinate(match.longitude ?? match.lng);
  const isPrivate = (match.match_type ?? match.matchType ?? match.privacy ?? "").toString().toLowerCase() === "private";
  const playerLimitRaw =
    match.player_limit ??
    match.playerLimit ??
    match.capacity ??
    (match as { capacity?: { limit?: number } })?.capacity?.limit ??
    (match as { capacity?: { max?: number } })?.capacity?.max;
  const playerLimit = Number.isFinite(playerLimitRaw as number) ? String(playerLimitRaw) : "";
  return {
    date: toDateInput(start),
    time: toTimeInput(start),
    location: (match.location_text as string) || (match.location as string) || "",
    latitude,
    longitude,
    matchFormat: (match.match_format as string) || (match.format as string) || "",
    level: isPrivate
      ? ""
      : ((match.skill_level as string) || (match.skill_level_min as string) || (match.level as string) || ""),
    notes: (match.notes as string) || "",
    playerLimit,
  };
};

const MatchDetailsPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const { user } = useAuth() as { user?: { id?: unknown } | undefined };

  const [match, setMatch] = useState<NormalizedMatch | null>(null);
  const [rawMatch, setRawMatch] = useState<Record<string, unknown> | null>(null);
  const [participants, setParticipants] = useState<Array<Record<string, unknown>>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshIndex, setRefreshIndex] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [formState, setFormState] = useState<MatchFormState>({ ...DEFAULT_FORM });
  const [formError, setFormError] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [shareLink, setShareLink] = useState("");
  const [shareCopied, setShareCopied] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const hydratedMatch = useMemo(() => {
    const state = location.state as { match?: NormalizedMatch } | undefined;
    return state?.match ? normalizeMatchRecord(state.match, { currentUser: user }) : null;
  }, [location.state, user]);

  const loadMatch = useCallback(
    async (options: { signal?: AbortSignal; includeArchived?: boolean } = {}) => {
      if (!id) return;
      setIsLoading(true);
      setError(null);
      const requestFilter = options.includeArchived ? { filter: ARCHIVE_FILTER_VALUE } : {};

      try {
        const data = await getMatch(id, { ...requestFilter, includeHidden: true, include_hidden: true });
        const matchRecord = (data && typeof data === "object" && "match" in (data as object)
          ? (data as { match?: Record<string, unknown> }).match
          : data) as Record<string, unknown> | null;
        const normalized = matchRecord ? normalizeMatchRecord(matchRecord, { currentUser: user }) : null;
        const participantList = uniqueActiveParticipants(
          (data as { participants?: unknown[] })?.participants ??
            (matchRecord?.participants as unknown[]) ??
            [],
        );
        const mergedMatch =
          normalized && participantList.length > 0 && !normalized.participants
            ? { ...normalized, participants: participantList }
            : normalized;
        setRawMatch(matchRecord);
        setMatch(mergedMatch);
        setParticipants(participantList);
        setFormState(buildInitialForm(matchRecord));
      } catch (loadError) {
        if (options.signal?.aborted) return;
        if (!options.includeArchived && isMatchArchivedError(loadError)) {
          await loadMatch({ ...options, includeArchived: true });
          return;
        }
        console.error("Failed to load match details", loadError);
        const message =
          (loadError as { message?: string })?.message || "Unable to load match details.";
        setError(message);
      } finally {
        if (!options.signal?.aborted) {
          setIsLoading(false);
        }
      }
    },
    [id, user],
  );

  useEffect(() => {
    if (hydratedMatch) {
      setMatch(hydratedMatch);
      setRawMatch((hydratedMatch.raw as Record<string, unknown>) ?? null);
      setFormState(buildInitialForm((hydratedMatch.raw as Record<string, unknown>) ?? null));
      setIsLoading(false);
      return;
    }
    if (!id) return;
    const controller = new AbortController();
    loadMatch({ signal: controller.signal });
    return () => controller.abort();
  }, [hydratedMatch, id, loadMatch, refreshIndex]);

  useEffect(() => {
    if (shareLink) setShareCopied(false);
  }, [shareLink]);

  const playersJoined = match?.playersJoined ?? participants.length ?? 0;
  const totalSpots = match?.totalSpots ?? playersJoined;
  const spotsAvailable = Math.max((match?.playersNeeded ?? 0) || totalSpots - playersJoined, 0);
  const playersLabel = totalSpots ? `${playersJoined}/${totalSpots} players` : `${playersJoined} players`;
  const availabilityLabel =
    totalSpots > 0
      ? spotsAvailable === 0
        ? "Match is full"
        : `${spotsAvailable} spot${spotsAvailable === 1 ? "" : "s"} available`
      : "Spots available";

  const archived = (rawMatch?.status as string)?.toLowerCase?.() === "archived";
  const cancelled = (rawMatch?.status as string)?.toLowerCase?.() === "cancelled";
  const isPrivate = (rawMatch?.match_type as string)?.toLowerCase?.() === "private";
  const isHost =
    match?.relationship === "host" ||
    (match?.participants ?? []).some((participant) => participant.isCurrentUser && participant.hosting);
  const canEdit = isHost && !archived && !cancelled;

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
    if (archived) values.push({ label: "Archived", tone: "warning" });
    if (cancelled) values.push({ label: "Cancelled", tone: "warning" });
    return values;
  }, [archived, cancelled, match]);

  const handleRetry = () => setRefreshIndex((value) => value + 1);

  const handleEditToggle = () => {
    if (!canEdit) return;
    setIsEditing((prev) => !prev);
    setFormError("");
    setFeedback(null);
    if (!isEditing && rawMatch) {
      setFormState(buildInitialForm(rawMatch));
    }
  };

  const handleLocationSelect = useCallback(
    (place: google.maps.places.PlaceResult | null) => {
      if (!place) return;
      const lat = place.geometry?.location?.lat?.();
      const lng = place.geometry?.location?.lng?.();
      const label = place.formatted_address || place.name || formState.location;
      setFormState((prev) => ({
        ...prev,
        location: label || prev.location,
        latitude: typeof lat === "number" ? lat : prev.latitude,
        longitude: typeof lng === "number" ? lng : prev.longitude,
      }));
    },
    [formState.location],
  );

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canEdit || !rawMatch) return;
    setFormError("");
    setFeedback(null);
    if (!formState.date || !formState.time || !formState.location.trim()) {
      setFormError("Date, time, and location are required.");
      return;
    }
    const iso = combineDateTime(formState.date, formState.time);
    if (!iso) {
      setFormError("Please provide a valid date and time.");
      return;
    }
    const payload: Record<string, unknown> = {
      start_date_time: iso,
      location_text: formState.location.trim(),
      notes: formState.notes.trim(),
      match_format: formState.matchFormat.trim() || null,
      latitude: parseCoordinate(formState.latitude),
      longitude: parseCoordinate(formState.longitude),
    };
    if (!isPrivate) {
      payload.skill_level = formState.level.trim() || null;
      payload.skill_level_min = formState.level.trim() || null;
    }
    if (formState.playerLimit) {
      const parsedLimit = Number.parseInt(formState.playerLimit, 10);
      if (!Number.isFinite(parsedLimit) || parsedLimit <= 0) {
        setFormError("Player limit must be a positive number.");
        return;
      }
      payload.player_limit = parsedLimit;
      payload.capacity = { limit: parsedLimit };
    }

    try {
      await updateMatch(rawMatch.id ?? id, payload);
      setFeedback("Match updated successfully.");
      setIsEditing(false);
      setRefreshIndex((value) => value + 1);
    } catch (saveError) {
      console.error("Failed to update match", saveError);
      const message =
        (saveError as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (saveError as { message?: string }).message ||
        "Failed to update match.";
      setFormError(message);
    }
  };

  const handleRemoveParticipant = async (playerId: unknown) => {
    if (!canEdit || !rawMatch?.id) return;
    if (!window.confirm("Remove this participant from the match?")) return;
    setRemovingId(String(playerId));
    try {
      await removeParticipant(rawMatch.id as string, playerId as string);
      setParticipants((prev) =>
        prev.filter((participant) => !idsMatch(getParticipantPlayerId(participant), playerId)),
      );
      setFeedback("Participant removed.");
    } catch (err) {
      console.error("Failed to remove participant", err);
      setFeedback("Unable to remove participant. Try again.");
    } finally {
      setRemovingId(null);
    }
  };

  const handleGenerateShareLink = async () => {
    if (!rawMatch?.id) return;
    setShareCopied(false);
    try {
      const result = await getShareLink(rawMatch.id as string);
      const link =
        (result as { shareUrl?: string })?.shareUrl ||
        (result as { share_url?: string })?.share_url ||
        (result as { url?: string })?.url ||
        "";
      if (!link) {
        setFeedback("We couldn't generate a share link. Try again.");
        return;
      }
      setShareLink(link);
      setFeedback("Share link ready to copy.");
    } catch (err) {
      console.error("Failed to load share link", err);
      setFeedback("We couldn't generate a share link right now.");
    }
  };

  const handleCopyShareLink = async () => {
    if (!shareLink) return;
    try {
      await navigator.clipboard.writeText(shareLink);
      setShareCopied(true);
      setFeedback("Link copied to clipboard.");
    } catch {
      setShareCopied(false);
      setFeedback("Unable to copy. Copy manually instead.");
    }
  };

  const buildInitials = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return "";
    return trimmed
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("");
  };

  const detailItems = [
    {
      icon: <Calendar size={18} aria-hidden="true" />,
      title: match?.startDisplay,
      subtitle: match?.startDateTimeIso,
    },
    {
      icon: <MapPin size={18} aria-hidden="true" />,
      title: match?.location,
      subtitle: [match?.locationDetail, match?.distance].filter(Boolean).join(" · ") || undefined,
    },
    {
      icon: <Users size={18} aria-hidden="true" />,
      title: playersLabel,
      subtitle: availabilityLabel,
    },
    match?.type
      ? {
          icon: <Activity size={18} aria-hidden="true" />,
          title: `Match type: ${match.type}`,
        }
      : null,
    match?.level
      ? {
          icon: <Star size={18} aria-hidden="true" />,
          title: `Suggested level: ${match.level.summary}`,
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

  const googleApiKey = import.meta.env.VITE_GOOGLE_API_KEY || undefined;

  return (
    <MainLayout>
      <div className="match-details-page match-details-page--compact">
        {isLoading ? (
          <div className="match-details-state" role="status">
            Loading match details…
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
              <div className="match-details-card__header-row">
                <div>
                  <h1 className="match-details-card__title">{match.location || "Match"}</h1>
                  {match.hostName ? (
                    <p className="match-details-card__meta">Hosted by {match.hostName}</p>
                  ) : null}
                </div>
                <div className="match-details-card__actions">
                  {canEdit ? (
                    <button type="button" className="match-details-primary" onClick={handleEditToggle}>
                      {isEditing ? "Cancel edit" : "Edit match"}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="match-details-secondary"
                    onClick={() => navigate("/matches", { replace: true })}
                  >
                    Back to matches
                  </button>
                </div>
              </div>
              {archived || cancelled ? (
                <div className="match-details-banner">
                  <AlertCircle size={16} aria-hidden="true" />
                  <span>
                    {archived
                      ? "This match is archived and read-only."
                      : "This match has been cancelled."}
                  </span>
                </div>
              ) : null}
              {feedback ? <div className="match-details-feedback">{feedback}</div> : null}
              {formError ? <div className="match-details-error">{formError}</div> : null}
            </header>

            <div className="match-details-card__body">
              <section className="match-details-card__panel" aria-label="Match information">
                <h2 className="match-details-card__section-title">Match details</h2>
                <ul className="match-details-card__list">
                  {detailItems.map((item) => (
                    <li key={item.title} className="match-details-card__item">
                      <div className="match-details-card__icon">{item.icon}</div>
                      <div className="match-details-card__text">
                        <p className="match-details-card__primary">{item.title}</p>
                        {item.subtitle ? <p className="match-details-card__secondary">{item.subtitle}</p> : null}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>

              {canEdit ? (
                <section className="match-details-card__panel" aria-label="Edit match">
                  <div className="match-details-card__section-heading">
                    <h2 className="match-details-card__section-title">Edit match</h2>
                    <span className="match-details-card__section-pill">Host-only</span>
                  </div>
                  {isEditing ? (
                    <form className="match-edit-form" onSubmit={handleSave}>
                      <div className="match-edit-grid">
                        <label className="match-edit-field">
                          <span>Date</span>
                          <input
                            type="date"
                            value={formState.date}
                            onChange={(event) =>
                              setFormState((prev) => ({ ...prev, date: event.target.value }))
                            }
                            required
                          />
                        </label>
                        <label className="match-edit-field">
                          <span>Time</span>
                          <input
                            type="time"
                            value={formState.time}
                            onChange={(event) =>
                              setFormState((prev) => ({ ...prev, time: event.target.value }))
                            }
                            required
                          />
                        </label>
                      </div>

                      <label className="match-edit-field">
                        <span>Location</span>
                        <Autocomplete
                          apiKey={googleApiKey}
                          placeholder="Search location"
                          className="match-edit-input"
                          value={formState.location}
                          onChange={(event) =>
                            setFormState((prev) => ({
                              ...prev,
                              location: event.target.value,
                              latitude: null,
                              longitude: null,
                            }))
                          }
                          onPlaceSelected={handleLocationSelect}
                          options={{ fields: ["formatted_address", "geometry", "name"] }}
                        />
                      </label>

                      <div className="match-edit-grid">
                        <label className="match-edit-field">
                          <span>Match format</span>
                          <select
                            value={formState.matchFormat}
                            onChange={(event) =>
                              setFormState((prev) => ({ ...prev, matchFormat: event.target.value }))
                            }
                            className="match-edit-input"
                          >
                            <option value="">Select format</option>
                            {MATCH_FORMAT_OPTIONS.map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        </label>
                        {!isPrivate ? (
                          <label className="match-edit-field">
                            <span>Skill level</span>
                            <select
                              value={formState.level}
                              onChange={(event) =>
                                setFormState((prev) => ({ ...prev, level: event.target.value }))
                              }
                              className="match-edit-input"
                            >
                              <option value="">Select level</option>
                              {SKILL_LEVEL_OPTIONS.map((option) => (
                                <option key={option} value={option}>
                                  {option}
                                </option>
                              ))}
                            </select>
                          </label>
                        ) : null}
                      </div>

                      <label className="match-edit-field">
                        <span>Notes</span>
                        <textarea
                          value={formState.notes}
                          onChange={(event) =>
                            setFormState((prev) => ({ ...prev, notes: event.target.value }))
                          }
                          rows={3}
                          className="match-edit-input"
                        />
                      </label>

                      {!isPrivate ? (
                        <label className="match-edit-field">
                          <span>Player limit</span>
                          <input
                            type="number"
                            min={2}
                            value={formState.playerLimit}
                            onChange={(event) =>
                              setFormState((prev) => ({
                                ...prev,
                                playerLimit: event.target.value.replace(/[^0-9]/g, ""),
                              }))
                            }
                            className="match-edit-input"
                          />
                        </label>
                      ) : null}

                      <div className="match-edit-actions">
                        <button type="submit" className="match-details-primary">
                          Save changes
                        </button>
                        <button type="button" className="match-details-secondary" onClick={handleEditToggle}>
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : (
                    <p className="match-details-card__secondary">
                      Start editing to adjust time, location, format, skill level, notes, or player limit.
                    </p>
                  )}
                </section>
              ) : null}

              <section className="match-details-card__panel" aria-label="Share link">
                <div className="match-details-card__section-heading">
                  <h2 className="match-details-card__section-title">Share match</h2>
                  <Share2 size={18} aria-hidden="true" />
                </div>
                <div className="match-share-row">
                  <button type="button" className="match-details-primary" onClick={handleGenerateShareLink}>
                    {shareLink ? "Refresh link" : "Generate share link"}
                  </button>
                  {shareLink ? (
                    <Fragment>
                      <div className="match-share-url" title={shareLink}>
                        {shareLink}
                      </div>
                      <button type="button" className="match-details-secondary" onClick={handleCopyShareLink}>
                        {shareCopied ? "Copied" : "Copy link"}
                      </button>
                    </Fragment>
                  ) : (
                    <p className="match-details-card__secondary">
                      Create a shareable link for players to view this match.
                    </p>
                  )}
                </div>
              </section>

              <section className="match-details-card__panel" aria-label="Participants">
                <div className="match-details-card__section-heading">
                  <h2 className="match-details-card__section-title">Participating players</h2>
                  <span className="match-details-card__section-pill">{playersLabel}</span>
                </div>
                {participants.length > 0 ? (
                  <ul className="match-details-participants">
                    {participants.map((participant) => {
                      const name =
                        (participant.name as string) ||
                        (participant.profile as { name?: string })?.name ||
                        "Unknown player";
                      const initials = name ? buildInitials(name) : "";
                      const avatarSrc =
                        (participant.profileImageUrl as string) ??
                        (participant.avatarUrl as string) ??
                        ((participant.profile as { avatar_url?: string })?.avatar_url as string);
                      const phone = formatPhoneDisplay(
                        (participant.contactPhone as string) ??
                          (participant.phone as string) ??
                          (participant.profile as { phone?: string })?.phone,
                      );
                      const hosting = participant.hosting === true;
                      const participantId =
                        getParticipantPlayerId(participant) ??
                        participant.id ??
                        participant.user_id;

                      return (
                        <li key={participantId ?? name} className="match-details-participants__item">
                          <div className="match-details-participants__avatar">
                            {avatarSrc ? (
                              <img src={avatarSrc} alt={name} />
                            ) : (
                              <span>{initials}</span>
                            )}
                          </div>
                          <div className="match-details-participants__info">
                            <p className="match-details-participants__name">
                              {name}
                              {hosting ? (
                                <span className="match-details-participants__tag">Host</span>
                              ) : null}
                            </p>
                            {phone ? (
                              <a className="match-details-participants__contact-link" href={`tel:${phone}`}>
                                {phone}
                              </a>
                            ) : (
                              <span className="match-details-participants__contact-link muted">
                                Contact info not provided
                              </span>
                            )}
                          </div>
                          {canEdit ? (
                            <button
                              type="button"
                              className="match-participant-remove"
                              onClick={() => handleRemoveParticipant(participantId)}
                              disabled={removingId === String(participantId)}
                              title="Remove participant"
                            >
                              <X size={14} aria-hidden="true" />
                            </button>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="match-details-card__secondary">No participants yet.</p>
                )}
              </section>
            </div>
          </article>
        ) : null}
      </div>
    </MainLayout>
  );
};

export default MatchDetailsPage;
