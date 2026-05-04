import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  Calendar,
  Check,
  Clock,
  Copy,
  Download,
  EyeOff,
  Globe,
  Home,
  Lock,
  MapPin,
  MessageSquare,
  Phone,
  Edit,
  Plus,
  Search,
  Share2,
  Trophy,
  Users,
  Zap,
  X,
} from "lucide-react";
import PlayerAvatar from "./PlayerAvatar";
import Autocomplete from "react-google-autocomplete";
import {
  cancelMatch,
  createMatch,
  getShareLink,
  notifyMatchPlayers,
  searchPlayers,
  sendInvites,
  updateMatch,
} from "../services/matches";
import { downloadICSFile, openGoogleCalendar, openOutlookCalendar } from "../utils/calendar";
import {
  MATCH_FORMAT_OPTIONS,
  SKILL_LEVEL_OPTIONS,
} from "../utils/matchOptions";
import { combineDateAndTimeToIso } from "../utils/datetime";
import { getAvatarInitials, getAvatarUrlFromPlayer } from "../utils/avatar";
import {
  loadRecentLocations as loadStoredLocations,
  recordRecentLocation as persistRecentLocation,
  RECENT_LOCATIONS_EVENT,
} from "../utils/recentLocations";
import {
  loadRecentPlayers as loadStoredRecentPlayers,
  recordRecentPlayer as persistRecentPlayer,
  RECENT_PLAYERS_EVENT,
} from "../utils/recentPlayers";
import { getMatchGroup, listMatchGroups } from "../services/matchGroups";

const HOURS_IN_MS = 60 * 60 * 1000;
const MAX_PRIVATE_INVITES = 30;
const MAX_MATCH_PLAYERS = 16;

const pad = (value) => String(value).padStart(2, "0");

const formatLocalDate = (date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const formatLocalTime = (date) => `${pad(date.getHours())}:${pad(date.getMinutes())}`;

const defaultDateInfo = () => {
  const base = new Date();
  base.setDate(base.getDate() + 1);
  base.setHours(18, 0, 0, 0);
  return {
    date: formatLocalDate(base),
    time: formatLocalTime(base),
  };
};

const initialMatchData = () => {
  const { date, time } = defaultDateInfo();
  return {
    type: "open",
    date,
    startTime: time,
    duration: "2",
    location: "",
    latitude: null,
    longitude: null,
    totalPlayers: 4,
    skillLevel: "4.0",
    skillLevelMin: "3.0",
    skillLevelMax: "4.0",
    format: "Doubles",
    gender: "Any",
    balls: "Host provides",
    verifiedOnly: false,
    notes: "",
    invitedPlayers: [],
    manualInvitees: [],
    notifyPlayers: [],
    listingVisibility: "listed",
  };
};

const durations = [
  { value: "1", label: "1h" },
  { value: "1.5", label: "1.5h" },
  { value: "2", label: "2h" },
  { value: "2.5", label: "2.5h" },
  { value: "3", label: "3h" },
];

const skillLevels = SKILL_LEVEL_OPTIONS;
const matchFormatOptions = MATCH_FORMAT_OPTIONS;
const genderOptions = ["Any", "Men's", "Women's", "Mixed"];
const ballsOptions = ["Host provides", "BYO", "Rotate"];

const MIN_START_TIME = "06:00";
const MAX_START_TIME = "22:00";

const toMinutes = (timeValue) => {
  const [h, m] = timeValue.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return NaN;
  return h * 60 + m;
};

const clampTimeToRange = (value) => {
  if (!value) return "";
  const [hourStr, minuteStr] = value.split(":");
  const hours = Number(hourStr);
  const minutes = Number(minuteStr);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return "";

  const minMinutes = toMinutes(MIN_START_TIME);
  const maxMinutes = toMinutes(MAX_START_TIME);
  const rawMinutes = hours * 60 + minutes;
  const clampedMinutes = Math.min(Math.max(rawMinutes, minMinutes), maxMinutes);

  const clampedHours = Math.floor(clampedMinutes / 60);
  const clampedMins = clampedMinutes % 60;

  return `${String(clampedHours).padStart(2, "0")}:${String(clampedMins).padStart(2, "0")}`;
};

const formatTimeDisplay = (time24) => {
  if (!time24) return "";
  const [hStr, minutes] = time24.split(":");
  const hours = Number(hStr);
  if (Number.isNaN(hours)) return time24;
  const hour12 = hours % 12 || 12;
  const ampm = hours >= 12 ? "PM" : "AM";
  return `${hour12}:${minutes} ${ampm}`;
};

const formatDateDisplay = (dateStr) => {
  if (!dateStr) return "";
  const date = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
};

const formatRelativeDate = (isoValue) => {
  if (!isoValue) return "Recently active";
  const target = new Date(isoValue);
  if (Number.isNaN(target.getTime())) return "Recently active";
  const diffMs = Date.now() - target.getTime();
  if (diffMs < 0) return "Upcoming";
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "1 day ago";
  if (diffDays < 7) return `${diffDays} days ago`;
  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks === 1) return "1 week ago";
  if (diffWeeks < 5) return `${diffWeeks} weeks ago`;
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths === 1) return "1 month ago";
  return `${diffMonths} months ago`;
};

const normalizePhoneValue = (value) => {
  if (!value) return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("+")) {
    const cleaned = `+${trimmed.slice(1).replace(/\D/g, "")}`;
    return cleaned.length > 1 ? cleaned : "";
  }
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
};

const formatPhoneDisplay = (value) => {
  if (!value) return "";
  const digits = value.replace(/\D/g, "");
  const clean = digits.length === 11 && digits.startsWith("1")
    ? digits.slice(1)
    : digits;
  if (clean.length === 10) {
    return `(${clean.slice(0, 3)}) ${clean.slice(3, 6)}-${clean.slice(6)}`;
  }
  return value;
};

const normalizePlayer = (player) => {
  const id = Number(player?.user_id ?? player?.id);
  const name = player?.full_name || player?.name || player?.email || "Player";
  const ntrp = player?.skill_level || player?.ntrp || "";
  const lastPlayed =
    player?.last_match_at || player?.last_played_at || player?.last_active_at;
  return {
    id,
    name,
    email: player?.email || "",
    ntrp,
    avatar: getAvatarInitials(name, player?.email),
    avatarUrl: getAvatarUrlFromPlayer(player),
    lastPlayed: formatRelativeDate(lastPlayed),
    raw: player,
  };
};

const quickDateOptions = () => {
  const today = new Date();
  const makeOption = (offset) => {
    const d = new Date(today);
    d.setDate(d.getDate() + offset);
    return {
      value: `offset-${offset}`,
      label: d.toLocaleDateString("en-US", { weekday: "long" }),
      date: formatLocalDate(d),
    };
  };
  return [makeOption(0), makeOption(1), makeOption(2), makeOption(3)];
};
const stepTitles = {
  1: "Match basics",
  2: "Match details",
  3: "Review & publish",
};

const ProgressBar = ({ currentStep }) => (
  <div className="mb-8 flex items-center">
    {[
      { step: 1, label: "Basics" },
      { step: 2, label: "Details" },
      { step: 3, label: "Review" },
    ].map((item, index, items) => {
      const complete = item.step < currentStep;
      const active = item.step === currentStep;
      return (
        <React.Fragment key={item.step}>
          <div className="flex items-center gap-3">
            <div
              className={`flex h-11 w-11 items-center justify-center rounded-full border-2 text-sm font-black transition-colors ${
                complete || active
                  ? "border-violet-200 bg-violet-500 text-white shadow-[0_0_0_4px_rgba(139,92,246,0.12)]"
                  : "border-slate-100 bg-slate-50 text-slate-400"
              }`}
            >
              {complete ? <Check size={18} /> : item.step}
            </div>
            <span className={`text-[15px] font-bold ${active || complete ? "text-slate-900" : "text-slate-400"}`}>
              {item.label}
            </span>
          </div>
          {index < items.length - 1 && (
            <div className="mx-4 h-[3px] flex-1 rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full transition-all ${
                  currentStep > item.step ? "w-full bg-violet-500" : "w-0 bg-violet-500"
                }`}
              />
            </div>
          )}
        </React.Fragment>
      );
    })}
  </div>
);

const MatchCreatorFlow = ({ onCancel, onReturnHome, onMatchCreated, currentUser }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [matchData, setMatchData] = useState(initialMatchData);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [shareLink, setShareLink] = useState("");
  const [creating, setCreating] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [createdMatchId, setCreatedMatchId] = useState(null);
  const [isEditingExisting, setIsEditingExisting] = useState(false);
  const [toast, setToast] = useState(null);
  const [quickDates] = useState(() => quickDateOptions());
  const [contactFirstName, setContactFirstName] = useState("");
  const [contactLastName, setContactLastName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactError, setContactError] = useState("");
  const [isFormatManuallySelected, setIsFormatManuallySelected] = useState(false);
  const [recentLocations, setRecentLocations] = useState(() => loadStoredLocations());
  const [recentPlayers, setRecentPlayers] = useState(() => loadStoredRecentPlayers());
  const [matchGroups, setMatchGroups] = useState([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [notifySearch, setNotifySearch] = useState("");
  const [notifyResults, setNotifyResults] = useState([]);
  const [notifyLoading, setNotifyLoading] = useState(false);
  const [notifyPanelOpen, setNotifyPanelOpen] = useState(false);

  useEffect(() => {
    const syncRecentLocations = () => {
      setRecentLocations(loadStoredLocations());
    };

    syncRecentLocations();

    if (typeof window === "undefined") {
      return undefined;
    }

    window.addEventListener("storage", syncRecentLocations);
    window.addEventListener(RECENT_LOCATIONS_EVENT, syncRecentLocations);

    return () => {
      window.removeEventListener("storage", syncRecentLocations);
      window.removeEventListener(RECENT_LOCATIONS_EVENT, syncRecentLocations);
    };
  }, [loadStoredLocations]);

  useEffect(() => {
    const syncRecentPlayers = () => {
      setRecentPlayers(loadStoredRecentPlayers());
    };

    syncRecentPlayers();

    if (typeof window === "undefined") {
      return undefined;
    }

    window.addEventListener("storage", syncRecentPlayers);
    window.addEventListener(RECENT_PLAYERS_EVENT, syncRecentPlayers);

    return () => {
      window.removeEventListener("storage", syncRecentPlayers);
      window.removeEventListener(RECENT_PLAYERS_EVENT, syncRecentPlayers);
    };
  }, [loadStoredRecentPlayers]);

  useEffect(() => {
    if (matchData.type !== "private" && matchData.type !== "open") return;
    let cancelled = false;
    const loadGroups = async () => {
      try {
        setGroupsLoading(true);
        const data = await listMatchGroups();
        if (!cancelled) {
          setMatchGroups(Array.isArray(data?.groups) ? data.groups : []);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to load match groups", error);
          setMatchGroups([]);
        }
      } finally {
        if (!cancelled) setGroupsLoading(false);
      }
    };
    loadGroups();
    return () => {
      cancelled = true;
    };
  }, [matchData.type]);

  const currentUserAvatarUrl = useMemo(
    () => getAvatarUrlFromPlayer(currentUser),
    [currentUser],
  );
  const currentUserId = useMemo(() => {
    if (!currentUser || typeof currentUser !== "object") return null;
    const id = Number(
      currentUser.id ?? currentUser.user_id ?? currentUser.userId ?? currentUser.profile_id,
    );
    return Number.isFinite(id) ? id : null;
  }, [currentUser]);
  const currentUserFirstName = useMemo(() => {
    const rawName = typeof currentUser?.name === "string" ? currentUser.name.trim() : "";
    return rawName ? rawName.split(/\s+/)[0] : "The host";
  }, [currentUser]);

  const showToast = useCallback((message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2500);
  }, []);

  const resetFlow = useCallback(() => {
    setMatchData(initialMatchData());
    setSearchQuery("");
    setSearchResults([]);
    setShareLink("");
    setCreatedMatchId(null);
    setIsEditingExisting(false);
    setCurrentStep(1);
    setContactFirstName("");
    setContactLastName("");
    setContactPhone("");
    setContactError("");
    setIsFormatManuallySelected(false);
  }, []);

  const invitedPlayers = useMemo(
    () => matchData.invitedPlayers || [],
    [matchData.invitedPlayers]
  );

  const notifyPlayers = useMemo(
    () => matchData.notifyPlayers || [],
    [matchData.notifyPlayers],
  );

  const manualInvitees = useMemo(
    () => matchData.manualInvitees || [],
    [matchData.manualInvitees]
  );

  const combinedInvitees = useMemo(
    () => [
      ...invitedPlayers.map((player) => ({
        type: "player",
        id: player.id,
        name: player.name,
        avatar: player.avatar,
        avatarUrl: player.avatarUrl,
        subtitle: [
          player.ntrp ? `NTRP ${player.ntrp}` : "",
          player.lastPlayed ? `Played ${player.lastPlayed}` : "",
        ]
          .filter(Boolean)
          .join(" • "),
      })),
      ...manualInvitees.map((contact) => ({
        type: "contact",
        id: contact.id,
        name: contact.name || formatPhoneDisplay(contact.phone),
        avatar:
          contact.name?.charAt(0).toUpperCase() ||
          contact.displayPhone?.charAt(0) ||
          "📱",
        subtitle: formatPhoneDisplay(contact.phone),
      })),
    ],
    [invitedPlayers, manualInvitees]
  );

  const quickAddPlayers = useMemo(
    () =>
      recentPlayers.filter((player) => {
        const normalizedId = Number(player?.id);
        if (!Number.isFinite(normalizedId)) return false;
        if (currentUserId !== null && normalizedId === currentUserId) {
          return false;
        }
        return true;
      }),
    [recentPlayers, currentUserId],
  );

  const quickNotifyPlayers = useMemo(
    () =>
      quickAddPlayers.filter((player) => {
        const normalizedId = Number(player?.id);
        if (!Number.isFinite(normalizedId)) return false;
        return !notifyPlayers.some((invitee) => invitee.id === normalizedId);
      }),
    [notifyPlayers, quickAddPlayers],
  );
  const visibleNotifyGroups = useMemo(() => matchGroups.slice(0, 3), [matchGroups]);
  const visibleSuggestedNotifyPlayers = useMemo(
    () => quickNotifyPlayers.slice(0, 4),
    [quickNotifyPlayers],
  );

  const invitedCount = combinedInvitees.length;
  const totalPlayers = matchData.totalPlayers || 4;
  const isLinkOnlyListing = matchData.listingVisibility === "link_only";

  const canInviteMore = useCallback(() => {
    if (matchData.type !== "private") return false;
    return invitedCount < MAX_PRIVATE_INVITES;
  }, [invitedCount, matchData.type]);

  const combineDateTime = useCallback(
    () => combineDateAndTimeToIso(matchData.date, matchData.startTime),
    [matchData.date, matchData.startTime],
  );

  const handleTimeChange = useCallback(
    (value) => {
      setMatchData((prev) => ({
        ...prev,
        startTime: value ? clampTimeToRange(value) : "",
      }));
    },
    [setMatchData],
  );

  const recordRecentLocation = useCallback(
    (locationLabel, latitude, longitude) => {
      const next = persistRecentLocation(locationLabel, latitude, longitude);
      setRecentLocations(next);
    },
    [persistRecentLocation, setRecentLocations],
  );

  const handleUseRecentLocation = useCallback((entry) => {
    if (!entry?.label) return;
    setMatchData((prev) => ({
      ...prev,
      location: entry.label,
      latitude: typeof entry.latitude === "number" ? entry.latitude : null,
      longitude: typeof entry.longitude === "number" ? entry.longitude : null,
    }));
  }, []);

  const handleAddPlayer = (player) => {
    const normalized = normalizePlayer(player);
    if (!Number.isFinite(normalized.id)) return;
    if (invitedPlayers.some((p) => p.id === normalized.id)) return;
    setMatchData((prev) => ({
      ...prev,
      invitedPlayers: [...invitedPlayers, normalized],
    }));
    setSearchQuery("");
    const nextRecent = persistRecentPlayer(normalized);
    setRecentPlayers(nextRecent);
  };

  const handleAddNotifyPlayer = useCallback((player) => {
    const normalized = normalizePlayer(player);
    if (!Number.isFinite(normalized.id)) return;
    setMatchData((prev) => {
      const existing = prev.notifyPlayers || [];
      if (existing.some((item) => item.id === normalized.id)) {
        return prev;
      }
      return {
        ...prev,
        notifyPlayers: [...existing, normalized],
      };
    });
    setNotifySearch("");
    setNotifyResults([]);
    const nextRecent = persistRecentPlayer(normalized);
    setRecentPlayers(nextRecent);
  }, []);

  const handleRemoveNotifyPlayer = useCallback((playerId) => {
    setMatchData((prev) => ({
      ...prev,
      notifyPlayers: (prev.notifyPlayers || []).filter((player) => player.id !== playerId),
    }));
  }, []);

  const getGroupNotifyCount = useCallback(
    (group) => {
      const memberIds = Array.isArray(group?.members)
        ? group.members
            .map((member) => Number(member?.player_id ?? member?.user_id ?? member?.id))
            .filter((id) => Number.isFinite(id))
        : [];
      if (memberIds.length === 0) return 0;
      const selectedIds = new Set(notifyPlayers.map((player) => Number(player.id)));
      return memberIds.filter((id) => selectedIds.has(id)).length;
    },
    [notifyPlayers],
  );

  const handleNotifyGroup = useCallback(
    async (groupId) => {
      try {
        const group = await getMatchGroup(groupId);
        const members = Array.isArray(group?.members) ? group.members : [];
        const existingIds = new Set(notifyPlayers.map((player) => Number(player.id)));
        const toAdd = members
          .map((member) =>
            normalizePlayer({
              ...member,
              id: member.player_id ?? member.user_id ?? member.id,
            }),
          )
          .filter((member) => {
            if (!Number.isFinite(member.id)) return false;
            if (currentUserId !== null && Number(member.id) === currentUserId) return false;
            return !existingIds.has(Number(member.id));
          })
          .map((member) => ({
            ...member,
            fromGroupName: group?.name || "",
          }));

        if (!toAdd.length) {
          showToast("Everyone in that group is already selected.", "info");
          return;
        }

        setMatchData((prev) => ({
          ...prev,
          notifyPlayers: [...(prev.notifyPlayers || []), ...toAdd],
        }));
        toAdd.forEach((player) => {
          persistRecentPlayer(player);
        });
        setRecentPlayers(loadStoredRecentPlayers());
        showToast(`Added ${toAdd.length} player${toAdd.length === 1 ? "" : "s"} to notify.`);
      } catch (error) {
        console.error(error);
        showToast(error.message || "Failed to load group players", "error");
      }
    },
    [currentUserId, notifyPlayers, showToast],
  );

  const handleInviteGroup = async (groupId) => {
    if (!canInviteMore()) return;
    try {
      const group = await getMatchGroup(groupId);
      const members = Array.isArray(group?.members) ? group.members : [];
      const normalizedMembers = members
        .map((member) =>
          normalizePlayer({
            ...member,
            id: member.player_id ?? member.user_id ?? member.id,
          }),
        )
        .filter((member) => Number.isFinite(member.id));
      const existingIds = new Set(invitedPlayers.map((player) => Number(player.id)));
      const remainingCapacity = Math.max(MAX_PRIVATE_INVITES - invitedCount, 0);
      const toAdd = normalizedMembers
        .filter((member) => {
          if (currentUserId !== null && Number(member.id) === currentUserId) return false;
          return !existingIds.has(Number(member.id));
        })
        .slice(0, remainingCapacity);
      if (!toAdd.length) {
        showToast("Everyone in that group is already selected.", "info");
        return;
      }
      setMatchData((prev) => ({
        ...prev,
        invitedPlayers: [...(prev.invitedPlayers || []), ...toAdd],
      }));
      toAdd.forEach((player) => {
        persistRecentPlayer(player);
      });
      setRecentPlayers(loadStoredRecentPlayers());
      showToast(`Added ${toAdd.length} player${toAdd.length === 1 ? "" : "s"} from group.`);
    } catch (error) {
      console.error(error);
      showToast(error.message || "Failed to invite group", "error");
    }
  };

  const handleRemovePlayer = (playerId) => {
    setMatchData((prev) => ({
      ...prev,
      invitedPlayers: invitedPlayers.filter((p) => p.id !== playerId),
    }));
  };

  const handleAddManualInvite = () => {
    setContactError("");
    const firstName = contactFirstName.trim();
    const lastName = contactLastName.trim();
    if (!firstName || !lastName) {
      setContactError("First name and last name are required for SMS invites.");
      return;
    }
    if (/\s/.test(firstName)) {
      setContactError("Use the first-name field for first name only.");
      return;
    }
    const normalized = normalizePhoneValue(contactPhone);
    if (!normalized) {
      setContactError("Enter a valid phone number with country code or 10 digits.");
      return;
    }
    if (manualInvitees.some((invite) => invite.phone === normalized)) {
      setContactError("That phone number is already on your invite list.");
      return;
    }
    const name = `${firstName} ${lastName}`;
    setMatchData((prev) => ({
      ...prev,
      manualInvitees: [
        ...(prev.manualInvitees || []),
        {
          id: `phone:${normalized}`,
          phone: normalized,
          displayPhone: formatPhoneDisplay(normalized),
          name,
          firstName,
          lastName,
        },
      ],
    }));
    setContactFirstName("");
    setContactLastName("");
    setContactPhone("");
  };

  const handleRemoveManualInvite = (id) => {
    setMatchData((prev) => ({
      ...prev,
      manualInvitees: (prev.manualInvitees || []).filter((invite) => invite.id !== id),
    }));
  };

  const nextStep = () => {
    if (currentStep === 1) {
      if (!matchData.date || !matchData.startTime) {
        showToast("Select a date and time", "error");
        return;
      }
      if (!matchData.location) {
        showToast("Add a location", "error");
        return;
      }
    }
    if (
      currentStep === 2 &&
      matchData.type === "open" &&
      (!matchData.skillLevelMin || !matchData.skillLevelMax)
    ) {
      showToast("Select a skill range", "error");
      return;
    }
    if (currentStep === 2 && matchData.type === "private" && invitedCount === 0) {
      showToast("Invite at least one player", "error");
      return;
    }
    setCurrentStep((prev) => Math.min(prev + 1, 5));
  };

  const prevStep = () => setCurrentStep((prev) => Math.max(prev - 1, 1));
  const handlePublish = async () => {
    if (creating) return;
    const isoStart = combineDateTime();
    if (!isoStart) {
      showToast("Invalid start time", "error");
      return;
    }

    const payload = {
      status: "upcoming",
      match_type: matchData.type === "private" ? "private" : "open",
      start_date_time: isoStart,
      durationMinutes: Math.round(parseFloat(matchData.duration || "2") * 60),
      duration_minutes: Math.round(parseFloat(matchData.duration || "2") * 60),
      location_text: matchData.location,
      latitude: matchData.latitude ?? undefined,
      longitude: matchData.longitude ?? undefined,
      player_limit: matchData.totalPlayers,
      match_format: matchData.format,
      notes: matchData.notes || undefined,
    };

    if (matchData.type === "open") {
      payload.skill_level_min = matchData.skillLevelMin || matchData.skillLevel;
      payload.skill_level_max =
        matchData.skillLevelMax || matchData.skillLevelMin || matchData.skillLevel;
      payload.gender = matchData.gender;
      payload.category = matchData.gender;
      payload.balls = matchData.balls;
      payload.verifiedOnly = Boolean(matchData.verifiedOnly);
      payload.verified_only = Boolean(matchData.verifiedOnly);
    }

    if (matchData.type === "open") {
      const isHiddenMatch = matchData.listingVisibility === "link_only";
      payload.hidden = isHiddenMatch;
      payload.is_hidden = isHiddenMatch;
      payload.listing_visibility = isHiddenMatch ? "link_only" : "listed";
      if (isHiddenMatch) {
        payload.visibility = "hidden";
        payload.match_visibility = "hidden";
      }
    }

    setCreating(true);
    let inviteMessage = "";
    try {
      if (createdMatchId && isEditingExisting) {
        await updateMatch(createdMatchId, payload);
        recordRecentLocation(matchData.location, matchData.latitude, matchData.longitude);
        let link = shareLink;
        if (!link) {
          try {
            const { shareUrl } = await getShareLink(createdMatchId);
            link = shareUrl || "";
          } catch (error) {
            console.warn("Failed to refresh share link", error);
          }
        }
        if (link) setShareLink(link);
        setCurrentStep(5);
        setIsEditingExisting(false);
        showToast("Match updated");
        return;
      }

      const result = await createMatch(payload);
      const created = result?.match || result;
      const matchId = created?.id || created?.match_id;
      if (!matchId) throw new Error("Match created but no ID returned");

      if (matchData.type === "open" && notifyPlayers.length > 0) {
        const playerIds = notifyPlayers
          .map((player) => Number(player.id))
          .filter((id) => Number.isFinite(id));
        if (playerIds.length) {
          await notifyMatchPlayers(matchId, { playerIds });
        }
      }

      if (matchData.type === "private" && invitedCount > 0) {
        const ids = invitedPlayers
          .map((p) => Number(p.id))
          .filter((id) => Number.isFinite(id));
        const phoneNumbers = manualInvitees.map((invite) => ({
          phone: invite.phone,
          firstName: invite.firstName,
          lastName: invite.lastName,
          fullName: invite.name,
        }));
        if (ids.length || phoneNumbers.length) {
          try {
            const response = await sendInvites(matchId, {
              playerIds: ids,
              phoneNumbers,
            });
            inviteMessage = response?.message || inviteMessage;
          } catch (inviteError) {
            if (
              inviteError.data?.error === "invalid_phone_numbers" &&
              Array.isArray(inviteError.data?.details)
            ) {
              throw new Error(
                `Invalid phone numbers: ${inviteError.data.details.join(", ")}`
              );
            }
            throw inviteError;
          }
        }
      }

      let link = result?.shareUrl || "";
      if (!link) {
        try {
          const { shareUrl } = await getShareLink(matchId);
          link = shareUrl || "";
        } catch (error) {
          console.warn("Failed to load share link", error);
        }
      }
      if (!link) link = `${window.location.origin}/#/matches/${matchId}`;

      setShareLink(link);
      setCreatedMatchId(matchId);
      recordRecentLocation(matchData.location, matchData.latitude, matchData.longitude);
      setCurrentStep(4);
      onMatchCreated?.(matchId);
      const successMessage = inviteMessage
        ? `Match created successfully! ${inviteMessage}`
        : "Match created successfully!";
      showToast(successMessage);
    } catch (error) {
      console.error(error);
      showToast(error.message || "Failed to create match", "error");
    } finally {
      setCreating(false);
    }
  };

  const handleEditMatch = () => {
    if (!createdMatchId) {
      showToast("Create the match before editing", "error");
      return;
    }
    setIsEditingExisting(true);
    setCurrentStep(1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleCancelMatch = async () => {
    if (!createdMatchId) {
      showToast("No match to cancel", "error");
      return;
    }
    const confirmed = window.confirm("Are you sure you want to cancel this match?");
    if (!confirmed) return;
    setCancelling(true);
    try {
      await cancelMatch(createdMatchId);
      showToast("Match cancelled");
      resetFlow();
      onReturnHome?.();
    } catch (error) {
      console.error(error);
      showToast(error.message || "Failed to cancel match", "error");
    } finally {
      setCancelling(false);
    }
  };

  const buildShareMessage = useCallback(
    () =>
      `Join my ${matchData.format} match on ${formatDateDisplay(matchData.date)} at ${formatTimeDisplay(
        matchData.startTime,
      )} at ${matchData.location}.`,
    [matchData.format, matchData.date, matchData.startTime, matchData.location]
  );

  const handleShare = (method) => {
    if (!shareLink) {
      showToast("Share link not ready", "error");
      return;
    }
    const message = `${buildShareMessage()} ${shareLink}`;
    if (method === "sms") {
      window.open(`sms:?body=${encodeURIComponent(message)}`);
    } else if (method === "email") {
      const subject = encodeURIComponent("Tennis Match Invitation");
      window.location.href = `mailto:?subject=${subject}&body=${encodeURIComponent(message)}`;
    } else if (method === "copy") {
      navigator.clipboard.writeText(shareLink);
      showToast("Link copied");
    }
  };

  const handleNavigatorShare = () => {
    if (!shareLink || !navigator?.share) {
      handleShare("copy");
      return;
    }
    navigator
      .share({
        title: "Tennis Match",
        text: buildShareMessage(),
        url: shareLink,
      })
      .catch(() => {
        showToast("Share cancelled", "error");
      });
  };

  const handleAddToCalendar = (type) => {
    const isoStart = combineDateTime();
    if (!isoStart) {
      showToast("Add match details first", "error");
      return;
    }

    const start = new Date(isoStart);
    const durationHours = parseFloat(matchData.duration || "1");
    const end = new Date(start.getTime() + durationHours * HOURS_IN_MS);
    const title = `Tennis Match - ${matchData.format}`;
    let description = `${matchData.format} match at ${matchData.location}.`;
    if (matchData.type === "open" && matchData.skillLevelMin) {
      const max = matchData.skillLevelMax || matchData.skillLevelMin;
      description += ` Skill level: NTRP ${matchData.skillLevelMin}${
        max !== matchData.skillLevelMin ? `-${max}` : ""
      }.`;
    }
    if (matchData.notes) description += ` ${matchData.notes}`;

    const details = {
      title,
      description,
      location: matchData.location,
      start,
      end,
    };

    try {
      if (type === "google") {
        openGoogleCalendar(details);
        return;
      }
      if (type === "outlook") {
        openOutlookCalendar(details);
        return;
      }
      downloadICSFile(details);
    } catch (error) {
      console.error(error);
      showToast("Unable to open calendar. Please try again.", "error");
    }
  };

  const goBackToHome = () => {
    resetFlow();
    onReturnHome?.();
  };

  useEffect(() => {
    if (isFormatManuallySelected) return;

    setMatchData((prev) => {
      if (prev.totalPlayers === 2 && prev.format !== "Singles") {
        return { ...prev, format: "Singles" };
      }

      if (prev.totalPlayers > 2 && prev.format === "Singles") {
        return { ...prev, format: "Doubles" };
      }

      return prev;
    });
  }, [isFormatManuallySelected, matchData.totalPlayers, setMatchData]);

  useEffect(() => {
    if (currentStep !== 2) return;
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [currentStep]);

  useEffect(() => {
    if (!searchQuery) {
      setSearchResults([]);
      setSearchError("");
      return;
    }
    const handler = setTimeout(() => {
      let alive = true;
      setSearchLoading(true);
      searchPlayers({ search: searchQuery, page: 1, perPage: 8 })
        .then((data) => {
          if (!alive) return;
          const players = (data.players || []).map(normalizePlayer);
          setSearchResults(players);
          setSearchError("");
        })
        .catch((error) => {
          console.error(error);
          if (!alive) return;
          setSearchResults([]);
          setSearchError("Failed to load players");
        })
        .finally(() => {
          if (alive) setSearchLoading(false);
        });
      return () => {
        alive = false;
      };
    }, 300);

    return () => clearTimeout(handler);
  }, [searchQuery]);

  useEffect(() => {
    if (currentStep !== 2 || matchData.type !== "open") {
      setNotifyResults([]);
      setNotifyLoading(false);
      return;
    }

    const query = notifySearch.trim();
    if (query.length < 2) {
      setNotifyResults([]);
      setNotifyLoading(false);
      return;
    }

    let alive = true;
    setNotifyLoading(true);
    const handler = setTimeout(() => {
      searchPlayers({ search: query, page: 1, perPage: 8 })
        .then((data) => {
          if (!alive) return;
          const selectedIds = new Set(notifyPlayers.map((player) => Number(player.id)));
          const players = (data.players || [])
            .map(normalizePlayer)
            .filter((player) => {
              const normalizedId = Number(player.id);
              if (!Number.isFinite(normalizedId)) return false;
              if (currentUserId !== null && normalizedId === currentUserId) return false;
              return !selectedIds.has(normalizedId);
            });
          setNotifyResults(players);
        })
        .catch((error) => {
          console.error(error);
          if (!alive) return;
          setNotifyResults([]);
        })
        .finally(() => {
          if (alive) setNotifyLoading(false);
        });
    }, 250);

    return () => {
      alive = false;
      clearTimeout(handler);
    };
  }, [currentStep, currentUserId, matchData.type, notifyPlayers, notifySearch]);

  useEffect(() => {
    if (matchData.type !== "open") {
      setNotifyPanelOpen(false);
      return;
    }
    if (notifyPlayers.length > 0) {
      setNotifyPanelOpen(true);
    }
  }, [matchData.type, notifyPlayers.length]);

  const modalTitle =
    currentStep === 1
      ? stepTitles[1]
      : currentStep === 2
        ? matchData.type === "private"
          ? "Invite players"
          : stepTitles[2]
        : stepTitles[3];
  return (
    <div className="min-h-screen bg-slate-900/30 px-3 py-4 backdrop-blur-[2px] md:px-5 md:py-8">
      {toast && (
        <div
          className={`fixed top-5 left-1/2 -translate-x-1/2 rounded-lg px-4 py-2 shadow-lg z-50 text-sm font-semibold ${
            toast.type === "error" ? "bg-red-500 text-white" : "bg-gray-900 text-white"
          }`}
        >
          {toast.message}
        </div>
      )}

      <div className="mx-auto flex max-h-[90vh] w-full max-w-[680px] flex-col overflow-hidden rounded-2xl bg-white shadow-[0_22px_54px_rgba(0,0,0,0.24)]">
        <div className="border-b border-slate-100 px-5 py-4 md:px-6 md:py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.12em] text-violet-500">
                New Match
              </div>
              <h1 className="mt-1 text-[26px] font-black text-slate-900 md:text-[28px]">
                {modalTitle}
              </h1>
            </div>
            <button
              type="button"
              onClick={onCancel}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
              aria-label="Close create match"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">

      {currentStep === 1 && (
        <div className="px-5 py-5 md:px-6 md:py-6">
          <ProgressBar currentStep={currentStep} />

          <div className="space-y-6">
          <div>
            <h3 className="mb-3 text-xs font-black uppercase tracking-[0.12em] text-slate-500">
              Match Type
            </h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <button
                onClick={() =>
                  setMatchData((prev) => ({ ...prev, type: "open", invitedPlayers: [] }))
                }
                className={`rounded-[18px] border-[2px] px-4 py-4 text-left transition-all ${
                  matchData.type === "open"
                    ? "border-violet-500 bg-violet-50 shadow-[0_0_0_3px_rgba(139,92,246,0.08)]"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
                      matchData.type === "open" ? "bg-violet-500 text-white" : "bg-slate-50 text-slate-400"
                    }`}
                  >
                    <Globe size={20} />
                  </div>
                  <div className="flex-1">
                    <div className="text-[16px] font-black text-slate-900">Open match</div>
                    <div className="text-[14px] font-medium text-slate-500">
                      Anyone with the right level can join
                    </div>
                  </div>
                  {matchData.type === "open" && (
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-500 text-white">
                      <Check size={14} />
                    </div>
                  )}
                </div>
              </button>
              <button
                onClick={() =>
                  setMatchData((prev) => ({ ...prev, type: "private", skillLevel: "4.0" }))
                }
                className={`rounded-[18px] border-[2px] px-4 py-4 text-left transition-all ${
                  matchData.type === "private"
                    ? "border-violet-500 bg-violet-50 shadow-[0_0_0_3px_rgba(139,92,246,0.08)]"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
                      matchData.type === "private" ? "bg-violet-500 text-white" : "bg-slate-50 text-slate-400"
                    }`}
                  >
                    <Lock size={20} />
                  </div>
                  <div className="flex-1">
                    <div className="text-[16px] font-black text-slate-900">Private match</div>
                    <div className="text-[14px] font-medium text-slate-500">
                      Invite specific players only
                    </div>
                  </div>
                  {matchData.type === "private" && (
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-500 text-white">
                      <Check size={14} />
                    </div>
                  )}
                </div>
              </button>
            </div>
          </div>

          <div>
            <div className="mb-4">
              <label className="mb-2 block text-sm font-black uppercase tracking-[0.12em] text-slate-500">
                Quick Pick
              </label>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {quickDates.map((day) => (
                  <button
                    key={day.value}
                    onClick={() => setMatchData((prev) => ({ ...prev, date: day.date }))}
                  className={`flex-shrink-0 rounded-full border px-4 py-2 text-[14px] font-bold transition-colors ${
                      matchData.date === day.date
                        ? "border-violet-500 bg-violet-500 text-white"
                        : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                    }`}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div>
                <label className="mb-2 block text-xs font-black uppercase tracking-[0.12em] text-slate-500">Date</label>
                <input
                  type="date"
                  value={matchData.date}
                  onChange={(e) => setMatchData((prev) => ({ ...prev, date: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-[16px] font-bold text-slate-900 focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
                />
              </div>
              <div>
                <label className="mb-2 block text-xs font-black uppercase tracking-[0.12em] text-slate-500">Time</label>
                <input
                  type="time"
                  min={MIN_START_TIME}
                  max={MAX_START_TIME}
                  value={matchData.startTime}
                  onChange={(e) => handleTimeChange(e.target.value)}
                  onBlur={(e) => handleTimeChange(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-[16px] font-bold text-slate-900 focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
                />
              </div>
              <div>
                <label className="mb-2 block text-xs font-black uppercase tracking-[0.12em] text-slate-500">Duration</label>
                <select
                  value={matchData.duration}
                  onChange={(e) => setMatchData((prev) => ({ ...prev, duration: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-[16px] font-bold text-slate-900 focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
                >
                  {durations.map((duration) => (
                    <option key={duration.value} value={duration.value}>
                      {duration.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <div className="grid gap-5 md:grid-cols-[1.3fr_.8fr]">
          <div>
            <h3 className="mb-3 text-xs font-black uppercase tracking-[0.12em] text-slate-500">
              Location
            </h3>
            {recentLocations.length > 0 && (
              <div className="mb-4">
                <label className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
                  RECENT LOCATIONS
                </label>
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {recentLocations.map((location) => {
                    const isActive =
                      matchData.location?.trim().toLowerCase() ===
                      location.label.toLowerCase();
                    return (
                      <button
                        key={location.label}
                        type="button"
                        onClick={() => handleUseRecentLocation(location)}
                        className={`px-3 py-2 rounded-lg text-sm border transition-colors whitespace-nowrap flex items-center gap-2 ${
                          isActive
                            ? "bg-violet-600 text-white border-violet-600"
                            : "bg-gray-100 text-gray-600 border-transparent hover:bg-gray-200"
                        }`}
                        title={`Use ${location.label}`}
                      >
                        <MapPin size={14} />
                        {location.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <div className="relative">
              <MapPin size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <Autocomplete
                apiKey={import.meta.env.VITE_GOOGLE_API_KEY}
                value={matchData.location}
                onChange={(e) =>
                  setMatchData((prev) => ({
                    ...prev,
                    location: e.target.value,
                    latitude: null,
                    longitude: null,
                  }))
                }
                onPlaceSelected={(place) => {
                  const placeName =
                    typeof place?.name === "string" ? place.name.trim() : "";
                  const formattedAddress =
                    typeof place?.formatted_address === "string"
                      ? place.formatted_address.trim()
                      : "";
                  const locationLabel =
                    placeName || formattedAddress || matchData.location || "";
                  const lat = place.geometry?.location?.lat?.();
                  const lng = place.geometry?.location?.lng?.();
                  setMatchData((prev) => ({
                    ...prev,
                    location: locationLabel,
                    latitude: typeof lat === "number" ? lat : prev.latitude,
                    longitude: typeof lng === "number" ? lng : prev.longitude,
                  }));
                }}
                options={{
                  types: ["establishment"],
                  fields: ["formatted_address", "geometry", "name"],
                }}
                className="w-full rounded-xl border border-slate-200 py-3 pl-11 pr-4 text-[16px] font-semibold text-slate-900 focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
                placeholder="e.g., Oceanside Tennis Center"
              />
            </div>
            <p className="mt-2 text-sm text-slate-500">
              Players will see the exact address after joining
            </p>
          </div>

          <div>
            <h3 className="mb-3 text-xs font-black uppercase tracking-[0.12em] text-slate-500">
              Number of Players
            </h3>
            <div className="rounded-xl border border-slate-200 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <button
                onClick={() =>
                  setMatchData((prev) => ({
                    ...prev,
                    totalPlayers: Math.max(2, prev.totalPlayers - 1),
                  }))
                }
                disabled={matchData.totalPlayers <= 2}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-50 text-lg font-bold text-slate-500 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ArrowLeft size={18} />
              </button>
              <div className="min-w-[8rem] text-center">
                <div className="mb-1 text-[36px] font-black leading-none text-violet-500">
                  {matchData.totalPlayers}
                </div>
                <div className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">Total</div>
                <div className="mt-2 text-sm text-slate-500">
                  You + {matchData.totalPlayers - 1} others
                </div>
              </div>
              <button
                onClick={() =>
                  setMatchData((prev) => ({
                    ...prev,
                    totalPlayers: Math.min(MAX_MATCH_PLAYERS, prev.totalPlayers + 1),
                  }))
                }
                disabled={matchData.totalPlayers >= MAX_MATCH_PLAYERS}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-50 text-lg font-bold text-slate-500 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ArrowRight size={18} />
              </button>
            </div>
            </div>
          </div>
          </div>

          <div className="mt-7 flex items-center justify-between border-t border-slate-100 pt-4">
            <button
              onClick={onCancel}
              className="rounded-xl border border-slate-200 bg-white px-6 py-2.5 text-[14px] font-bold text-slate-700 transition-colors hover:bg-slate-50"
            >
              Cancel
            </button>
            <div className="hidden text-sm font-bold text-slate-400 md:block">Step 1 of 3</div>
            <button
              onClick={nextStep}
              className="inline-flex items-center gap-2 rounded-xl bg-violet-500 px-7 py-2.5 text-[14px] font-black text-white shadow-[0_0_0_2px_#4f46e5] transition-colors hover:bg-violet-600"
            >
              Next <ArrowRight size={18} />
            </button>
          </div>
          </div>
        </div>
      )}
      {currentStep === 2 && matchData.type === "open" && (
        <div className="px-5 py-6 md:px-8 md:py-7">
          <ProgressBar currentStep={currentStep} />

          <div className="space-y-7">
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-black uppercase tracking-[0.12em] text-slate-500">
                NTRP Skill Range
              </h3>
              <span className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-black uppercase tracking-[0.08em] text-rose-500">
                REQUIRED
              </span>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-black uppercase tracking-[0.12em] text-slate-500">
                  Min
                </span>
                <select
                  value={matchData.skillLevelMin}
                  onChange={(e) => {
                    const nextMin = e.target.value;
                    setMatchData((prev) => {
                      const minIndex = skillLevels.findIndex((level) => level.value === nextMin);
                      const maxIndex = skillLevels.findIndex((level) => level.value === prev.skillLevelMax);
                      const nextMax = maxIndex >= 0 && maxIndex < minIndex ? nextMin : prev.skillLevelMax;
                      return {
                        ...prev,
                        skillLevel: nextMin,
                        skillLevelMin: nextMin,
                        skillLevelMax: nextMax,
                      };
                    });
                  }}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-4 text-[18px] font-bold text-slate-900 focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
                >
                  {skillLevels.map((level) => (
                    <option key={level.value} value={level.value}>
                      {level.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-black uppercase tracking-[0.12em] text-slate-500">
                  Max
                </span>
                <select
                  value={matchData.skillLevelMax}
                  onChange={(e) => {
                    const nextMax = e.target.value;
                    setMatchData((prev) => {
                      const minIndex = skillLevels.findIndex((level) => level.value === prev.skillLevelMin);
                      const maxIndex = skillLevels.findIndex((level) => level.value === nextMax);
                      const nextMin = minIndex > maxIndex ? nextMax : prev.skillLevelMin;
                      return {
                        ...prev,
                        skillLevel: nextMin,
                        skillLevelMin: nextMin,
                        skillLevelMax: nextMax,
                      };
                    });
                  }}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-4 text-[18px] font-bold text-slate-900 focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
                >
                  {skillLevels.map((level) => (
                    <option key={level.value} value={level.value}>
                      {level.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <p className="mt-3 text-sm text-slate-500">
              Players rated {matchData.skillLevelMin}-
              {matchData.skillLevelMax || matchData.skillLevelMin} will see this match.
            </p>
          </div>

          <div className="rounded-2xl bg-slate-50 p-4">
            <label className="flex items-start justify-between gap-4">
              <span className="flex items-start gap-3">
                <span className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-500">
                  <Check size={20} />
                </span>
                <span>
                  <span className="block text-[18px] font-black text-slate-900">
                    Require verified rating
                  </span>
                  <span className="mt-1 block text-sm text-slate-500">
                    Only players with a UTR, USTA, or league-confirmed NTRP can join.
                  </span>
                </span>
              </span>
              <button
                type="button"
                onClick={() =>
                  setMatchData((prev) => ({
                    ...prev,
                    verifiedOnly: !prev.verifiedOnly,
                  }))
                }
                className={`relative inline-flex h-8 w-14 flex-shrink-0 items-center rounded-full transition-colors ${
                  matchData.verifiedOnly ? "bg-violet-500" : "bg-slate-300"
                }`}
                aria-pressed={matchData.verifiedOnly}
                aria-label="Require verified rating"
              >
                <span
                  className={`inline-block h-6 w-6 transform rounded-full bg-white shadow transition-transform ${
                    matchData.verifiedOnly ? "translate-x-7" : "translate-x-1"
                  }`}
                />
              </button>
            </label>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <h3 className="mb-3 text-sm font-black uppercase tracking-[0.12em] text-slate-500">
                Match Format
              </h3>
              <div className="rounded-2xl border border-slate-200 px-4 py-4">
                <div className="flex items-center gap-3">
                  <Trophy size={18} className="text-violet-400" />
                  <select
                    value={matchData.format}
                    onChange={(e) => {
                      setIsFormatManuallySelected(true);
                      setMatchData((prev) => ({ ...prev, format: e.target.value }));
                    }}
                    className="flex-1 bg-transparent text-[18px] font-bold text-slate-900 focus:outline-none"
                  >
                    {matchFormatOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div>
              <h3 className="mb-3 text-sm font-black uppercase tracking-[0.12em] text-slate-500">
                Category
              </h3>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                {genderOptions.map((gender) => (
                  <button
                    key={gender}
                    type="button"
                    onClick={() => setMatchData((prev) => ({ ...prev, gender }))}
                    className={`rounded-2xl border px-3 py-3 text-sm font-black transition-colors ${
                      matchData.gender === gender
                        ? "border-violet-500 bg-violet-50 text-violet-700"
                        : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                    }`}
                  >
                    {gender}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <h3 className="mb-3 text-sm font-black uppercase tracking-[0.12em] text-slate-500">
                Balls
              </h3>
              <div className="grid grid-cols-3 gap-2">
                {ballsOptions.map((balls) => (
                  <button
                    key={balls}
                    type="button"
                    onClick={() => setMatchData((prev) => ({ ...prev, balls }))}
                    className={`rounded-2xl border px-3 py-3 text-center text-sm font-black transition-colors ${
                      matchData.balls === balls
                        ? "border-violet-500 bg-violet-50 text-violet-700"
                        : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                    }`}
                  >
                    {balls === "Host provides" ? "Host" : balls}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-sm text-slate-500">
                {matchData.balls === "Rotate"
                  ? "Each player brings a can in rotation."
                  : matchData.balls === "BYO"
                    ? "Each player brings their own can."
                    : "You'll supply balls for the match."}
              </p>
            </div>

            <div>
              <h3 className="mb-3 text-sm font-black uppercase tracking-[0.12em] text-slate-500">
                Visibility
              </h3>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-100 text-violet-500">
                    <Globe size={20} />
                  </div>
                  <div className="flex-1">
                    <div className="text-[18px] font-black text-slate-900">Share by link only</div>
                    <div className={`text-sm font-black ${isLinkOnlyListing ? "text-violet-500" : "text-emerald-500"}`}>
                      {isLinkOnlyListing ? "Hidden from feed" : "Visible in feed"}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setMatchData((prev) => ({
                        ...prev,
                        listingVisibility: prev.listingVisibility === "link_only" ? "listed" : "link_only",
                      }))
                    }
                    className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
                      isLinkOnlyListing ? "bg-violet-500" : "bg-slate-300"
                    }`}
                    aria-pressed={isLinkOnlyListing}
                    aria-label="Toggle link-only visibility"
                  >
                    <span
                      className={`inline-block h-6 w-6 transform rounded-full bg-white shadow transition-transform ${
                        isLinkOnlyListing ? "translate-x-7" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div>
            <h3 className="mb-4 text-sm font-black uppercase tracking-[0.12em] text-slate-500">
              Additional Notes
            </h3>
            <textarea
              value={matchData.notes}
              onChange={(e) => setMatchData((prev) => ({ ...prev, notes: e.target.value }))}
              placeholder="Any special instructions, court reservations, parking..."
              rows={4}
              className="w-full resize-none rounded-2xl border border-slate-200 p-4 text-[16px] font-medium text-slate-900 focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
            />
          </div>

          {!notifyPanelOpen ? (
            <button
              type="button"
              onClick={() => setNotifyPanelOpen(true)}
              className="flex w-full items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-white px-4 py-3 text-left transition-colors hover:border-violet-300 hover:bg-violet-50/40"
            >
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[9px] bg-violet-100 text-violet-600">
                <Bell size={16} />
              </div>
              <div className="flex-1">
                <div className="font-bold text-slate-900">Notify specific players?</div>
                <div className="mt-0.5 text-[11px] font-medium leading-4 text-slate-500">
                  Send a heads-up to people you&apos;d love to play with. They can still join via the public feed.
                </div>
              </div>
              <ArrowRight size={14} className="text-slate-400" />
            </button>
          ) : (
            <div className="rounded-[14px] border border-violet-100 bg-violet-50 p-4">
              <div className="mb-3.5 flex items-center gap-2.5">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[9px] bg-violet-600 text-white">
                  <Bell size={16} />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-bold text-slate-900">Notify specific players</div>
                  <div className="mt-0.5 text-xs leading-[1.4] text-slate-500">
                    They&apos;ll get a heads-up. Anyone matching the level can still join.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setNotifyPanelOpen(false);
                    setMatchData((prev) => ({ ...prev, notifyPlayers: [] }));
                  }}
                  className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-white text-slate-500"
                  aria-label="Close notify panel"
                >
                  <X size={13} />
                </button>
              </div>

              <div className="grid gap-3 lg:grid-cols-2">
                <div>
                  <div className="mb-1.5 flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-[0.06em] text-slate-500">
                    <Users size={11} className="text-violet-600" />
                    <span>From your groups</span>
                  </div>
                  <div className="mb-2.5 overflow-hidden rounded-[10px] border border-slate-200 bg-white">
                    {groupsLoading ? (
                      <div className="px-3 py-4 text-xs font-semibold text-violet-600">
                        Loading groups...
                      </div>
                    ) : visibleNotifyGroups.length === 0 ? (
                      <div className="px-3 py-4 text-xs font-semibold text-slate-500">
                        No groups yet. Create groups from My groups in your profile.
                      </div>
                    ) : (
                      visibleNotifyGroups.map((group, index) => {
                        const addedCount = getGroupNotifyCount(group);
                        const memberCount = group.member_count || group.members?.length || 0;
                        const allAdded = memberCount > 0 && addedCount >= memberCount;
                        return (
                          <div
                            key={group.id}
                            className={`flex items-center gap-2.5 px-3 py-[9px] ${
                              index === 0 ? "" : "border-t border-slate-100"
                            }`}
                          >
                            <div
                              className={`flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-lg ${
                                allAdded
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-violet-100 text-violet-600"
                              }`}
                            >
                              <Users size={13} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-xs font-bold text-slate-900">
                                {group.name}
                              </div>
                              <div className="text-[10px] text-slate-500">
                                {memberCount} players
                                {addedCount > 0 && !allAdded ? (
                                  <span className="font-bold text-violet-600">{` · ${addedCount} added`}</span>
                                ) : null}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleNotifyGroup(group.id)}
                              disabled={allAdded}
                              className={`flex-shrink-0 rounded-[7px] px-[9px] py-[5px] text-[10px] font-bold ${
                                allAdded
                                  ? "cursor-not-allowed bg-slate-100 text-slate-400"
                                  : "bg-violet-600 text-white hover:bg-violet-700"
                              }`}
                            >
                              {allAdded ? "Added" : "Notify all"}
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>

                  <div className="mb-1.5 flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-[0.06em] text-slate-500">
                    <Bell size={11} className="text-violet-600" />
                    <span>Suggested</span>
                  </div>
                  <div className="overflow-hidden rounded-[10px] border border-slate-200 bg-white">
                    {visibleSuggestedNotifyPlayers.length === 0 ? (
                      <div className="px-3 py-4 text-xs font-semibold text-slate-500">
                        No recent players to suggest yet.
                      </div>
                    ) : (
                      visibleSuggestedNotifyPlayers.map((player, index) => {
                        const added = notifyPlayers.some((item) => item.id === player.id);
                        return (
                          <div
                            key={`notify-recent-${player.id}`}
                            className={`flex items-center gap-2 px-3 py-2 ${
                              index === 0 ? "" : "border-t border-slate-100"
                            }`}
                          >
                            <PlayerAvatar
                              name={player.name}
                              imageUrl={player.avatarUrl}
                              fallback={player.avatar}
                              variant="violet"
                              size="sm"
                              showBadge={false}
                            />
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-xs font-bold text-slate-900">
                                {player.name}
                              </div>
                              <div className="text-[10px] text-slate-500">
                                {[
                                  player.ntrp ? `NTRP ${player.ntrp}` : "",
                                  player.lastPlayed || "Recently active",
                                ]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleAddNotifyPlayer(player)}
                              className={`rounded-[7px] px-2.5 py-[5px] text-[10px] font-bold ${
                                added
                                  ? "bg-slate-100 text-slate-700"
                                  : "bg-violet-600 text-white hover:bg-violet-700"
                              }`}
                            >
                              {added ? "Added" : "Notify"}
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>

                  <div className="mt-3 rounded-[10px] border border-slate-200 bg-white p-3">
                    <label className="mb-2 block text-[10px] font-extrabold uppercase tracking-[0.06em] text-slate-500">
                      Search players
                    </label>
                    <div className="relative">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={notifySearch}
                        onChange={(e) => setNotifySearch(e.target.value)}
                        placeholder="Search by name or email..."
                        className="w-full rounded-[10px] border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-[13px] text-slate-900 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-100"
                      />
                    </div>
                    {notifySearch.trim().length > 0 && (
                      <div className="mt-2 space-y-2">
                        {notifyLoading ? (
                          <div className="text-xs text-slate-500">Searching...</div>
                        ) : notifyResults.length > 0 ? (
                          <div className="max-h-48 space-y-2 overflow-y-auto">
                            {notifyResults.map((player) => (
                              <button
                                key={`notify-search-${player.id}`}
                                type="button"
                                onClick={() => handleAddNotifyPlayer(player)}
                                className="flex w-full items-center gap-2 rounded-lg border border-slate-100 px-3 py-2 text-left hover:bg-violet-50"
                              >
                                <PlayerAvatar
                                  name={player.name}
                                  imageUrl={player.avatarUrl}
                                  fallback={player.avatar}
                                  variant="sky"
                                  size="sm"
                                  showBadge={false}
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="truncate text-xs font-bold text-slate-900">
                                    {player.name}
                                  </div>
                                  <div className="text-[10px] text-slate-500">
                                    {[
                                      player.ntrp ? `NTRP ${player.ntrp}` : "",
                                      player.lastPlayed || "Recently active",
                                    ]
                                      .filter(Boolean)
                                      .join(" · ")}
                                  </div>
                                </div>
                                <Plus size={14} className="text-violet-500" />
                              </button>
                            ))}
                          </div>
                        ) : notifySearch.trim().length >= 2 ? (
                          <div className="text-xs text-slate-500">
                            No matching players found.
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <div className="mb-1.5 flex items-center justify-between text-[10px] font-extrabold uppercase tracking-[0.06em] text-slate-500">
                    <span>Will notify</span>
                    <span className={notifyPlayers.length > 0 ? "text-violet-700" : "text-slate-400"}>
                      {notifyPlayers.length}
                    </span>
                  </div>
                  <div
                    className={`min-h-[140px] rounded-[10px] border border-slate-200 bg-white ${
                      notifyPlayers.length === 0 ? "px-3.5 py-6" : "p-2.5"
                    }`}
                  >
                    {notifyPlayers.length === 0 ? (
                      <div className="text-center text-xs leading-5 text-slate-500">
                        No one yet. Pick a group or add players from suggestions.
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {notifyPlayers.map((player) => (
                          <span
                            key={`notify-selected-${player.id}`}
                            className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700"
                          >
                            {player.name}
                            <button
                              type="button"
                              onClick={() => handleRemoveNotifyPlayer(player.id)}
                              className="flex h-4 w-4 items-center justify-center rounded-full bg-slate-200 text-slate-500"
                              aria-label={`Remove ${player.name}`}
                            >
                              <X size={9} />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="mt-2.5 flex items-start gap-1.5 text-[10px] leading-[1.5] text-slate-500">
                    <div className="pt-px text-slate-400">i</div>
                    <span>
                      Notified players get a push:{" "}
                      <em>&quot;{currentUserFirstName} thought you might want to join.&quot;</em>{" "}
                      One-tap join, no spot reserved.
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="mt-8 flex items-center justify-between border-t border-slate-100 pt-5">
            <button
              onClick={prevStep}
              className="rounded-2xl border border-slate-200 bg-white px-7 py-3 text-[15px] font-bold text-slate-700 transition-colors hover:bg-slate-50"
            >
              Back
            </button>
            <div className="hidden text-sm font-bold text-slate-400 md:block">Step 2 of 3</div>
            <button
              onClick={nextStep}
              className="inline-flex items-center gap-2 rounded-2xl bg-violet-500 px-8 py-3 text-[15px] font-black text-white shadow-[0_0_0_2px_#4f46e5] transition-colors hover:bg-violet-600"
            >
              Next <ArrowRight size={18} />
            </button>
          </div>
          </div>
        </div>
      )}
      {currentStep === 2 && matchData.type === "private" && (
        <div className="p-6 space-y-6">
          <ProgressBar currentStep={currentStep} />
          <h1 className="text-2xl font-bold text-gray-900">Invite Players</h1>

          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wider">
                Invited Players
              </h3>
              <div className="text-right">
                <div className="text-sm font-bold text-gray-900">{invitedCount + 1} invited</div>
                <div className="text-xs text-gray-500">{totalPlayers - 1} needed for match</div>
              </div>
            </div>
            <div className="space-y-3 mb-4">
              <div className="flex items-center gap-3 p-3 border border-gray-200 rounded-xl">
                <PlayerAvatar
                  name={currentUser?.name || "You"}
                  imageUrl={currentUserAvatarUrl}
                  variant="emerald"
                />
                <div className="flex-1">
                  <div className="font-medium text-gray-900">You (Host)</div>
                  <div className="text-sm text-gray-500">Organizer</div>
                </div>
              </div>
              {combinedInvitees.map((invitee) => (
                <div
                  key={invitee.id}
                  className="flex items-center gap-3 p-3 border border-gray-200 rounded-xl"
                >
                  {invitee.type === "contact" ? (
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
                      <Phone size={18} />
                    </div>
                  ) : (
                    <PlayerAvatar
                      name={invitee.name}
                      imageUrl={invitee.avatarUrl}
                      fallback={invitee.avatar}
                      variant="indigo"
                    />
                  )}
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{invitee.name}</div>
                    <div className="text-sm text-gray-600">
                      {invitee.type === "contact" ? (
                        <span>
                          {invitee.subtitle}
                          <span className="ml-2 inline-flex items-center text-xs font-semibold text-blue-600">
                            SMS magic link
                          </span>
                        </span>
                      ) : (
                        invitee.subtitle
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() =>
                      invitee.type === "contact"
                        ? handleRemoveManualInvite(invitee.id)
                        : handleRemovePlayer(invitee.id)
                    }
                    className="p-1 text-red-500 hover:bg-red-50 rounded-full"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
              {invitedCount >= totalPlayers - 1 && (
                <div className="bg-green-50 rounded-xl p-4 border border-green-200">
                  <div className="text-center">
                    <div className="text-sm font-bold text-green-700 mb-1">
                      ✅ You have enough players for your {matchData.format} match!
                    </div>
                    <div className="text-xs text-green-600">
                      💡 Tip: Invite 2-3 more people as backups in case someone can't make it
                    </div>
                  </div>
                </div>
              )}
              {invitedCount < totalPlayers - 1 && (
                <div className="bg-orange-50 rounded-xl p-4 border border-orange-200">
                  <div className="text-center">
                    <div className="text-sm font-bold text-orange-700 mb-1">
                      Need {totalPlayers - invitedCount - 1} more players for your match
                    </div>
                    <div className="text-xs text-orange-600">
                      Invite extra people to ensure a full match!
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {canInviteMore() && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wider">
                  Add More Players
                </h3>
                <span className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded font-medium">
                  {MAX_PRIVATE_INVITES - invitedCount} spots left
                </span>
              </div>
              <p className="text-xs text-blue-600 mb-4">
                🎯 Smart strategy: Invite more than {totalPlayers - 1} players to guarantee a full match!
              </p>
              <div className="mb-4 rounded-xl border border-violet-100 bg-violet-50 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-violet-700">
                      Your groups
                    </h4>
                    <p className="text-xs font-semibold text-violet-600">
                      Add regular crews from your player profile.
                    </p>
                  </div>
                  {groupsLoading && (
                    <span className="text-xs font-semibold text-violet-500">
                      Loading...
                    </span>
                  )}
                </div>
                {matchGroups.length === 0 && !groupsLoading ? (
                  <p className="rounded-lg border border-dashed border-violet-200 bg-white px-3 py-2 text-xs font-semibold text-violet-700">
                    No groups yet. Create groups from My groups in your profile.
                  </p>
                ) : (
                  <div className="grid gap-2 md:grid-cols-2">
                    {matchGroups.slice(0, 4).map((group) => (
                      <div
                        key={group.id}
                        className="rounded-lg border border-violet-100 bg-white p-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-black text-gray-900">
                              {group.name}
                            </p>
                            <p className="text-xs font-semibold text-gray-500">
                              {group.member_count || 0} players
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleInviteGroup(group.id)}
                            className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-black text-white hover:bg-violet-700"
                          >
                            Invite all
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {quickAddPlayers.length > 0 && (
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Frequent teammates
                    </h4>
                    <span className="text-[10px] font-semibold uppercase text-gray-400">
                      Quick add
                    </span>
                  </div>
                  <div className="space-y-2">
                    {quickAddPlayers.map((player) => {
                      const normalizedId = Number(player.id);
                      if (!Number.isFinite(normalizedId)) {
                        return null;
                      }
                      const isDisabled = invitedPlayers.some(
                        (invitee) => invitee.id === normalizedId,
                      );
                      const subtitleParts = [];
                      if (player.ntrp) subtitleParts.push(`NTRP ${player.ntrp}`);
                      if (player.lastPlayed) {
                        subtitleParts.push(`Played ${player.lastPlayed}`);
                      } else {
                        subtitleParts.push("Recently active");
                      }
                      return (
                        <button
                          key={`recent-${normalizedId}`}
                          type="button"
                          disabled={isDisabled}
                          onClick={() => handleAddPlayer(player)}
                          className={`w-full flex items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
                            isDisabled
                              ? "cursor-not-allowed border-gray-200 bg-gray-50 text-gray-400"
                              : "border-gray-200 text-gray-700 hover:bg-gray-50"
                          }`}
                        >
                          <PlayerAvatar
                            name={player.name}
                            imageUrl={player.avatarUrl}
                            fallback={player.avatar}
                            variant="violet"
                            size="sm"
                            showBadge={false}
                          />
                          <div className="flex-1">
                            <div className="font-medium text-gray-900">{player.name}</div>
                            <div className="text-xs text-gray-500">
                              {subtitleParts.join(" • ")}
                            </div>
                          </div>
                          {isDisabled ? (
                            <Check size={18} className="text-gray-300" />
                          ) : (
                            <Plus size={18} className="text-violet-500" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              <div className="relative mb-4">
                <Search
                  size={20}
                  className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400"
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name or email..."
                  className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                />
              </div>
              {searchQuery && (
                <div className="space-y-2 mb-4 max-h-48 overflow-y-auto">
                  {searchLoading && <div className="text-center py-4 text-gray-500">Searching...</div>}
                  {!searchLoading && searchError && (
                    <div className="text-center py-4 text-red-500">{searchError}</div>
                  )}
                  {!searchLoading && !searchError &&
                    searchResults
                      .filter((player) => {
                        if (!player || !player.id) return false;
                        const normalizedId = Number(player.id);
                        if (!Number.isFinite(normalizedId)) return false;
                        if (invitedPlayers.some((p) => p.id === normalizedId)) {
                          return false;
                        }
                        if (currentUserId !== null && normalizedId === currentUserId) {
                          return false;
                        }
                        return true;
                      })
                      .map((player) => (
                        <button
                          key={player.id}
                          onClick={() => handleAddPlayer(player)}
                          className="w-full flex items-center gap-3 p-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors text-left"
                        >
                          <PlayerAvatar
                            name={player.name}
                            imageUrl={player.avatarUrl}
                            fallback={player.avatar}
                            variant="sky"
                          />
                          <div className="flex-1">
                            <div className="font-medium text-gray-900">{player.name}</div>
                            <div className="text-sm text-gray-600">
                              {player.ntrp ? `NTRP ${player.ntrp}` : ""}
                              {player.ntrp ? " • " : ""}
                              Played {player.lastPlayed}
                            </div>
                          </div>
                          <Plus size={20} className="text-violet-500" />
                        </button>
                      ))}
                  {!searchLoading && !searchError && searchResults.length === 0 && (
                    <div className="text-center py-4 text-gray-500">
                      No players found matching "{searchQuery}"
                    </div>
                  )}
                </div>
              )}
              <div className="border border-gray-200 rounded-xl p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center">
                    <Phone size={18} />
                  </div>
                  <div className="text-sm text-gray-600">
                    <p className="font-semibold text-gray-800">Invite by phone number</p>
                    <p>
                      We'll text your contact a magic link. First name, last name, and mobile number are required.
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <input
                    type="text"
                    value={contactFirstName}
                    onChange={(e) => {
                      setContactFirstName(e.target.value);
                      setContactError("");
                    }}
                    placeholder="First name"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                  />
                  <input
                    type="text"
                    value={contactLastName}
                    onChange={(e) => {
                      setContactLastName(e.target.value);
                      setContactError("");
                    }}
                    placeholder="Last name"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                  />
                  <input
                    type="tel"
                    value={contactPhone}
                    onChange={(e) => {
                      setContactPhone(e.target.value);
                      setContactError("");
                    }}
                    placeholder="+15551234567"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                  />
                </div>
                {contactError && (
                  <p className="text-xs font-semibold text-red-600">{contactError}</p>
                )}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <p className="text-xs text-gray-500">
                    Contacts without emails still receive an SMS invite instantly.
                  </p>
                  <button
                    onClick={handleAddManualInvite}
                    disabled={
                      !contactFirstName.trim() ||
                      !contactLastName.trim() ||
                      !contactPhone.trim()
                    }
                    className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors"
                  >
                    <Plus size={16} /> Add contact
                  </button>
                </div>
              </div>
            </div>
          )}

          <div>
            <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-4">
              Match Format
            </h3>
            <div className="border border-gray-200 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <Trophy size={20} className="text-gray-500" />
                <select
                  value={matchData.format}
                  onChange={(e) => setMatchData((prev) => ({ ...prev, format: e.target.value }))}
                  className="flex-1 bg-transparent text-lg font-medium text-gray-900 focus:outline-none"
                >
                  {matchFormatOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-4">
              Additional Notes
            </h3>
            <textarea
              value={matchData.notes}
              onChange={(e) => setMatchData((prev) => ({ ...prev, notes: e.target.value }))}
              placeholder="Any special instructions, what to bring, parking info..."
              rows={3}
              className="w-full p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-transparent resize-none"
            />
          </div>

          <div className="flex gap-4">
            <button
              onClick={prevStep}
              className="flex-1 px-6 py-4 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
            >
              Back
            </button>
            <button
              onClick={nextStep}
              className="flex-1 px-6 py-4 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
            >
              Next <ArrowRight size={20} />
            </button>
          </div>
        </div>
      )}
      {currentStep === 3 && (
        <div className="px-5 py-6 md:px-8 md:py-7">
          <ProgressBar currentStep={currentStep} />

          <div className="rounded-[26px] border border-slate-200 bg-white overflow-hidden">
            <div className={`px-5 py-4 text-sm font-black uppercase tracking-[0.12em] ${
              matchData.type === "open"
                ? "bg-emerald-100 text-emerald-700"
                : "bg-violet-100 text-violet-700"
            }`}>
              {matchData.type === "open"
                ? `Open · ${isLinkOnlyListing ? "Link only" : "Public feed"}`
                : "Private · Invite only"}
            </div>
            <div className="grid gap-5 px-5 py-5 md:grid-cols-2">
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-50 text-violet-500">
                    <Calendar size={18} />
                  </div>
                  <div>
                    <div className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">When</div>
                    <div className="text-[16px] font-black text-slate-900">
                      {formatDateDisplay(matchData.date)} · {formatTimeDisplay(matchData.startTime)} for {matchData.duration}h
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-50 text-violet-500">
                    <Users size={18} />
                  </div>
                  <div>
                    <div className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">Players</div>
                    <div className="text-[16px] font-black text-slate-900">
                      {matchData.type === "private"
                        ? `${invitedCount + 1} invited · ${totalPlayers} needed`
                        : `${totalPlayers} total · ${Math.max(totalPlayers - 1, 0)} needed`}
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-50 text-violet-500">
                    <Trophy size={18} />
                  </div>
                  <div>
                    <div className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">Format</div>
                    <div className="text-[16px] font-black text-slate-900">{matchData.format}</div>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-50 text-violet-500">
                    <MapPin size={18} />
                  </div>
                  <div>
                    <div className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">Location</div>
                    <div className="text-[16px] font-black text-slate-900">{matchData.location}</div>
                  </div>
                </div>
                {matchData.type === "open" && (
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-50 text-violet-500">
                      <Search size={18} />
                    </div>
                    <div>
                      <div className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">Skill Level</div>
                      <div className="text-[16px] font-black text-slate-900">
                        NTRP {matchData.skillLevelMin}
                        {matchData.skillLevelMax && matchData.skillLevelMax !== matchData.skillLevelMin
                          ? `-${matchData.skillLevelMax}`
                          : ""}
                      </div>
                    </div>
                  </div>
                )}
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-50 text-violet-500">
                    <Trophy size={18} />
                  </div>
                  <div>
                    <div className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">Balls</div>
                    <div className="text-[16px] font-black text-slate-900">{matchData.balls}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-2xl bg-violet-50 px-4 py-4 text-sm font-medium text-slate-500">
            After publishing, you can edit details, message players, or cancel anytime from the match page.
          </div>

          {matchData.type === "private" && invitedCount > 0 && (
            <div className="border border-gray-200 rounded-xl p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">INVITED PLAYERS</h3>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <PlayerAvatar
                    name={currentUser?.name || "You"}
                    imageUrl={currentUserAvatarUrl}
                    size="xs"
                    variant="emerald"
                  />
                  <span className="text-gray-700 font-medium">You (Host)</span>
                </div>
                {invitedPlayers.map((player) => (
                  <div key={player.id} className="flex items-center gap-2">
                    <PlayerAvatar
                      name={player.name}
                      imageUrl={player.avatarUrl}
                      fallback={player.avatar}
                      size="xs"
                      variant="indigo"
                    />
                    <span className="text-gray-700">{player.name}</span>
                  </div>
                ))}
                {manualInvitees.map((invitee) => {
                  const displayName = invitee.name?.trim() || invitee.displayPhone || formatPhoneDisplay(invitee.phone);
                  const displayPhone = invitee.displayPhone || formatPhoneDisplay(invitee.phone);
                  return (
                    <div key={invitee.id} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                        <Phone size={16} />
                      </div>
                      <div className="flex-1">
                        <div className="text-gray-700 font-medium">{displayName}</div>
                        <div className="text-xs text-gray-500">{displayPhone}</div>
                      </div>
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-blue-600 bg-blue-50 px-2 py-1 rounded-full">
                        SMS magic link
                      </span>
                    </div>
                  );
                })}
                {invitedCount > totalPlayers - 1 && (
                  <div className="bg-green-100 rounded-lg p-3 mt-3">
                    <div className="text-sm font-medium text-green-700">
                      🎯 Smart planning: You've invited {invitedCount} players for {totalPlayers - 1} spots!
                    </div>
                    <div className="text-xs text-green-600 mt-1">
                      First {totalPlayers - 1} to confirm get spots, others join waitlist
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <div
            className={`rounded-xl p-6 text-center ${
              matchData.type === "private" ? "bg-blue-50" : "bg-violet-50"
            }`}
          >
            <div
              className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
                matchData.type === "private" ? "bg-blue-500" : "bg-violet-600"
              }`}
            >
              {matchData.type === "private" ? (
                <Lock size={32} className="text-white" />
              ) : (
                <Zap size={32} className="text-white" />
              )}
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              {matchData.type === "private" ? "Ready to Create!" : "Ready to Publish!"}
            </h3>
            <p className="text-gray-600">
              {matchData.type === "private"
                ? "Your private match will be created and invitations sent"
                : "Your match will be visible to all players in the area"}
            </p>
          </div>

          <div className="flex gap-4">
            <button
              onClick={prevStep}
              className="flex-1 px-6 py-4 bg-white border border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
            >
              Back
            </button>
            <button
              onClick={handlePublish}
              disabled={creating}
              className={`flex-1 px-6 py-4 text-white rounded-xl font-semibold transition-colors flex items-center justify-center gap-2 ${
                matchData.type === "private"
                  ? "bg-blue-600 hover:bg-blue-700"
                  : "bg-violet-600 hover:bg-violet-700"
              } ${creating ? "opacity-70 cursor-not-allowed" : ""}`}
            >
              {creating
                ? "Saving..."
                : createdMatchId && isEditingExisting
                  ? "Save Changes"
                  : matchData.type === "private"
                    ? "Create Match"
                    : "Publish"}
              {!creating && <Check size={20} />}
            </button>
          </div>
        </div>
      )}
      {currentStep === 4 && (
        <div className="p-6 space-y-8">
          <div className="text-center mb-8">
            <div
              className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse ${
                matchData.type === "private" ? "bg-blue-500" : "bg-violet-600"
              }`}
            >
              <Check size={40} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              {matchData.type === "private" ? "Private Match Created!" : "Match Published!"}
            </h1>
            <p className="text-gray-600">
              {matchData.type === "private"
                ? "Invitations have been sent to your selected players"
                : "Your match is now live and visible to all players"}
            </p>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900">{matchData.format} Match</h3>
                <p className="text-gray-600">
                  {formatDateDisplay(matchData.date)} • {formatTimeDisplay(matchData.startTime)}
                </p>
              </div>
              <span
                className={`px-3 py-1 rounded-full text-sm font-medium ${
                  matchData.type === "private"
                    ? "bg-blue-100 text-blue-700"
                    : "bg-green-100 text-green-700"
                }`}
              >
                {matchData.type === "private" ? "PRIVATE" : "LIVE"}
              </span>
            </div>
            <div className="text-sm text-gray-600">
              <div className="flex items-center gap-2 mb-1">
                <MapPin size={14} />
                <span>{matchData.location}</span>
              </div>
              <div className="flex items-center gap-2">
                <Users size={14} />
                <span>
                  {matchData.type === "private"
                    ? `${invitedCount + 1} players invited • ${totalPlayers} needed`
                    : `1/${totalPlayers} players • ${totalPlayers - 1} spots open`}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {matchData.type === "private" ? (
              <div className="border border-gray-200 rounded-xl p-4 text-left">
                <div className="flex items-center gap-2 text-gray-700 font-medium mb-1">
                  <MessageSquare size={16} className="text-blue-500" />
                  <span>Invites sent via SMS</span>
                </div>
                <p className="text-sm text-gray-600">
                  Selected players receive a private link in their text message. No public share link is available for private matches.
                </p>
              </div>
            ) : (
              <div>
                <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-3">Share Match</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    onClick={handleNavigatorShare}
                    className="flex items-center justify-center gap-2 p-3 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-colors"
                  >
                    <Share2 size={16} />
                    <span className="text-sm font-medium">Share Link</span>
                  </button>
                  <button
                    onClick={() => handleShare("copy")}
                    className="flex items-center justify-center gap-2 p-3 bg-gray-50 text-gray-600 rounded-xl hover:bg-gray-100 transition-colors"
                  >
                    <Copy size={16} />
                    <span className="text-sm font-medium">Copy Link</span>
                  </button>
                </div>
                {isLinkOnlyListing && (
                  <p className="mt-3 text-sm font-medium text-amber-600">
                    This match is hidden from browse. Share the link with players you want to invite.
                  </p>
          )}

          {currentStep === 3 && !createdMatchId && (
            <div className="mt-8 flex items-center justify-between border-t border-slate-100 pt-5">
              <button
                onClick={prevStep}
                className="rounded-2xl border border-slate-200 bg-white px-7 py-3 text-[15px] font-bold text-slate-700 transition-colors hover:bg-slate-50"
              >
                Back
              </button>
              <div className="hidden text-sm font-bold text-slate-400 md:block">Step 3 of 3</div>
              <button
                onClick={handlePublish}
                disabled={creating}
                className="inline-flex items-center gap-2 rounded-2xl bg-violet-500 px-8 py-3 text-[15px] font-black text-white shadow-[0_0_0_2px_#4f46e5] transition-colors hover:bg-violet-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {creating ? "Publishing..." : "Publish match"} <ArrowRight size={18} />
              </button>
            </div>
          )}
        </div>
      )}

            <div>
              <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-3">
                Add to Calendar
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  onClick={() => handleAddToCalendar("google")}
                  className="flex items-center justify-center gap-2 p-3 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  <Calendar size={16} />
                  <span className="text-sm font-medium">Google</span>
                </button>
                <button
                  onClick={() => handleAddToCalendar("apple")}
                  className="flex items-center justify-center gap-2 p-3 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  <Plus size={16} />
                  <span className="text-sm font-medium">Apple</span>
                </button>
                <button
                  onClick={() => handleAddToCalendar("outlook")}
                  className="flex items-center justify-center gap-2 p-3 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  <Calendar size={16} />
                  <span className="text-sm font-medium">Outlook</span>
                </button>
                <button
                  onClick={() => handleAddToCalendar("download")}
                  className="flex items-center justify-center gap-2 p-3 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  <Download size={16} />
                  <span className="text-sm font-medium">Download</span>
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => setCurrentStep(5)}
              className={`w-full px-6 py-4 text-white rounded-xl font-semibold transition-colors ${
                matchData.type === "private"
                  ? "bg-blue-600 hover:bg-blue-700"
                  : "bg-violet-600 hover:bg-violet-700"
              }`}
            >
              View Match Details
            </button>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                onClick={goBackToHome}
                className="flex items-center justify-center gap-2 px-6 py-4 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
              >
                <Home size={16} />
                Back to Home
              </button>
              <button
                onClick={resetFlow}
                className="px-6 py-4 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
              >
                Create Another
              </button>
            </div>
          </div>
        </div>
      )}
      {currentStep === 5 && (
        <div className="bg-white min-h-screen">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <button onClick={() => setCurrentStep(4)} className="p-2 hover:bg-gray-100 rounded-lg">
                <ArrowLeft size={20} className="text-gray-600" />
              </button>
              <h1 className="text-lg font-semibold text-gray-900">Match Details</h1>
              {matchData.type !== "private" ? (
                <button onClick={handleNavigatorShare} className="p-2 hover:bg-gray-100 rounded-lg">
                  <Share2 size={20} className="text-gray-600" />
                </button>
              ) : (
                <span className="w-9" />
              )}
            </div>
          </div>

          <div className="p-6 space-y-6">
            <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-2xl p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{matchData.format} Match</h2>
                  <p className="text-gray-600">{formatDateDisplay(matchData.date)}</p>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-sm font-medium ${
                    matchData.type === "private"
                      ? "bg-blue-100 text-blue-700"
                      : "bg-green-100 text-green-700"
                  }`}
                >
                  {matchData.type === "private" ? "PRIVATE" : "OPEN"}
                </span>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Clock size={16} className="text-gray-500" />
                  <span className="text-gray-700">
                    {formatTimeDisplay(matchData.startTime)} • {matchData.duration} hours
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <MapPin size={16} className="text-gray-500" />
                  <span className="text-gray-700">{matchData.location}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Users size={16} className="text-gray-500" />
                  <span className="text-gray-700">
                    {matchData.type === "private"
                      ? `${invitedCount + 1} players invited • ${totalPlayers} needed`
                      : `${totalPlayers} players total`}
                  </span>
                </div>
                {matchData.type === "open" && matchData.skillLevelMin && (
                  <div className="flex items-center gap-3">
                    <Trophy size={16} className="text-gray-500" />
                    <span className="text-gray-700">
                      NTRP {matchData.skillLevelMin}
                      {matchData.skillLevelMax &&
                      matchData.skillLevelMax !== matchData.skillLevelMin
                        ? `-${matchData.skillLevelMax}`
                        : ""}
                    </span>
                  </div>
                )}
              </div>
              <div className="mt-4 pt-4 border-t border-gray-200">
                <p className="text-sm text-gray-600 mb-1">Hosted by</p>
                <p className="font-medium text-gray-700">{currentUser?.name || "You"}</p>
              </div>
            </div>

            <div className="bg-gray-50 rounded-2xl p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">
                Players ({invitedCount + 1}/{totalPlayers})
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <PlayerAvatar
                    name={currentUser?.name || "You"}
                    imageUrl={currentUserAvatarUrl}
                    variant="emerald"
                  />
                    <div>
                      <p className="font-medium text-gray-800">You</p>
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Host</span>
                    </div>
                  </div>
                  <Check size={16} className="text-green-500" />
                </div>
                {invitedPlayers.map((player) => (
                  <div key={player.id} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <PlayerAvatar
                        name={player.name}
                        imageUrl={player.avatarUrl}
                        fallback={player.avatar}
                        variant="indigo"
                      />
                      <div>
                        <p className="font-medium text-gray-800">{player.name}</p>
                        {player.ntrp && <p className="text-sm text-gray-600">NTRP {player.ntrp}</p>}
                      </div>
                    </div>
                    <span className="text-sm text-yellow-600 font-medium">Pending</span>
                  </div>
                ))}
                {Array.from({ length: Math.max(totalPlayers - invitedCount - 1, 0) }).map((_, index) => (
                  <div key={`empty-${index}`} className="flex items-center space-x-3">
                    <div className="w-10 h-10 border-2 border-dashed border-gray-300 rounded-full flex items-center justify-center">
                      <Plus size={16} className="text-gray-400" />
                    </div>
                    <p className="text-gray-500">Waiting for player...</p>
                  </div>
                ))}
              </div>
            </div>

            {matchData.notes && (
              <div className="bg-blue-50 rounded-2xl p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Notes from Host</h3>
                <p className="text-gray-600">{matchData.notes}</p>
              </div>
            )}

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wider">Host Controls</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  onClick={handleEditMatch}
                  className="flex items-center justify-center gap-2 p-3 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  <Edit size={16} className="text-gray-600" />
                  <span className="text-sm font-medium">Edit Match</span>
                </button>
                <button
                  onClick={handleCancelMatch}
                  disabled={cancelling}
                  className="flex items-center justify-center gap-2 p-3 border border-red-200 text-red-600 rounded-xl hover:bg-red-50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <X size={16} />
                  <span className="text-sm font-medium">{cancelling ? "Cancelling..." : "Cancel Match"}</span>
                </button>
              </div>
              {matchData.type !== "private" && (
                <button
                  onClick={handleNavigatorShare}
                  className="w-full flex items-center justify-center gap-2 p-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
                >
                  <Share2 size={16} />
                  <span className="text-sm font-medium">Share Match</span>
                </button>
              )}
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wider">Quick Actions</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  onClick={() => handleAddToCalendar("google")}
                  className="flex items-center justify-center gap-2 p-3 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  <Calendar size={16} className="text-gray-600" />
                  <span className="text-sm font-medium">Add to Calendar</span>
                </button>
                {matchData.type !== "private" && (
                  <button
                    onClick={() => handleShare("copy")}
                    className="flex items-center justify-center gap-2 p-3 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors"
                  >
                    <Copy size={16} className="text-gray-600" />
                    <span className="text-sm font-medium">Copy Link</span>
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4">
              <button
                onClick={goBackToHome}
                className="flex items-center justify-center gap-2 px-6 py-4 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
              >
                <Home size={16} />
                Back to Home
              </button>
              <button
                onClick={resetFlow}
                className="px-6 py-4 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
              >
                Create Another
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </div>
    </div>
  );
};

export default MatchCreatorFlow;
