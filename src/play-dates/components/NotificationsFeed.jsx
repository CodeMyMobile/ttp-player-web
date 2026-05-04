import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  BellRing,
  CalendarDays,
  CheckCircle2,
  Edit3,
  Loader2,
  RefreshCcw,
  Sparkles,
  Lock,
  UserCheck,
  UserMinus,
  UserPlus,
  UserX,
  Users,
} from "lucide-react";
import { listNotifications } from "../services/notifications";
import { listInvites } from "../services/invites";
import { getStoredAuthToken } from "../services/authToken";
import {
  deriveListingVisibility,
  normalizeListingVisibility,
  isLinkOnlyVisibility,
} from "../utils/listingVisibility";

const buildQueryArray = (value) => {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null) return [];
  return [value];
};

const cleanString = (value) => {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
};

const formatPersonName = (subject, fallback = "") => {
  if (!subject) return fallback;
  if (typeof subject === "string") return subject.trim() || fallback;
  if (typeof subject === "object") {
    const {
      name,
      full_name,
      fullName,
      first_name,
      firstName,
      last_name,
      lastName,
      display_name,
      displayName,
      player_name,
      playerName,
      member_name,
      memberName,
    } = subject;
    const direct =
      cleanString(name) ||
      cleanString(full_name) ||
      cleanString(fullName) ||
      cleanString(display_name) ||
      cleanString(displayName) ||
      cleanString(player_name) ||
      cleanString(playerName) ||
      cleanString(member_name) ||
      cleanString(memberName);
    if (direct) return direct;
    const first = cleanString(first_name) || cleanString(firstName);
    const last = cleanString(last_name) || cleanString(lastName);
    if (first || last) {
      return [first, last].filter(Boolean).join(" ");
    }
  }
  return fallback;
};

const humanizeKey = (value = "") => {
  if (!value) return "";
  const spaced = value
    .toString()
    .replace(/[._-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
  if (!spaced) return "";
  return spaced
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
};

const stringifyValue = (value) => {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) {
    return value.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }
  if (typeof value === "string") return value;
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

const parseChangeList = (changes) => {
  if (!changes) return [];
  if (typeof changes === "string") {
    return changes.trim() ? [changes.trim()] : [];
  }
  if (Array.isArray(changes)) {
    return changes
      .map((item) => {
        if (!item) return "";
        if (typeof item === "string") return item.trim();
        if (typeof item === "object") {
          if (item.message) return cleanString(item.message);
          const entries = Object.entries(item)
            .filter(([, value]) => value !== undefined && value !== null)
            .map(([key, value]) => `${humanizeKey(key)}: ${stringifyValue(value)}`);
          return entries.join(" · ");
        }
        return stringifyValue(item);
      })
      .filter(Boolean);
  }
  if (typeof changes === "object") {
    return Object.entries(changes)
      .map(([key, value]) => {
        if (value && typeof value === "object") {
          const { from, to } = value;
          if (from !== undefined || to !== undefined) {
            const fromLabel = stringifyValue(from);
            const toLabel = stringifyValue(to);
            if (fromLabel && toLabel) {
              return `${humanizeKey(key)}: ${fromLabel} → ${toLabel}`;
            }
            if (toLabel) return `${humanizeKey(key)} updated to ${toLabel}`;
          }
        }
        return `${humanizeKey(key)} updated`;
      })
      .filter(Boolean);
  }
  return [];
};

const parseTimestamp = (value) => {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const date = new Date(trimmed);
    if (!Number.isNaN(date.getTime())) return date;
  }
  return null;
};

const getRelativeTime = (date) => {
  if (!(date instanceof Date)) return "";
  const now = Date.now();
  const diffMs = date.getTime() - now;
  const diffSeconds = Math.round(diffMs / 1000);
  const units = [
    { limit: 60, unit: "second", divisor: 1 },
    { limit: 3600, unit: "minute", divisor: 60 },
    { limit: 86400, unit: "hour", divisor: 3600 },
    { limit: 604800, unit: "day", divisor: 86400 },
    { limit: 2629800, unit: "week", divisor: 604800 },
    { limit: 31557600, unit: "month", divisor: 2629800 },
  ];
  const absSeconds = Math.abs(diffSeconds);
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  for (const { limit, unit, divisor } of units) {
    if (absSeconds < limit) {
      const value = Math.round(diffSeconds / divisor);
      return formatter.format(value, unit);
    }
  }
  const years = Math.round(diffSeconds / 31557600);
  return formatter.format(years, "year");
};

const formatDateHeading = (date) => {
  if (!(date instanceof Date)) return "";
  const now = new Date();
  const midnight = (value) => {
    const copy = new Date(value.getTime());
    copy.setHours(0, 0, 0, 0);
    return copy;
  };
  const diffDays = Math.round(
    (midnight(now).getTime() - midnight(date).getTime()) / (1000 * 60 * 60 * 24),
  );
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) {
    return date.toLocaleDateString(undefined, { weekday: "long" });
  }
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: now.getFullYear() !== date.getFullYear() ? "numeric" : undefined,
  });
};

const resolveMatchFromNotification = (notification) => {
  if (!notification) return null;
  if (notification.match) return notification.match;
  if (notification.match_info) return notification.match_info;
  if (notification.matchInfo) return notification.matchInfo;
  if (notification.context?.match) return notification.context.match;
  if (notification.meta?.match) return notification.meta.match;
  if (notification.data?.match) return notification.data.match;
  return null;
};

const resolvePlayerFromNotification = (notification) => {
  if (!notification) return null;
  return (
    notification.player ||
    notification.member ||
    notification.invitee ||
    notification.participant ||
    notification.subject ||
    notification.member_name ||
    notification.memberName ||
    notification.participant_name ||
    notification.participantName ||
    notification.player_name ||
    notification.playerName ||
    notification.context?.player ||
    notification.context?.member ||
    notification.context?.invitee ||
    notification.context?.participant ||
    notification.context?.subject ||
    notification.context?.member_name ||
    notification.context?.memberName ||
    notification.context?.participant_name ||
    notification.context?.participantName ||
    notification.context?.player_name ||
    notification.context?.playerName ||
    notification.data?.player ||
    notification.data?.member ||
    notification.data?.invitee ||
    notification.data?.participant ||
    notification.data?.subject ||
    notification.data?.member_name ||
    notification.data?.memberName ||
    notification.data?.participant_name ||
    notification.data?.participantName ||
    notification.data?.player_name ||
    notification.data?.playerName ||
    notification.meta?.player ||
    notification.meta?.member ||
    notification.meta?.invitee ||
    notification.meta?.participant ||
    notification.meta?.subject ||
    notification.meta?.member_name ||
    notification.meta?.memberName ||
    notification.meta?.participant_name ||
    notification.meta?.participantName ||
    notification.meta?.player_name ||
    notification.meta?.playerName ||
    null
  );
};

const resolveActorFromNotification = (notification) => {
  if (!notification) return null;
  return (
    notification.actor ||
    notification.owner ||
    notification.host ||
    notification.user ||
    notification.context?.actor ||
    notification.meta?.actor ||
    notification.data?.actor ||
    null
  );
};

const resolveCanonicalType = (rawType = "", notification = {}) => {
  const normalized = rawType.toString().toLowerCase();
  if (normalized.includes("match") && normalized.includes("create")) {
    return "match_created";
  }
  if (normalized.includes("match") && normalized.includes("update")) {
    return "match_updated";
  }
  if (normalized.includes("match") && normalized.includes("edit")) {
    return "match_updated";
  }
  if (normalized.includes("match") && normalized.includes("full")) {
    return "match_full";
  }
  if (normalized.includes("join") || normalized.includes("signup")) {
    return "player_joined";
  }
  if (normalized.includes("leave") || normalized.includes("remove")) {
    return "player_left";
  }
  if (normalized.includes("decline") || normalized.includes("reject")) {
    return "invite_declined";
  }
  if (normalized.includes("accept")) {
    return "invite_accepted";
  }
  if (normalized.includes("invite") && normalized.includes("send")) {
    return "invite_sent";
  }
  if (normalized.includes("cancel")) {
    return "match_cancelled";
  }

  const status =
    notification.status ||
    notification.context?.status ||
    notification.meta?.status ||
    notification.data?.status ||
    "";
  const statusNormalized = status.toString().toLowerCase();
  if (statusNormalized === "full") return "match_full";
  if (statusNormalized === "declined") return "invite_declined";
  if (statusNormalized === "accepted") return "invite_accepted";

  const message =
    cleanString(notification.message) ||
    cleanString(notification.description) ||
    cleanString(notification.summary);
  if (message) {
    const lower = message.toLowerCase();
    if (lower.includes("declined")) return "invite_declined";
    if (lower.includes("accepted")) return "invite_accepted";
    if (lower.includes("joined")) return "player_joined";
    if (lower.includes("left")) return "player_left";
    if (lower.includes("updated")) return "match_updated";
    if (lower.includes("created")) return "match_created";
    if (lower.includes("full")) return "match_full";
  }

  return "general";
};

const deriveMatchLabel = (match) => {
  if (!match || typeof match !== "object") return "this match";
  const {
    name,
    title,
    location_text,
    locationText,
    location,
    match_format,
    matchFormat,
    id,
  } = match;
  const primary =
    cleanString(name) ||
    cleanString(title) ||
    cleanString(location_text) ||
    cleanString(locationText) ||
    cleanString(location);
  if (primary) return primary;
  if (match_format || matchFormat) {
    return `${cleanString(match_format || matchFormat)} match`;
  }
  if (id !== undefined && id !== null) {
    return `Match #${id}`;
  }
  return "this match";
};

const deriveMatchId = (match) => {
  if (!match || typeof match !== "object") return null;
  const candidates = [match.id, match.match_id, match.matchId];
  for (const candidate of candidates) {
    if (candidate === undefined || candidate === null) continue;
    const numeric = Number(candidate);
    if (Number.isFinite(numeric)) return numeric;
  }
  return null;
};

const buildNotificationPresentation = (notification) => {
  const match = resolveMatchFromNotification(notification) || {};
  const actor = resolveActorFromNotification(notification);
  const player = resolvePlayerFromNotification(notification);
  const canonicalType = resolveCanonicalType(notification.type || notification.event || notification.kind || "", notification);
  const createdAt =
    parseTimestamp(notification.created_at) ||
    parseTimestamp(notification.createdAt) ||
    parseTimestamp(notification.timestamp) ||
    parseTimestamp(notification.time);
  const matchLabel = deriveMatchLabel(match);
  const matchId = deriveMatchId(match);
  const actorNameRaw = formatPersonName(actor, "");
  const actorName = actorNameRaw || "Someone";
  const playerNameRaw = formatPersonName(player, "");
  const playerName = playerNameRaw || actorNameRaw || "A player";
  const message =
    cleanString(notification.message) ||
    cleanString(notification.description) ||
    cleanString(notification.summary);
  const changeDetails =
    parseChangeList(notification.changes || notification.context?.changes || notification.meta?.changes);
  const detailList =
    changeDetails.length > 0
      ? changeDetails
      : parseChangeList(notification.context?.details || notification.meta?.details);

  const tags = buildQueryArray(notification.tags || notification.labels).map(cleanString).filter(Boolean);

  const listingVisibility = normalizeListingVisibility(
    deriveListingVisibility(notification, notification.context, notification.meta, match)
  );

  let title = message || "";
  let body = cleanString(notification.body) || cleanString(notification.note) || "";

  switch (canonicalType) {
    case "match_created":
      title = `${actorName} created ${matchLabel}`;
      body = cleanString(notification.body) || cleanString(notification.note) || "A new match is ready to join.";
      break;
    case "match_updated": {
      const changeSummary = detailList.length ? detailList.join(" · ") : "Match details were updated.";
      title = `${actorName} updated ${matchLabel}`;
      body = changeSummary;
      break;
    }
    case "match_full":
      title = `${matchLabel} is now full`;
      body = message || "All spots have been claimed.";
      break;
    case "match_cancelled":
      title = `${matchLabel} was cancelled`;
      body = message || `${actorName} cancelled this match.`;
      break;
    case "player_joined":
      title = `${playerName} joined ${matchLabel}`;
      body = message || `${playerName} is confirmed to play.`;
      break;
    case "player_left":
      title = `${playerName} left ${matchLabel}`;
      body = message || `${playerName} is no longer participating.`;
      break;
    case "invite_declined":
      title = `${playerName} declined the invite`;
      body = message || `${playerName} passed on ${matchLabel}.`;
      break;
    case "invite_accepted":
      title = `${playerName} accepted the invite`;
      body = message || `${playerName} will be joining ${matchLabel}.`;
      break;
    case "invite_sent":
      title = `Invite sent for ${matchLabel}`;
      body = message || `An invite was delivered${playerName ? ` to ${playerName}` : ""}.`;
      break;
    default:
      title = message || `${actorName} posted an update`;
      body = cleanString(notification.body) || cleanString(notification.note) || "Keep an eye on your matches.";
      break;
  }

  const startTime =
    parseTimestamp(match.start_date_time) ||
    parseTimestamp(match.startDateTime) ||
    parseTimestamp(match.start_time) ||
    parseTimestamp(match.scheduled_for);

  const startLabel = startTime
    ? startTime.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "";

  return {
    id:
      notification.id ||
      notification.notification_id ||
      notification.uuid ||
      `${canonicalType}-${notification.created_at || notification.createdAt || Math.random()}`,
    canonicalType,
    title,
    body,
    createdAt,
    relativeTime: createdAt ? getRelativeTime(createdAt) : "",
    createdAtLabel: createdAt ? createdAt.toLocaleString() : "",
    matchId,
    matchLabel,
    startLabel,
    tags,
    details: detailList,
    actorName,
    playerName,
    listingVisibility,
    isLinkOnly: isLinkOnlyVisibility(listingVisibility),
    raw: notification,
  };
};

const iconByType = {
  match_created: { icon: Sparkles, accent: "bg-emerald-100 text-emerald-600" },
  match_updated: { icon: Edit3, accent: "bg-blue-100 text-blue-600" },
  match_full: { icon: Users, accent: "bg-amber-100 text-amber-600" },
  match_cancelled: { icon: AlertCircle, accent: "bg-rose-100 text-rose-600" },
  player_joined: { icon: UserPlus, accent: "bg-emerald-100 text-emerald-600" },
  player_left: { icon: UserMinus, accent: "bg-slate-100 text-slate-600" },
  invite_declined: { icon: UserX, accent: "bg-rose-100 text-rose-600" },
  invite_accepted: { icon: UserCheck, accent: "bg-indigo-100 text-indigo-600" },
  invite_sent: { icon: CheckCircle2, accent: "bg-teal-100 text-teal-600" },
  general: { icon: BellRing, accent: "bg-gray-100 text-gray-600" },
};

const filterDefinitions = [
  {
    id: "all",
    label: "All activity",
    predicate: () => true,
  },
  {
    id: "matches",
    label: "Match updates",
    predicate: (item) =>
      [
        "match_created",
        "match_updated",
        "match_full",
        "match_cancelled",
        "player_joined",
        "player_left",
      ].includes(item.canonicalType),
  },
  {
    id: "invites",
    label: "Invites",
    predicate: (item) =>
      ["invite_declined", "invite_accepted", "invite_sent"].includes(item.canonicalType),
  },
];

const deriveInviteStatus = (invite = {}) => {
  if (invite.accepted) return "accepted";
  if (invite.rejected) return "rejected";
  const candidates = [
    invite.status,
    invite.state,
    invite.invite_status,
    invite.context?.status,
    invite.meta?.status,
  ];
  for (const candidate of candidates) {
    if (!candidate) continue;
    const normalized = candidate.toString().toLowerCase();
    if (normalized.includes("accept")) return "accepted";
    if (normalized.includes("reject") || normalized.includes("declin")) {
      return "rejected";
    }
    if (normalized.includes("pending") || normalized.includes("open")) {
      return "pending";
    }
    if (normalized.includes("sent") || normalized.includes("invite")) {
      return "sent";
    }
  }
  return "pending";
};

const buildInviteNotification = (invite) => {
  if (!invite) return null;
  const status = deriveInviteStatus(invite);
  const canonicalType =
    status === "accepted"
      ? "invite_accepted"
      : status === "rejected"
      ? "invite_declined"
      : "invite_sent";
  const match =
    invite.match || invite.match_info || invite.matchInfo || invite.context?.match || null;
  const playerCandidate =
    invite.player ||
    invite.invitee ||
    invite.member ||
    invite.context?.player ||
    (invite.player_name ? { name: invite.player_name } : null) ||
    (invite.invitee_name ? { name: invite.invitee_name } : null);
  const actorCandidate =
    invite.invited_by ||
    invite.sender ||
    invite.actor ||
    invite.context?.actor ||
    match?.host ||
    match?.owner ||
    null;
  const createdAtValue =
    invite.updated_at ||
    invite.updatedAt ||
    invite.created_at ||
    invite.createdAt ||
    invite.sent_at ||
    invite.sentAt;

  const baseNotification = {
    id:
      invite.id ||
      invite.uuid ||
      invite.token ||
      `invite-${createdAtValue || Date.now()}-${Math.random()}`,
    type: canonicalType,
    status,
    created_at: createdAtValue,
    match,
    player: playerCandidate,
    actor: actorCandidate,
    message: invite.message || invite.note || invite.context?.message,
    context: {
      status,
      player: playerCandidate,
      match,
      invite,
    },
  };

  if (!baseNotification.message) {
    const inviteeName = formatPersonName(playerCandidate, "A player");
    if (canonicalType === "invite_accepted") {
      baseNotification.message = `${inviteeName} accepted the invite.`;
    } else if (canonicalType === "invite_declined") {
      baseNotification.message = `${inviteeName} declined the invite.`;
    } else {
      baseNotification.message = `Invite sent${
        inviteeName && inviteeName !== "A player" ? ` to ${inviteeName}` : ""
      }.`;
    }
  }

  return buildNotificationPresentation(baseNotification);
};

const NotificationsFeed = ({
  currentUser,
  onSummaryChange,
  onOpenMatch,
  notificationsSupported = true,
  onAvailabilityChange,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notifications, setNotifications] = useState([]);
  const [activeFilter, setActiveFilter] = useState("all");
  const [requiresAuth, setRequiresAuth] = useState(false);
  const invitesFallbackSupportedRef = useRef(true);
  const fallbackErrorLoggedRef = useRef(false);
  const notificationsErrorLoggedRef = useRef(false);
  const nextNotificationRetryAtRef = useRef(0);

  const loadInvitesFallback = useCallback(async () => {
    if (!invitesFallbackSupportedRef.current) {
      setNotifications([]);
      setError("We couldn't load updates right now. Please try again later.");
      onSummaryChange?.({ total: 0, unread: 0, latest: null });
      onAvailabilityChange?.(false);
      return false;
    }

    try {
      const data = await listInvites({ perPage: 50 });
      const invitesArray = Array.isArray(data?.invites)
        ? data.invites
        : Array.isArray(data?.data)
        ? data.data
        : Array.isArray(data)
        ? data
        : [];
      const normalized = invitesArray
        .map((invite) => {
          try {
            return buildInviteNotification(invite);
          } catch (inviteError) {
            console.error("Failed to normalize invite for updates feed", inviteError, invite);
            return null;
          }
        })
        .filter(Boolean)
        .sort((a, b) => {
          const aTime = a.createdAt ? a.createdAt.getTime() : 0;
          const bTime = b.createdAt ? b.createdAt.getTime() : 0;
          return bTime - aTime;
        });

      setNotifications(normalized);
      invitesFallbackSupportedRef.current = true;
      fallbackErrorLoggedRef.current = false;

      const unreadFallback = invitesArray.filter((invite) => {
        const status = deriveInviteStatus(invite);
        return status === "pending" || status === "sent";
      }).length;

      onSummaryChange?.({
        total: normalized.length,
        unread: unreadFallback,
        latest: normalized[0]?.createdAt || null,
      });

      setError(
        normalized.length
          ? "We couldn't reach the updates service, so we're showing your latest invites instead."
          : "We couldn't load updates right now. Please try again later.",
      );
      onAvailabilityChange?.(false);
      return true;
    } catch (fallbackError) {
      const statusCode = Number(fallbackError?.status ?? fallbackError?.response?.status);
      if (statusCode === 404) {
        invitesFallbackSupportedRef.current = false;
      } else if (!fallbackErrorLoggedRef.current) {
        console.error("Failed to load invites fallback", fallbackError);
        fallbackErrorLoggedRef.current = true;
      }
      setNotifications([]);
      setError("We couldn't load updates right now. Please try again later.");
      onSummaryChange?.({ total: 0, unread: 0, latest: null });
      onAvailabilityChange?.(false);
      return false;
    }
  }, [onAvailabilityChange, onSummaryChange]);

  const fetchNotifications = useCallback(
    async ({ forceNotifications = false } = {}) => {
      setLoading(true);
      const hasToken = !!getStoredAuthToken();
      if (!currentUser || !hasToken) {
        setRequiresAuth(true);
        setNotifications([]);
        setError("");
        onSummaryChange?.({ total: 0, unread: 0, latest: null });
        setLoading(false);
        onAvailabilityChange?.(true);
        return;
      }

      setRequiresAuth(false);
      setError("");
      try {
        let data = null;
        const now = Date.now();
        const retryAt = nextNotificationRetryAtRef.current || 0;
        const allowNotifications =
          notificationsSupported ||
          (!notificationsSupported && retryAt && now >= retryAt) ||
          (forceNotifications && (!retryAt || now >= retryAt));

        if (allowNotifications) {
          data = await listNotifications({ perPage: 50 });
        } else {
          const fallbackLoaded = await loadInvitesFallback();
          setLoading(false);
          return;
        }

      const rawList = (() => {
        if (Array.isArray(data?.notifications)) return data.notifications;
        if (Array.isArray(data?.data)) return data.data;
        if (Array.isArray(data?.items)) return data.items;
        if (Array.isArray(data)) return data;
        return [];
      })();
      const normalized = rawList
        .map((item) => {
          try {
            return buildNotificationPresentation(item);
          } catch (err) {
            console.error("Failed to normalize notification", err, item);
            return null;
          }
        })
        .filter(Boolean)
        .sort((a, b) => {
          const aTime = a.createdAt ? a.createdAt.getTime() : 0;
          const bTime = b.createdAt ? b.createdAt.getTime() : 0;
          return bTime - aTime;
        });
      setNotifications(normalized);
      notificationsErrorLoggedRef.current = false;
      nextNotificationRetryAtRef.current = 0;
      const summary = {
        total:
          Number(data?.total ?? data?.count ?? normalized.length) || normalized.length,
        unread:
          Number(
            data?.unread ??
              data?.unread_count ??
              data?.meta?.unread ??
              data?.meta?.unread_count ??
              data?.summary?.unread ??
              0,
          ) || 0,
        latest: normalized[0]?.createdAt || null,
      };
      onSummaryChange?.(summary);
      onAvailabilityChange?.(true);
    } catch (err) {
      if (err?.status === 401 || err?.response?.status === 401) {
        setRequiresAuth(true);
        setNotifications([]);
        setError("");
        onSummaryChange?.({ total: 0, unread: 0, latest: null });
        onAvailabilityChange?.(true);
      } else {
        const fallbackLoaded = await loadInvitesFallback();
        if (!fallbackLoaded && !notificationsErrorLoggedRef.current) {
          console.error("Failed to load notifications", err);
          notificationsErrorLoggedRef.current = true;
        }
        const cooldownMs = forceNotifications ? 60000 : 5 * 60 * 1000;
        nextNotificationRetryAtRef.current = Date.now() + cooldownMs;
      }
    } finally {
      setLoading(false);
    }
    },
    [
      currentUser,
      loadInvitesFallback,
      notificationsSupported,
      onAvailabilityChange,
      onSummaryChange,
    ],
  );

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const filteredNotifications = useMemo(() => {
    const filter = filterDefinitions.find((definition) => definition.id === activeFilter);
    const predicate = filter?.predicate || (() => true);
    return notifications.filter(predicate);
  }, [activeFilter, notifications]);

  const groupedNotifications = useMemo(() => {
    if (filteredNotifications.length === 0) return [];
    const groups = [];
    filteredNotifications.forEach((notification) => {
      const heading = formatDateHeading(notification.createdAt || new Date());
      const existing = groups.find((group) => group.heading === heading);
      if (existing) {
        existing.items.push(notification);
      } else {
        groups.push({ heading, items: [notification] });
      }
    });
    return groups;
  }, [filteredNotifications]);

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Updates</h1>
          <p className="text-sm font-semibold text-gray-500">
            Stay on top of match activity, roster changes, and invite responses.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fetchNotifications({ forceNotifications: true })}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
            disabled={loading || requiresAuth}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCcw className="h-4 w-4" />
            )}
            <span>{loading ? "Refreshing" : "Refresh"}</span>
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {filterDefinitions.map((filter) => (
          <button
            key={filter.id}
            type="button"
            onClick={() => setActiveFilter(filter.id)}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
              activeFilter === filter.id
                ? "bg-emerald-500 text-white shadow"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {requiresAuth ? (
        <div className="mb-6 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-600 flex items-center gap-2">
          <Lock className="h-4 w-4" />
          <span>Sign in to see the latest updates on your matches.</span>
        </div>
      ) : (
        error && (
          <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-600 flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            <span>{error}</span>
          </div>
        )
      )}

      {!requiresAuth && loading && notifications.length === 0 ? (
        <ul className="space-y-4">
          {[...Array(3)].map((_, index) => (
            <li
              key={index}
              className="flex gap-4 rounded-3xl border border-gray-100 bg-white p-4 shadow-sm"
            >
              <div className="h-12 w-12 rounded-2xl bg-gray-100" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-2/3 rounded bg-gray-100" />
                <div className="h-3 w-full rounded bg-gray-100" />
                <div className="h-3 w-1/2 rounded bg-gray-100" />
              </div>
            </li>
          ))}
        </ul>
      ) : requiresAuth ? (
        <div className="rounded-3xl border border-dashed border-gray-200 bg-white px-6 py-12 text-center shadow-sm">
          <Lock className="mx-auto mb-3 h-10 w-10 text-gray-400" />
          <h2 className="text-lg font-black text-gray-900">Sign in to view updates</h2>
          <p className="mt-2 text-sm font-semibold text-gray-500">
            Log in to track match activity, roster changes, and invite responses.
          </p>
        </div>
      ) : filteredNotifications.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-gray-200 bg-white px-6 py-12 text-center shadow-sm">
          <Sparkles className="mx-auto mb-3 h-10 w-10 text-emerald-400" />
          <h2 className="text-lg font-black text-gray-900">You're all caught up</h2>
          <p className="mt-2 text-sm font-semibold text-gray-500">
            We'll let you know when there's new activity on your matches.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {groupedNotifications.map((group) => (
            <section key={group.heading}>
              <h3 className="mb-4 text-xs font-black uppercase tracking-wider text-gray-500">
                {group.heading}
              </h3>
              <ul className="space-y-4">
                {group.items.map((item) => {
                  const iconEntry = iconByType[item.canonicalType] || iconByType.general;
                  const IconComponent = iconEntry.icon;
                  return (
                    <li
                      key={item.id}
                      className="flex gap-4 rounded-3xl border border-gray-100 bg-white p-4 shadow-sm"
                    >
                      <div
                        className={`flex h-12 w-12 items-center justify-center rounded-2xl ${iconEntry.accent}`}
                        aria-hidden="true"
                      >
                        <IconComponent className="h-6 w-6" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-black text-gray-900">
                            {item.title}
                          </p>
                          {item.relativeTime && (
                            <span
                              className="text-xs font-semibold text-gray-400"
                              title={item.createdAtLabel}
                            >
                              {item.relativeTime}
                            </span>
                          )}
                        </div>
                        {item.body && (
                          <p className="mt-1 text-sm font-semibold text-gray-600">
                            {item.body}
                          </p>
                        )}
                        {item.details?.length > 0 && (
                          <ul className="mt-2 space-y-1 text-xs font-semibold text-gray-500">
                            {item.details.map((detail, detailIndex) => (
                              <li key={detailIndex} className="flex items-start gap-2">
                                <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-gray-300" aria-hidden="true" />
                                <span>{detail}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          {item.matchLabel && (
                            <span className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
                              <CalendarDays className="h-3.5 w-3.5" />
                              {item.matchLabel}
                              {item.startLabel ? ` • ${item.startLabel}` : ""}
                            </span>
                          )}
                          {item.tags?.map((tag) => (
                            <span
                              key={tag}
                              className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-600"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                        {item.matchId && onOpenMatch && (
                          <div className="mt-3">
                            <button
                              type="button"
                              onClick={() => onOpenMatch(item.matchId)}
                              className="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-gray-700"
                            >
                              View match details
                            </button>
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
};

export { buildNotificationPresentation, buildInviteNotification };
export default NotificationsFeed;
