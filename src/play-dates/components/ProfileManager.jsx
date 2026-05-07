import { useEffect, useRef, useState } from "react";
import { X, Loader2, UserRound, Info, Users, Plus, Trash2 } from "lucide-react";
import { getPersonalDetails } from "../services/auth";
import { formatPhoneNumber, formatPhoneDisplay } from "../services/phone";
import { searchPlayers } from "../services/matches";
import {
  createMatchGroup,
  deleteMatchGroup,
  listMatchGroups,
} from "../services/matchGroups";
import ProfilePhotoUploader from "./ProfilePhotoUploader";
import {
  updatePlayerPersonalDetails,
  normalizeRatingForApi,
} from "../services/player";

const USTA_RATING_OPTIONS = [
  { value: "", label: "Select your rating" },
  { value: "1.0", label: "1.0 — New to tennis" },
  { value: "1.5", label: "1.5" },
  { value: "2.0", label: "2.0" },
  { value: "2.5", label: "2.5" },
  { value: "3.0", label: "3.0" },
  { value: "3.5", label: "3.5" },
  { value: "4.0", label: "4.0" },
  { value: "4.5", label: "4.5" },
  { value: "5.0", label: "5.0" },
  { value: "5.5", label: "5.5" },
  { value: "6.0", label: "6.0" },
  { value: "6.5", label: "6.5" },
  { value: "7.0", label: "7.0 — Tour level" },
];

const emptyDetails = {
  id: null,
  full_name: "",
  phone: "",
  profile_picture: "",
  date_of_birth: "",
  usta_rating: "",
  uta_rating: "",
  about_me: "",
};

const formatRatingOptionValue = (value) => {
  const normalized = normalizeRatingForApi(value);
  if (normalized === undefined || normalized === null) {
    if (value === null || value === undefined) {
      return "";
    }

    if (typeof value === "string") {
      return value.trim();
    }

    return "";
  }

  return normalized;
};

const ProfileManager = ({
  isOpen,
  onClose,
  onProfileUpdate,
  initialSection = "profile",
}) => {
  const [details, setDetails] = useState(emptyDetails);
  const [phoneInput, setPhoneInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [imagePreview, setImagePreview] = useState("");
  const [showRatingGuide, setShowRatingGuide] = useState(false);
  const [groups, setGroups] = useState([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [groupError, setGroupError] = useState("");
  const [groupName, setGroupName] = useState("");
  const [groupDescription, setGroupDescription] = useState("");
  const [groupPlayerSearch, setGroupPlayerSearch] = useState("");
  const [groupPlayerResults, setGroupPlayerResults] = useState([]);
  const [selectedGroupPlayers, setSelectedGroupPlayers] = useState([]);
  const [savingGroup, setSavingGroup] = useState(false);
  const groupsSectionRef = useRef(null);
  const accessToken = localStorage.getItem("authToken");

  useEffect(() => {
    if (isOpen) {
      fetchDetails();
    } else {
      setDetails(emptyDetails);
      setPhoneInput("");
      setError("");
      setImagePreview("");
      setShowRatingGuide(false);
      setGroupError("");
      setGroupName("");
      setGroupDescription("");
      setGroupPlayerSearch("");
      setGroupPlayerResults([]);
      setSelectedGroupPlayers([]);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    fetchGroups();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || initialSection !== "groups") return undefined;

    const timeout = window.setTimeout(() => {
      groupsSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 50);

    return () => window.clearTimeout(timeout);
  }, [initialSection, isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const query = groupPlayerSearch.trim();
    if (query.length < 2) {
      setGroupPlayerResults([]);
      return undefined;
    }

    let cancelled = false;
    const timeout = setTimeout(async () => {
      try {
        const data = await searchPlayers({ search: query, perPage: 8 });
        if (cancelled) return;
        const players = Array.isArray(data?.players) ? data.players : [];
        setGroupPlayerResults(players);
      } catch (err) {
        if (!cancelled) {
          console.error("Failed to search players for group", err);
          setGroupPlayerResults([]);
        }
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [groupPlayerSearch, isOpen]);

  const fetchDetails = async ({ showLoader = true } = {}) => {
    try {
      if (showLoader) {
        setLoading(true);
      }
      const data = await getPersonalDetails();
      const normalizedDetails = {
        id: data?.id ?? null,
        full_name: data?.full_name || "",
        phone: data?.phone ? String(data.phone).replace(/\D/g, "") : "",
        profile_picture: data?.profile_picture || "",
        date_of_birth: data?.date_of_birth
          ? data.date_of_birth.split("T")[0]
          : "",
        usta_rating: formatRatingOptionValue(data?.usta_rating),
        uta_rating: formatRatingOptionValue(data?.uta_rating),
        about_me: data?.about_me || "",
      };
      setDetails(normalizedDetails);
      setPhoneInput(formatPhoneDisplay(data?.phone) || "");
      setImagePreview(normalizedDetails.profile_picture || "");
      if (onProfileUpdate) {
        onProfileUpdate({ ...data });
      }
    } catch (err) {
      console.error(err);
      setError("Failed to load profile details. Please try again.");
    } finally {
      if (showLoader) {
        setLoading(false);
      }
    }
  };

  const fetchGroups = async () => {
    try {
      setGroupsLoading(true);
      const data = await listMatchGroups();
      setGroups(Array.isArray(data?.groups) ? data.groups : []);
      setGroupError("");
    } catch (err) {
      console.error(err);
      setGroupError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to load match groups.",
      );
    } finally {
      setGroupsLoading(false);
    }
  };

  const normalizePlayerId = (player) => Number(player?.user_id ?? player?.id);

  const addGroupPlayer = (player) => {
    const id = normalizePlayerId(player);
    if (!Number.isFinite(id)) return;
    setSelectedGroupPlayers((prev) => {
      if (prev.some((item) => normalizePlayerId(item) === id)) return prev;
      return [...prev, player];
    });
    setGroupPlayerSearch("");
    setGroupPlayerResults([]);
  };

  const removeGroupPlayer = (playerId) => {
    setSelectedGroupPlayers((prev) =>
      prev.filter((player) => normalizePlayerId(player) !== Number(playerId)),
    );
  };

  const handleCreateGroup = async () => {
    const name = groupName.trim();
    if (!name) {
      setGroupError("Enter a group name.");
      return;
    }
    const playerIds = selectedGroupPlayers
      .map(normalizePlayerId)
      .filter((id) => Number.isFinite(id));
    if (!playerIds.length) {
      setGroupError("Add at least one player to the group.");
      return;
    }

    try {
      setSavingGroup(true);
      await createMatchGroup({
        name,
        description: groupDescription.trim() || null,
        playerIds,
        player_ids: playerIds,
      });
      setGroupName("");
      setGroupDescription("");
      setSelectedGroupPlayers([]);
      setGroupPlayerSearch("");
      await fetchGroups();
    } catch (err) {
      console.error(err);
      setGroupError(
        err?.response?.data?.message ||
          err?.response?.data?.detail ||
          err?.message ||
          "Failed to save group.",
      );
    } finally {
      setSavingGroup(false);
    }
  };

  const handleDeleteGroup = async (groupId) => {
    if (!window.confirm("Delete this match group?")) return;
    try {
      await deleteMatchGroup(groupId);
      await fetchGroups();
    } catch (err) {
      console.error(err);
      setGroupError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to delete group.",
      );
    }
  };

  const handlePhoneChange = (value) => {
    const formatted = formatPhoneNumber(value);
    const digits = formatted.replace(/\D/g, "");
    setPhoneInput(formatted);
    setDetails((prev) => ({ ...prev, phone: digits }));
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    if (!details.id) {
      setSaving(false);
      setError("We couldn't determine your player profile. Please reload and try again.");
      return;
    }
    if (!accessToken) {
      setSaving(false);
      setError("Please sign in again to update your profile.");
      return;
    }
    try {
      const hasValue = (value) => {
        if (value === null || value === undefined) {
          return false;
        }
        return String(value).trim() !== "";
      };

      const normalizedUstaRating = normalizeRatingForApi(details.usta_rating);
      const normalizedUtaRating = normalizeRatingForApi(details.uta_rating);

      if (hasValue(details.usta_rating) && normalizedUstaRating === undefined) {
        setSaving(false);
        setError("Please enter a valid USTA rating (try numbers like 3.5).");
        return;
      }

      if (hasValue(details.uta_rating) && normalizedUtaRating === undefined) {
        setSaving(false);
        setError("Please enter a valid UTA rating (try numbers like 7.0).");
        return;
      }

      const sanitizedPhone = String(details.phone || "").replace(/\D/g, "");
      const aboutMe = details.about_me?.trim();
      const payload = {
        player: accessToken,
        id: details.id,
        date_of_birth: details.date_of_birth || null,
        fullName: details.full_name?.trim() || null,
        mobile: sanitizedPhone ? sanitizedPhone : null,
        about_me: aboutMe || null,
      };

      if (normalizedUstaRating !== undefined) {
        payload.usta_rating = normalizedUstaRating;
      }

      if (normalizedUtaRating !== undefined) {
        payload.uta_rating = normalizedUtaRating;
      }

      await updatePlayerPersonalDetails(payload);
      if (onProfileUpdate) {
        onProfileUpdate({
          ...details,
          ...(normalizedUstaRating !== undefined
            ? { usta_rating: normalizedUstaRating }
            : {}),
          ...(normalizedUtaRating !== undefined
            ? { uta_rating: normalizedUtaRating }
            : {}),
        });
      }
      onClose();
    } catch (err) {
      console.error(err);
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "We couldn't save your profile. Please try again."
      );
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 backdrop-blur-sm p-4 sm:p-6">
      <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-4rem)]">
        <div className="flex items-start justify-between px-4 py-4 sm:px-6 sm:py-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white flex items-center justify-center shadow-lg">
              <UserRound className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-black text-gray-900">Player Profile</h2>
              <p className="text-sm font-medium text-gray-500">
                Keep your personal information up to date
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
            aria-label="Close profile manager"
          >
            <X className="w-4 h-4 text-gray-600" />
          </button>
        </div>

        <form
          onSubmit={handleUpdate}
          className="flex-1 overflow-y-auto px-4 py-5 sm:px-6 space-y-5"
        >
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <label className="text-sm font-black text-gray-700 uppercase tracking-wider">
                  Full Name
                </label>
                <input
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors font-semibold text-gray-800"
                  type="text"
                  placeholder="Jane Doe"
                  value={details.full_name}
                  onChange={(e) =>
                    setDetails((prev) => ({
                      ...prev,
                      full_name: e.target.value,
                    }))
                  }
                  autoFocus={initialSection !== "groups"}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-black text-gray-700 uppercase tracking-wider">
                  Mobile Number
                </label>
                <input
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors font-semibold text-gray-800"
                  type="tel"
                  placeholder="(555) 123-4567"
                  value={phoneInput}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                  maxLength={14}
                  inputMode="tel"
                />
                <p className="text-xs font-semibold text-gray-500">
                  We'll use this number to share match reminders.
                </p>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-black text-gray-700 uppercase tracking-wider">
                  Profile Photo
                </label>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
                  <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-100 to-emerald-200 p-[3px]">
                    <div className="w-full h-full rounded-[14px] bg-white flex items-center justify-center overflow-hidden">
                      {imagePreview ? (
                        <img
                          src={imagePreview}
                          alt="Profile preview"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <UserRound className="w-8 h-8 text-emerald-500" />
                      )}
                    </div>
                  </div>
                  <div className="space-y-2 w-full">
                    <ProfilePhotoUploader
                      accessToken={accessToken}
                      onUploaded={() => fetchDetails({ showLoader: false })}
                      className="px-4 py-2 rounded-xl font-bold text-white bg-gradient-to-r from-emerald-500 to-green-500 shadow hover:shadow-md transition-shadow inline-flex items-center justify-center cursor-pointer"
                      disabledLabel="Uploading…"
                      label="Upload from device"
                      errorClassName="text-sm font-semibold text-red-600"
                    />
                    <p className="text-xs font-semibold text-gray-500">
                      JPG or PNG, up to 5MB. We'll resize it to fit nicely in the app.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-black text-gray-700 uppercase tracking-wider">
                  Date of Birth
                </label>
                <input
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors font-semibold text-gray-800"
                  type="date"
                  value={details.date_of_birth}
                  onChange={(e) =>
                    setDetails((prev) => ({
                      ...prev,
                      date_of_birth: e.target.value,
                    }))
                  }
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-sm font-black text-gray-700 uppercase tracking-wider">
                    USTA Rating
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowRatingGuide((prev) => !prev)}
                    className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-emerald-700 transition-colors hover:border-emerald-300 hover:bg-emerald-100"
                    aria-expanded={showRatingGuide}
                    aria-controls="usta-rating-guide"
                  >
                    <Info className="h-3.5 w-3.5" />
                    Rating Guide
                  </button>
                </div>
                  <select
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors font-semibold text-gray-800"
                    value={details.usta_rating}
                    onChange={(e) =>
                      setDetails((prev) => ({
                        ...prev,
                        usta_rating: e.target.value,
                      }))
                    }
                  >
                    {USTA_RATING_OPTIONS.map((option) => (
                      <option key={option.value || "placeholder"} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs font-semibold text-gray-500">
                    Not sure of your rating? Most new adult players start around 2.5. Open the
                    Rating Guide for a quick breakdown of each level.
                  </p>
                  {showRatingGuide && (
                    <div
                      id="usta-rating-guide"
                      className="mt-3 space-y-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-emerald-900 shadow-inner"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="flex items-center gap-2 text-sm font-black">
                          <span className="text-lg" aria-hidden="true">
                            🎾
                          </span>
                          NTRP Ratings Explained
                        </p>
                        <button
                          type="button"
                          onClick={() => setShowRatingGuide(false)}
                          className="rounded-full bg-emerald-100 px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-emerald-700 transition-colors hover:bg-emerald-200"
                        >
                          Close
                        </button>
                      </div>
                      <p className="text-xs font-semibold">
                        The NTRP (National Tennis Rating Program) helps players find opponents of similar
                        ability. Ratings range from 1.0 (beginner) to 7.0 (tour-level):
                      </p>
                      <ul className="space-y-1.5 text-xs font-semibold">
                        <li>
                          <span className="font-bold">1.0–2.5:</span> Just starting out — learning basic
                          strokes and how to keep the ball in play.
                        </li>
                        <li>
                          <span className="font-bold">3.0:</span> Can rally consistently, but struggles with
                          depth and control in matches.
                        </li>
                        <li>
                          <span className="font-bold">3.5:</span> Reliable strokes with moderate pace; starting
                          to use strategy and placement.
                        </li>
                        <li>
                          <span className="font-bold">4.0:</span> Strong consistency, control, and basic
                          tactics; can handle pace and spin.
                        </li>
                        <li>
                          <span className="font-bold">4.5:</span> Aggressive play with variety, dependable under
                          pressure, good net skills.
                        </li>
                        <li>
                          <span className="font-bold">5.0+:</span> Advanced or former college/tournament player;
                          can control all aspects of the game.
                        </li>
                      </ul>
                      <p className="text-xs font-bold">
                        👉 Use this as a guide to match up with players around your level for more fun and
                        competitive tennis!
                      </p>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-black text-gray-700 uppercase tracking-wider">
                    UTA Rating
                  </label>
                  <input
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors font-semibold text-gray-800"
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    min="0"
                    placeholder="e.g. 7.0"
                    value={details.uta_rating}
                    onChange={(e) =>
                      setDetails((prev) => ({
                        ...prev,
                        uta_rating: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>
            </>
          )}

          {!loading && (
            <section
              ref={groupsSectionRef}
              className="rounded-2xl border border-violet-100 bg-violet-50/60 p-4"
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-violet-600" />
                    <h3 className="text-sm font-black uppercase tracking-wider text-violet-900">
                      My Match Groups
                    </h3>
                  </div>
                  <p className="mt-1 text-xs font-semibold text-violet-700">
                    Private groups help you quickly notify or invite regular players.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={fetchGroups}
                  disabled={groupsLoading}
                  className="rounded-lg border border-violet-200 bg-white px-3 py-1.5 text-xs font-black text-violet-700 disabled:opacity-60"
                >
                  {groupsLoading ? "Loading" : "Refresh"}
                </button>
              </div>

              <div className="space-y-3 rounded-xl bg-white p-3">
                <input
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-800 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
                  placeholder="Group name, e.g. Sat AM 4.0 regulars"
                  value={groupName}
                  onChange={(event) => setGroupName(event.target.value)}
                  maxLength={60}
                  autoFocus={initialSection === "groups"}
                />
                <input
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-800 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
                  placeholder="Description (optional)"
                  value={groupDescription}
                  onChange={(event) => setGroupDescription(event.target.value)}
                  maxLength={160}
                />
                <div className="relative">
                  <input
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-800 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
                    placeholder="Search players to add"
                    value={groupPlayerSearch}
                    onChange={(event) => setGroupPlayerSearch(event.target.value)}
                  />
                  {groupPlayerResults.length > 0 && (
                    <div className="absolute z-10 mt-2 max-h-52 w-full overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-xl">
                      {groupPlayerResults.map((player) => {
                        const id = normalizePlayerId(player);
                        const name = player.full_name || player.name || player.email || `Player ${id}`;
                        return (
                          <button
                            key={id || name}
                            type="button"
                            onClick={() => addGroupPlayer(player)}
                            className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm font-semibold text-gray-700 hover:bg-violet-50"
                          >
                            <span>{name}</span>
                            <Plus className="h-4 w-4 text-violet-500" />
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
                {selectedGroupPlayers.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {selectedGroupPlayers.map((player) => {
                      const id = normalizePlayerId(player);
                      const name = player.full_name || player.name || player.email || `Player ${id}`;
                      return (
                        <span
                          key={id || name}
                          className="inline-flex items-center gap-2 rounded-full bg-violet-100 px-3 py-1 text-xs font-bold text-violet-700"
                        >
                          {name}
                          <button type="button" onClick={() => removeGroupPlayer(id)}>
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}
                <button
                  type="button"
                  onClick={handleCreateGroup}
                  disabled={savingGroup}
                  className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-black text-white shadow-sm hover:bg-violet-700 disabled:opacity-60"
                >
                  <Plus className="h-4 w-4" />
                  {savingGroup ? "Saving group" : "Create group"}
                </button>
              </div>

              <div className="mt-4 space-y-2">
                {groups.length === 0 && !groupsLoading ? (
                  <p className="rounded-xl border border-dashed border-violet-200 bg-white px-3 py-3 text-sm font-semibold text-violet-700">
                    No groups yet.
                  </p>
                ) : (
                  groups.map((group) => (
                    <div
                      key={group.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-violet-100 bg-white px-3 py-3"
                    >
                      <div>
                        <p className="text-sm font-black text-gray-900">{group.name}</p>
                        <p className="text-xs font-semibold text-gray-500">
                          {group.member_count || 0} players
                          {group.description ? ` • ${group.description}` : ""}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteGroup(group.id)}
                        className="rounded-full p-2 text-gray-400 hover:bg-red-50 hover:text-red-500"
                        aria-label={`Delete ${group.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </section>
          )}

          {groupError && (
            <div className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm font-semibold text-violet-700">
              {groupError}
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-gray-200 font-bold text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || loading}
              className="px-5 py-2.5 rounded-xl font-black text-white bg-gradient-to-r from-green-500 to-emerald-600 shadow-lg hover:shadow-xl transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving
                </>
              ) : (
                "Save"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProfileManager;
