import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Calendar,
  Check,
  ChevronRight,
  Globe,
  Lock,
  MapPin,
  Plus,
  Search,
  Share2,
  Users,
  X,
} from "lucide-react";
import PlayerAvatar from "./PlayerAvatar";
import WhenPicker from "./WhenPicker";
import LocationPicker from "./LocationPicker";
import { formatDayLabel, formatTimeLabel } from "../utils/matchTimeLabels";
import { createMatch, searchPlayers, sendInvites } from "../services/matches";
import { getMatchGroup, listMatchGroups } from "../services/matchGroups";
import { getStoredAuthToken } from "../services/authToken";
import { getPersonalDetails } from "../services/auth";
import { updatePlayerPersonalDetails } from "../services/player";
import { buildMatchPayloadFromCard } from "../utils/buildMatchPayload";
import {
  buildAvailabilityShareMessage,
  mergeCreateResults,
  resolveShareHostId,
  summarizeResults,
} from "../utils/multiMatchCreate";
import {
  loadRecentLocations,
  recordRecentLocation,
  RECENT_LOCATIONS_EVENT,
} from "../utils/recentLocations";
import {
  loadRecentPlayers,
  recordRecentPlayer,
  recordRecentPlayers,
  RECENT_PLAYERS_EVENT,
} from "../utils/recentPlayers";
import { getAvatarInitials, getAvatarUrlFromPlayer } from "../utils/avatar";

// Clamp to backend skill vocabulary (utils/matchOptions.js tops out at "4.5+").
const NTRP = ["2.5", "3.0", "3.5", "4.0", "4.5+"];

// Per-format config. Player count is fixed for Singles/Doubles; variable
// (clamped 3-12) for Round-robin/Dingles. The label "Round-robin" is mapped to
// the backend's "Round Robin" inside buildMatchPayload.
const FMT = {
  Singles: { count: 2, fixed: true },
  Doubles: { count: 4, fixed: true },
  "Round-robin": { count: 6, fixed: false },
  Dingles: { count: 4, fixed: false },
};
const FORMATS = Object.keys(FMT);
const DURATIONS = ["1", "1.5", "2", "3"];
const MAX_PRIVATE_INVITES = 30;

// Fallback, host-editable share message for the open-match success screen.
const SHARE_MESSAGE = buildAvailabilityShareMessage();

const normalizePlayer = (player) => {
  const id = Number(player?.user_id ?? player?.id);
  const name = player?.full_name || player?.name || player?.email || "Player";
  const ntrp = player?.skill_level || player?.ntrp || "";
  return {
    id,
    name,
    email: player?.email || "",
    ntrp,
    avatar: getAvatarInitials(name, player?.email),
    avatarUrl: getAvatarUrlFromPlayer(player),
    raw: player,
  };
};

const normalizePhone = (value) => {
  if (!value) return "";
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
};

let cardSeq = 1;
const newCard = () => ({
  id: cardSeq++,
  format: "Singles",
  count: FMT.Singles.count,
  levelMode: "my", // "my" | "range"
  rMin: "3.0",
  rMax: "4.0",
  date: "",
  startTime: "",
  duration: "",
  location: "",
  latitude: null,
  longitude: null,
  expanded: true,
  saved: false,
});

// Map any stored rating into our NTRP buckets so an existing rating is honored
// even when it isn't an exact bucket string ("4.5"/"5.0" → "4.5+", "4" → "4.0").
const normalizeToNtrp = (raw) => {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  if (NTRP.includes(s)) return s;
  const n = parseFloat(s);
  if (!Number.isFinite(n)) return null;
  if (n >= 4.5) return "4.5+";
  if (n <= 2.5) return "2.5";
  const rounded = (Math.round(n * 2) / 2).toFixed(1);
  return NTRP.includes(rounded) ? rounded : "4.5+";
};

const initialRating = (currentUser) =>
  normalizeToNtrp(
    currentUser?.skillLevel ??
      currentUser?.profile?.usta_rating ??
      currentUser?.usta_rating ??
      currentUser?.ntrp,
  );

function MultiMatchCreatorFlow({
  onCancel,
  onReturnHome,
  onMatchCreated,
  onCreateGroup,
  currentUser,
}) {
  const [screen, setScreen] = useState("type"); // type|build|when|loc|share|invite|success
  const [type, setType] = useState("open"); // open|private
  const [cards, setCards] = useState(() => [newCard()]);
  const [activeCardId, setActiveCardId] = useState(null);
  const [playerRating, setPlayerRating] = useState(() =>
    initialRating(currentUser),
  );
  const [editingRating, setEditingRating] = useState(false);
  const bodyRef = useRef(null);
  const [postToFeed, setPostToFeed] = useState(true); // open broadcast toggle (default on)
  const [recentLocations, setRecentLocations] = useState(() =>
    loadRecentLocations(),
  );
  const [creating, setCreating] = useState(false);
  const [createResults, setCreateResults] = useState([]);
  const [toast, setToast] = useState(null);

  // invite state (private)
  const [inviteTab, setInviteTab] = useState("search"); // search|groups|sms
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [recentPlayers, setRecentPlayers] = useState(() => loadRecentPlayers());
  const [matchGroups, setMatchGroups] = useState([]);
  const [invitedPlayers, setInvitedPlayers] = useState([]);
  const [manualInvitees, setManualInvitees] = useState([]);
  const [smsFirstName, setSmsFirstName] = useState("");
  const [smsPhone, setSmsPhone] = useState("");
  const manualSeq = useRef(1);

  const showToast = useCallback((message, kind = "success") => {
    setToast({ message, kind });
    setTimeout(() => setToast(null), 2500);
  }, []);

  const hostId = useMemo(() => {
    return resolveShareHostId(currentUser);
  }, [currentUser]);

  const profileDetailsId = useMemo(() => {
    const id = Number(
      currentUser?.profile?.id ??
        currentUser?.personal_details_id ??
        currentUser?.personalDetailsId ??
        currentUser?.profile_id,
    );
    return Number.isFinite(id) ? id : null;
  }, [currentUser]);

  useEffect(() => {
    const nextRating = initialRating(currentUser);
    if (!nextRating) return;
    setPlayerRating((previous) => previous || nextRating);
  }, [currentUser]);

  const persistPlayerRating = useCallback((value, profileDetails = null) => {
    try {
      const stored = localStorage.getItem("user");
      const parsed = stored ? JSON.parse(stored) : null;
      if (!parsed || typeof parsed !== "object") return;
      const profile =
        parsed.profile && typeof parsed.profile === "object"
          ? parsed.profile
          : {};
      localStorage.setItem(
        "user",
        JSON.stringify({
          ...parsed,
          skillLevel: value,
          profile: {
            ...profile,
            ...(profileDetails && typeof profileDetails === "object"
              ? profileDetails
              : {}),
            usta_rating: value,
          },
        }),
      );
    } catch (error) {
      console.warn("Unable to persist player rating", error);
    }
  }, []);

  // Native share with clipboard fallback so the button never dead-ends.
  const handleShareAvailability = useCallback(
    async (message) => {
      const url = hostId
        ? `${window.location.origin}/#/players/${hostId}`
        : window.location.origin;
      const text = (message ?? SHARE_MESSAGE).trim();
      try {
        if (typeof navigator !== "undefined" && navigator.share) {
          await navigator.share({ title: "My open match times", text, url });
          return;
        }
      } catch (error) {
        if (error?.name === "AbortError") return; // host dismissed the sheet
      }
      try {
        if (typeof navigator !== "undefined" && navigator.clipboard) {
          await navigator.clipboard.writeText(`${text} ${url}`);
          showToast("Copied!");
          return;
        }
      } catch {
        /* ignore clipboard failure */
      }
      showToast("Couldn't open share — copy the link manually", "error");
    },
    [hostId, showToast],
  );

  // Set/update the host's NTRP and persist it to their profile (best-effort —
  // a failed save never blocks match creation).
  const applyPlayerRating = useCallback(
    async (value) => {
      setPlayerRating(value);
      setEditingRating(false);
      const token = getStoredAuthToken();
      if (!token) return;
      try {
        let detailsId = profileDetailsId;
        let profileDetails = null;
        if (!detailsId) {
          profileDetails = await getPersonalDetails();
          detailsId = Number(profileDetails?.id);
        }
        if (!Number.isFinite(detailsId)) {
          throw new Error("Missing player profile id");
        }
        const apiRating = value === "4.5+" ? "4.5" : value;
        await updatePlayerPersonalDetails({
          player: token,
          id: detailsId,
          usta_rating: apiRating,
        });
        persistPlayerRating(apiRating, profileDetails);
        showToast("Saved to your profile");
      } catch (err) {
        console.warn("Failed to save rating to profile", err);
      }
    },
    [persistPlayerRating, profileDetailsId, showToast],
  );

  // reset scroll to top whenever the visible screen changes
  useEffect(() => {
    bodyRef.current?.scrollTo?.({ top: 0 });
  }, [screen]);

  // keep recent locations in sync with the shared store
  useEffect(() => {
    const sync = () => setRecentLocations(loadRecentLocations());
    window.addEventListener("storage", sync);
    window.addEventListener(RECENT_LOCATIONS_EVENT, sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(RECENT_LOCATIONS_EVENT, sync);
    };
  }, []);

  useEffect(() => {
    const sync = () => setRecentPlayers(loadRecentPlayers());
    window.addEventListener("storage", sync);
    window.addEventListener(RECENT_PLAYERS_EVENT, sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(RECENT_PLAYERS_EVENT, sync);
    };
  }, []);

  // load groups lazily when entering the private branch
  useEffect(() => {
    if (type !== "private") return undefined;
    let cancelled = false;
    listMatchGroups()
      .then((data) => {
        if (!cancelled) {
          setMatchGroups(Array.isArray(data?.groups) ? data.groups : []);
        }
      })
      .catch(() => {
        if (!cancelled) setMatchGroups([]);
      });
    return () => {
      cancelled = true;
    };
  }, [type]);

  // debounced player search
  useEffect(() => {
    if (inviteTab !== "search") return undefined;
    const q = searchQuery.trim();
    if (q.length < 2) {
      setSearchResults([]);
      setSearchLoading(false);
      return undefined;
    }
    setSearchLoading(true);
    const handle = setTimeout(() => {
      searchPlayers({ search: q, page: 1, perPage: 8 })
        .then((data) => setSearchResults((data?.players || []).map(normalizePlayer)))
        .catch(() => setSearchResults([]))
        .finally(() => setSearchLoading(false));
    }, 300);
    return () => clearTimeout(handle);
  }, [searchQuery, inviteTab]);

  const savedCards = useMemo(() => cards.filter((c) => c.saved), [cards]);
  const canAdvance = savedCards.length > 0;

  const updateCard = useCallback((id, patch) => {
    setCards((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    );
  }, []);

  // ---- build-screen card actions ----
  const toggleCard = (id) =>
    setCards((prev) =>
      prev.map((c) => {
        if (c.id === id) return { ...c, expanded: !c.expanded };
        if (c.expanded && c.saved) return { ...c, expanded: false };
        return c;
      }),
    );

  const setFormat = (id, format) =>
    updateCard(id, { format, count: FMT[format].count });

  const bumpCount = (id, delta) => {
    const card = cards.find((c) => c.id === id);
    if (!card) return;
    updateCard(id, { count: Math.max(3, Math.min(12, card.count + delta)) });
  };

  const setRange = (id, which, value) => {
    const card = cards.find((c) => c.id === id);
    if (!card) return;
    if (which === "min") {
      const next = { rMin: value };
      if (NTRP.indexOf(card.rMax) < NTRP.indexOf(value)) next.rMax = value;
      updateCard(id, next);
    } else {
      const next = { rMax: value };
      if (NTRP.indexOf(card.rMin) > NTRP.indexOf(value)) next.rMin = value;
      updateCard(id, next);
    }
  };

  const doneCard = (id) => {
    const card = cards.find((c) => c.id === id);
    if (!card) return;
    const levelOk = card.levelMode === "range" || Boolean(playerRating);
    // Location must be chosen from the autocomplete so it carries real coords —
    // typed-only text won't geocode and would be dropped from distance lists.
    const geoOk =
      Boolean(card.location) && card.latitude != null && card.longitude != null;
    const basicsOk = card.format && card.date && card.startTime;
    if (!(basicsOk && levelOk && geoOk)) {
      let msg = "Pick a format, day and time before saving";
      if (basicsOk && !levelOk) {
        msg = "Add your level (or pick Custom range) before saving";
      } else if (basicsOk && levelOk && !geoOk) {
        msg = "Pick a location from the dropdown so we can map it";
      }
      showToast(msg, "error");
      return;
    }
    updateCard(id, { saved: true, expanded: false });
  };

  const removeCard = (id) =>
    setCards((prev) => {
      const next = prev.filter((c) => c.id !== id);
      return next.length ? next : [newCard()];
    });

  // Multi-card stacking is OPEN-ONLY. Private is always a single match.
  const addCard = () => {
    if (type === "private") return;
    setCards((prev) => [
      ...prev.map((c) => (c.saved ? { ...c, expanded: false } : c)),
      newCard(),
    ]);
  };

  const pickType = (next) => {
    setType(next);
    // Private can't be a batch — collapse to a single card (keep the first).
    if (next === "private") {
      setCards((prev) => prev.slice(0, 1));
    }
  };

  // ---- picker bridges ----
  const openWhen = (id) => {
    setActiveCardId(id);
    setScreen("when");
  };
  const openLoc = (id) => {
    setActiveCardId(id);
    setScreen("loc");
  };
  const saveWhen = (date, startTime) => {
    updateCard(activeCardId, { date, startTime, expanded: true });
    setScreen("build");
  };
  const saveLoc = ({ label, latitude, longitude }) => {
    updateCard(activeCardId, {
      location: label,
      latitude,
      longitude,
      expanded: true,
    });
    setScreen("build");
  };

  // ---- invite actions ----
  const addInvitee = (player) => {
    const normalized = normalizePlayer(player);
    if (!Number.isFinite(normalized.id)) return;
    setInvitedPlayers((prev) =>
      prev.some((p) => p.id === normalized.id) ? prev : [...prev, normalized],
    );
    setSearchQuery("");
    setSearchResults([]);
    setRecentPlayers(recordRecentPlayer(normalized));
  };

  const removeInvitee = (id) =>
    setInvitedPlayers((prev) => prev.filter((p) => p.id !== id));

  const inviteGroup = async (groupId) => {
    try {
      const group = await getMatchGroup(groupId);
      const members = Array.isArray(group?.members) ? group.members : [];
      const normalized = members.map(normalizePlayer).filter((p) => Number.isFinite(p.id));
      setInvitedPlayers((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        return [...prev, ...normalized.filter((p) => !seen.has(p.id))];
      });
      showToast(`Added ${normalized.length} from group`);
    } catch {
      showToast("Couldn't load that group", "error");
    }
  };

  const addManualInvitee = () => {
    const phone = normalizePhone(smsPhone);
    if (!phone) {
      showToast("Enter a valid mobile number", "error");
      return;
    }
    const name = smsFirstName.trim();
    setManualInvitees((prev) => [
      ...prev,
      { id: `manual-${manualSeq.current++}`, phone, firstName: name, name },
    ]);
    setSmsFirstName("");
    setSmsPhone("");
    showToast("Text invite queued");
  };

  const invitedCount = invitedPlayers.length + manualInvitees.length;
  const neededPlayers = savedCards.length ? savedCards[0].count : 2;

  const goNext = () => {
    if (!canAdvance) return;
    setScreen(type === "private" ? "invite" : "share");
  };

  // ---- create ----
  const createCard = async (card) => {
    const payload = buildMatchPayloadFromCard(card, {
      type,
      playerRating,
      // translate the open broadcast toggle to the payload module's existing
      // contract: ON → "listed", OFF → "link_only" (quiet, not posted).
      shareChoice: postToFeed ? "broadcast" : "profile",
    });
    const res = await createMatch(payload);
    const created = res?.match || res;
    const matchId = created?.id || created?.match_id;
    if (!matchId) throw new Error("Match created but no ID returned");

    if (type === "private" && invitedCount > 0) {
      const playerIds = invitedPlayers
        .map((p) => Number(p.id))
        .filter((id) => Number.isFinite(id));
      const phoneNumbers = manualInvitees.map((m) => ({
        phone: m.phone,
        firstName: m.firstName,
        fullName: m.name,
      }));
      if (playerIds.length || phoneNumbers.length) {
        await sendInvites(matchId, { playerIds, phoneNumbers });
      }
    }
    recordRecentLocation(card.location, card.latitude, card.longitude);
    return matchId;
  };

  const runCreate = async (targetCards) => {
    if (creating) return;
    setCreating(true);
    const results = [];
    for (const card of targetCards) {
      try {
        const matchId = await createCard(card);
        results.push({ card, matchId, ok: true });
      } catch (error) {
        results.push({ card, ok: false, error: error?.message || "Failed" });
      }
    }
    setCreating(false);

    setCreateResults((prev) => mergeCreateResults(prev, results));
    const summary = summarizeResults(results);
    const firstSuccess = results.find((r) => r.ok);
    if (firstSuccess) {
      if (type === "private" && invitedPlayers.length) {
        recordRecentPlayers(invitedPlayers);
      }
      onMatchCreated?.(firstSuccess.matchId);
    }
    setScreen("success");
    if (summary.anyFailed) {
      showToast(
        `${summary.succeeded} of ${summary.total} created — some failed`,
        "error",
      );
    }
  };

  const handleCreate = () => runCreate(savedCards);
  const retryFailed = () => {
    const failed = createResults.filter((r) => !r.ok).map((r) => r.card);
    if (failed.length) runCreate(failed);
  };

  // ---- small render helpers ----
  const levelText = (card) => {
    if (card.levelMode === "range") return `${card.rMin}–${card.rMax}`;
    return playerRating ? `${playerRating} NTRP` : "Open level";
  };
  const cardSummaryTitle = (card) =>
    card.date
      ? `${card.format} · ${formatDayLabel(card.date).split(" ")[0]} ${formatTimeLabel(card.startTime)}`
      : `${card.format} · Not scheduled`;

  // ===================== sub-screens =====================
  if (screen === "when") {
    const card = cards.find((c) => c.id === activeCardId);
    return (
      <Shell>
        <WhenPicker
          initialDate={card?.date || ""}
          initialTime={card?.startTime || ""}
          onSave={saveWhen}
          onCancel={() => setScreen("build")}
        />
        <Toast toast={toast} />
      </Shell>
    );
  }

  if (screen === "loc") {
    return (
      <Shell>
        <LocationPicker
          recentLocations={recentLocations}
          onSave={saveLoc}
          onCancel={() => setScreen("build")}
        />
        <Toast toast={toast} />
      </Shell>
    );
  }

  // ===================== main screens =====================
  return (
    <Shell>
      <div className="flex min-h-0 flex-1 flex-col">
        {/* header */}
        <div className="flex flex-shrink-0 items-center gap-3 border-b border-slate-100 px-5 pb-3 pt-4">
          <div className="min-w-0 flex-1">
            <div className="text-[11.5px] font-extrabold uppercase tracking-[0.08em] text-violet-700">
              {screen === "type"
                ? "New match play"
                : type === "open"
                  ? "Open match play"
                  : "Private match play"}
            </div>
            <div className="text-[23px] font-extrabold tracking-tight text-slate-900">
              {screen === "type"
                ? "Match type"
                : screen === "build"
                  ? "Build your matches"
                  : screen === "share"
                    ? "Review & share"
                    : screen === "invite"
                      ? "Invite players"
                      : "All set"}
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600"
            aria-label="Close"
          >
            <X size={17} />
          </button>
        </div>

        {/* step dots */}
        {screen !== "success" && (
          <StepBar
            stage={screen === "type" ? 1 : screen === "build" ? 2 : 3}
            thirdLabel={type === "private" ? "Invite" : "Share"}
          />
        )}

        {/* body */}
        <div ref={bodyRef} className="flex-1 overflow-y-auto px-5 py-4">
          {screen === "type" && (
            <TypeScreen type={type} onPick={pickType} />
          )}

          {screen === "build" && (
            <>
              <div className="mb-3 flex items-center justify-between text-[11px] font-extrabold uppercase tracking-[0.08em] text-slate-500">
                <span>Your matches</span>
                <span className="text-slate-400">{cards.length}</span>
              </div>
              {cards.map((card, idx) => (
                <MatchCard
                  key={card.id}
                  card={card}
                  index={idx}
                  multiple={cards.length > 1}
                  playerRating={playerRating}
                  levelText={levelText}
                  summaryTitle={cardSummaryTitle}
                  onToggle={() => toggleCard(card.id)}
                  onSetFormat={(f) => setFormat(card.id, f)}
                  onBump={(d) => bumpCount(card.id, d)}
                  onSetLevelMode={(m) => updateCard(card.id, { levelMode: m })}
                  editingRating={editingRating}
                  onEditRating={() => setEditingRating(true)}
                  onSetPlayerRating={applyPlayerRating}
                  onSetRange={(which, v) => setRange(card.id, which, v)}
                  onSetDuration={(d) => updateCard(card.id, { duration: d })}
                  onOpenWhen={() => openWhen(card.id)}
                  onOpenLoc={() => openLoc(card.id)}
                  onDone={() => doneCard(card.id)}
                  onRemove={() => removeCard(card.id)}
                />
              ))}
              {type === "open" && (
                <button
                  type="button"
                  onClick={addCard}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-violet-200 bg-violet-50 px-4 py-4 text-[14.5px] font-extrabold text-violet-700"
                >
                  <Plus size={16} /> Add another match
                </button>
              )}
            </>
          )}

          {screen === "share" && (
            <ShareScreen
              savedCards={savedCards}
              levelText={levelText}
              postToFeed={postToFeed}
              onTogglePostToFeed={() => setPostToFeed((v) => !v)}
            />
          )}

          {screen === "invite" && (
            <InviteScreen
              tab={inviteTab}
              setTab={setInviteTab}
              invitedCount={invitedCount}
              neededPlayers={neededPlayers}
              invitedPlayers={invitedPlayers}
              manualInvitees={manualInvitees}
              onRemoveInvitee={removeInvitee}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              searchResults={searchResults}
              searchLoading={searchLoading}
              recentPlayers={recentPlayers}
              onAddInvitee={addInvitee}
              matchGroups={matchGroups}
              onInviteGroup={inviteGroup}
              onCreateGroup={onCreateGroup}
              smsFirstName={smsFirstName}
              setSmsFirstName={setSmsFirstName}
              smsPhone={smsPhone}
              setSmsPhone={setSmsPhone}
              onAddManual={addManualInvitee}
            />
          )}

          {screen === "success" && (
            <SuccessScreen
              type={type}
              postToFeed={postToFeed}
              results={createResults}
              levelText={levelText}
              summaryTitle={cardSummaryTitle}
              onRetry={retryFailed}
              onShareAvailability={handleShareAvailability}
              onDone={onReturnHome}
            />
          )}
        </div>

        {/* footer */}
        {screen === "type" && (
          <Footer>
            <GhostBtn onClick={onCancel}>Cancel</GhostBtn>
            <PrimaryBtn onClick={() => setScreen("build")}>
              Next <ArrowRight size={16} />
            </PrimaryBtn>
          </Footer>
        )}
        {screen === "build" && (
          <Footer>
            <GhostBtn onClick={() => setScreen("type")}>Back</GhostBtn>
            <PrimaryBtn disabled={!canAdvance} onClick={goNext}>
              Next <ArrowRight size={16} />
            </PrimaryBtn>
          </Footer>
        )}
        {screen === "share" && (
          <Footer>
            <GhostBtn onClick={() => setScreen("build")}>Back</GhostBtn>
            <PrimaryBtn disabled={creating} onClick={handleCreate}>
              {creating
                ? "Creating…"
                : `Create ${savedCards.length} match${savedCards.length > 1 ? "es" : ""}`}
            </PrimaryBtn>
          </Footer>
        )}
        {screen === "invite" && (
          <Footer>
            <GhostBtn onClick={() => setScreen("build")}>Back</GhostBtn>
            <PrimaryBtn disabled={creating} onClick={handleCreate}>
              {creating ? "Creating…" : "Send & create"}
            </PrimaryBtn>
          </Footer>
        )}
      </div>
      <Toast toast={toast} />
    </Shell>
  );
}

// ===================== presentational pieces =====================

const Shell = ({ children }) => (
  <div className="mx-auto flex min-h-[640px] w-full max-w-[440px] flex-col overflow-hidden rounded-3xl bg-white shadow-xl ring-1 ring-slate-200">
    {children}
  </div>
);

const Footer = ({ children }) => (
  <div className="flex flex-shrink-0 gap-2.5 border-t border-slate-100 px-5 py-4">
    {children}
  </div>
);

const GhostBtn = ({ children, ...props }) => (
  <button
    type="button"
    className="rounded-xl border border-slate-200 bg-white px-5 py-3.5 text-[15px] font-extrabold text-slate-700"
    {...props}
  >
    {children}
  </button>
);

const PrimaryBtn = ({ children, ...props }) => (
  <button
    type="button"
    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-violet-500 px-4 py-3.5 text-[15px] font-extrabold text-white shadow-lg shadow-violet-500/30 disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"
    {...props}
  >
    {children}
  </button>
);

const Toast = ({ toast }) =>
  toast ? (
    <div
      className={`pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl px-4 py-2.5 text-[13.5px] font-bold text-white shadow-lg ${
        toast.kind === "error" ? "bg-rose-500" : "bg-slate-900"
      }`}
    >
      {toast.message}
    </div>
  ) : null;

const Switch = ({ checked, ...props }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${
      checked ? "bg-violet-500" : "bg-slate-300"
    }`}
    {...props}
  >
    <span
      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
        checked ? "translate-x-[22px]" : "translate-x-0.5"
      }`}
    />
  </button>
);

const StepBar = ({ stage, thirdLabel }) => {
  const dot = (n, label) => {
    const state = stage > n ? "done" : stage === n ? "active" : "todo";
    return (
      <div className="flex flex-shrink-0 flex-col items-center gap-1">
        <div
          className={`grid h-[30px] w-[30px] place-items-center rounded-full text-[13px] font-extrabold ${
            state === "active"
              ? "bg-violet-500 text-white ring-4 ring-violet-100"
              : state === "done"
                ? "bg-violet-100 text-violet-700"
                : "bg-slate-100 text-slate-400"
          }`}
        >
          {state === "done" ? <Check size={13} /> : n}
        </div>
        <div
          className={`text-[10.5px] font-bold ${state === "active" ? "text-slate-900" : "text-slate-400"}`}
        >
          {label}
        </div>
      </div>
    );
  };
  const line = (done) => (
    <div className={`h-0.5 flex-1 ${done ? "bg-violet-100" : "bg-slate-200"}`} />
  );
  return (
    <div className="flex flex-shrink-0 items-center gap-1.5 px-5 pb-1 pt-3">
      {dot(1, "Type")}
      {line(stage > 1)}
      {dot(2, "Matches")}
      {line(stage > 2)}
      {dot(3, thirdLabel)}
    </div>
  );
};

const TypeScreen = ({ type, onPick }) => (
  <>
    <div className="mb-3 text-[11px] font-extrabold uppercase tracking-[0.08em] text-slate-500">
      Who can join?
    </div>
    {[
      {
        key: "open",
        icon: <Globe size={22} />,
        title: "Open match",
        sub: "Anyone at the right level can join",
      },
      {
        key: "private",
        icon: <Lock size={20} />,
        title: "Private match",
        sub: "Invite specific players only",
      },
    ].map((opt) => {
      const sel = type === opt.key;
      return (
        <button
          key={opt.key}
          type="button"
          onClick={() => onPick(opt.key)}
          className={`mb-3 flex w-full items-center gap-3 rounded-2xl border-2 p-4 text-left ${
            sel ? "border-violet-500 bg-violet-50" : "border-slate-200"
          }`}
        >
          <span
            className={`grid h-12 w-12 flex-shrink-0 place-items-center rounded-xl ${
              sel ? "bg-violet-500 text-white" : "bg-slate-100 text-slate-500"
            }`}
          >
            {opt.icon}
          </span>
          <span className="flex-1">
            <span className="block text-[17px] font-extrabold text-slate-900">
              {opt.title}
            </span>
            <span className="block text-[13.5px] font-semibold text-slate-500">
              {opt.sub}
            </span>
          </span>
          {sel && (
            <span className="grid h-6 w-6 flex-shrink-0 place-items-center rounded-full bg-violet-500 text-white">
              <Check size={14} />
            </span>
          )}
        </button>
      );
    })}
    <div className="mt-1.5 text-[12.5px] font-semibold leading-relaxed text-slate-500">
      You'll build your matches next — each one can be a different format, level,
      time and place.
    </div>
  </>
);

const MatchCard = ({
  card,
  index,
  multiple,
  playerRating,
  levelText,
  summaryTitle,
  onToggle,
  onSetFormat,
  onBump,
  onSetLevelMode,
  editingRating,
  onEditRating,
  onSetPlayerRating,
  onSetRange,
  onSetDuration,
  onOpenWhen,
  onOpenLoc,
  onDone,
  onRemove,
}) => {
  const cfg = FMT[card.format];
  if (!card.expanded) {
    return (
      <div className="mb-3 overflow-hidden rounded-2xl border border-slate-200">
        <button
          type="button"
          onClick={onToggle}
          className="flex w-full items-center gap-3 px-3.5 py-3 text-left"
        >
          <span
            className={`grid h-9 w-9 flex-shrink-0 place-items-center rounded-xl text-[11px] font-extrabold ${
              card.saved
                ? "bg-emerald-50 text-emerald-700"
                : "bg-violet-50 text-violet-700"
            }`}
          >
            {card.saved ? <Check size={15} /> : index + 1}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[14.5px] font-extrabold text-slate-900">
              {summaryTitle(card)}
            </span>
            <span className="block text-[12.5px] font-semibold text-slate-500">
              {levelText(card)}
              {card.duration ? ` · ${card.duration}h` : ""}
              {card.location ? ` · ${card.location.split(" ")[0]}` : ""}
            </span>
          </span>
          <ChevronRight size={18} className="flex-shrink-0 text-slate-300" />
        </button>
      </div>
    );
  }

  return (
    <div className="mb-3 overflow-hidden rounded-2xl border border-violet-100 shadow-md shadow-violet-500/10">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-3.5 py-3 text-left"
      >
        <span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-xl bg-violet-50 text-[11px] font-extrabold text-violet-700">
          {index + 1}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[14.5px] font-extrabold text-slate-900">
            {card.saved ? summaryTitle(card) : `Match ${index + 1}`}
          </span>
          <span className="block text-[12.5px] font-bold text-violet-700">
            {card.saved ? "Editing…" : "Setting up…"}
          </span>
        </span>
        <ChevronRight size={18} className="flex-shrink-0 rotate-90 text-slate-300" />
      </button>

      <div className="border-t border-slate-100 px-3.5 pb-3.5 pt-0.5">
        <FieldLabel>Format</FieldLabel>
        <div className="flex flex-wrap gap-1.5">
          {FORMATS.map((f) => (
            <Pill key={f} selected={card.format === f} onClick={() => onSetFormat(f)}>
              {f}
            </Pill>
          ))}
        </div>
        {cfg.fixed ? (
          <div className="mt-2 text-[11.5px] font-bold text-slate-400">
            {cfg.count} players{card.format === "Doubles" ? " · 2 per side" : ""}
          </div>
        ) : (
          <div className="mt-2.5 flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3.5 py-2.5">
            <span className="text-[13px] font-bold text-slate-700">
              Players
              <span className="block text-[11px] font-semibold text-slate-400">
                including you
              </span>
            </span>
            <span className="flex items-center gap-3">
              <Stepper onClick={() => onBump(-1)}>−</Stepper>
              <span className="min-w-[18px] text-center text-[16px] font-extrabold">
                {card.count}
              </span>
              <Stepper onClick={() => onBump(1)}>+</Stepper>
            </span>
          </div>
        )}

        <FieldLabel>Level</FieldLabel>
        <div className="flex gap-2">
          <LevelOpt
            selected={card.levelMode === "my"}
            onClick={() => onSetLevelMode("my")}
            title="My level"
            sub={playerRating ? `${playerRating} NTRP` : "Add rating"}
          />
          <LevelOpt
            selected={card.levelMode === "range"}
            onClick={() => onSetLevelMode("range")}
            title="Custom range"
            sub="Min–max"
          />
        </div>
        {card.levelMode === "range" ? (
          <div className="mt-2.5 rounded-xl border border-slate-100 bg-slate-50 p-3">
            <RangeLabel>Minimum</RangeLabel>
            <div className="flex flex-wrap gap-1.5">
              {NTRP.map((v) => (
                <RatePill
                  key={v}
                  selected={card.rMin === v}
                  onClick={() => onSetRange("min", v)}
                >
                  {v}
                </RatePill>
              ))}
            </div>
            <RangeLabel className="mt-3">Maximum</RangeLabel>
            <div className="flex flex-wrap gap-1.5">
              {NTRP.map((v) => (
                <RatePill
                  key={v}
                  selected={card.rMax === v}
                  onClick={() => onSetRange("max", v)}
                >
                  {v}
                </RatePill>
              ))}
            </div>
            <div className="mt-2.5 text-[12px] font-bold text-slate-500">
              Players rated {card.rMin} to {card.rMax} can join.
            </div>
          </div>
        ) : !playerRating || editingRating ? (
          <div className="mt-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3">
            <div className="text-[13.5px] font-extrabold text-amber-700">
              {playerRating ? "Update your level" : "Add your level"}
            </div>
            <div className="mb-2.5 text-[12px] font-semibold leading-snug text-slate-600">
              {playerRating
                ? "Pick your NTRP rating — it saves to your profile and applies to every match."
                : "You haven't set your NTRP rating yet. Add it once and it saves to your profile for every match."}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {NTRP.map((v) => (
                <RatePill
                  key={v}
                  selected={playerRating === v}
                  onClick={() => onSetPlayerRating(v)}
                >
                  {v}
                </RatePill>
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-2.5 flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
            <span className="text-[13px] font-bold text-slate-700">
              Your level
              <span className="ml-1.5 text-violet-700">{playerRating} NTRP</span>
            </span>
            <button
              type="button"
              onClick={onEditRating}
              className="text-[12.5px] font-extrabold text-violet-700"
            >
              Change
            </button>
          </div>
        )}

        <FieldLabel>Day &amp; time</FieldLabel>
        <RowButton onClick={onOpenWhen} icon={<Calendar size={15} />}>
          {card.date ? (
            `${formatDayLabel(card.date)} · ${formatTimeLabel(card.startTime)}`
          ) : (
            <span className="font-semibold text-slate-400">Set day &amp; time</span>
          )}
        </RowButton>

        <FieldLabel>Duration</FieldLabel>
        <div className="flex gap-1.5">
          {DURATIONS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => onSetDuration(d)}
              className={`flex-1 rounded-[10px] border py-2.5 text-center text-[13px] font-extrabold ${
                card.duration === d
                  ? "border-violet-500 bg-violet-50 text-violet-700"
                  : "border-slate-200 bg-white text-slate-600"
              }`}
            >
              {d}h
            </button>
          ))}
        </div>

        <FieldLabel>Location</FieldLabel>
        <RowButton onClick={onOpenLoc} icon={<MapPin size={15} />}>
          {card.location || (
            <span className="font-semibold text-slate-400">Add location</span>
          )}
        </RowButton>

        <div className="mt-4 flex gap-2.5">
          {multiple && (
            <button
              type="button"
              onClick={onRemove}
              className="flex-shrink-0 rounded-xl border border-slate-200 bg-white px-4 py-3 text-[13.5px] font-bold text-slate-500"
            >
              Remove
            </button>
          )}
          <button
            type="button"
            onClick={onDone}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-violet-500 px-4 py-3 text-[14.5px] font-extrabold text-white shadow-md shadow-violet-500/30"
          >
            {card.saved ? "Update match" : "Done — save match"}
            <Check size={15} />
          </button>
        </div>
      </div>
    </div>
  );
};

const FieldLabel = ({ children }) => (
  <div className="mb-1.5 mt-3 text-[10px] font-extrabold uppercase tracking-[0.06em] text-slate-400">
    {children}
  </div>
);
const RangeLabel = ({ children, className = "" }) => (
  <div
    className={`mb-1.5 text-[10px] font-extrabold uppercase tracking-[0.05em] text-slate-400 ${className}`}
  >
    {children}
  </div>
);
const Pill = ({ selected, children, ...props }) => (
  <button
    type="button"
    className={`rounded-full border px-3.5 py-1.5 text-[13px] font-extrabold ${
      selected
        ? "border-violet-500 bg-violet-500 text-white"
        : "border-slate-200 bg-white text-slate-600"
    }`}
    {...props}
  >
    {children}
  </button>
);
const RatePill = ({ selected, children, ...props }) => (
  <button
    type="button"
    className={`rounded-[9px] border px-3 py-2 text-[13px] font-extrabold ${
      selected
        ? "border-violet-500 bg-violet-500 text-white"
        : "border-slate-200 bg-white text-slate-600"
    }`}
    {...props}
  >
    {children}
  </button>
);
const Stepper = ({ children, ...props }) => (
  <button
    type="button"
    className="grid h-[30px] w-[30px] place-items-center rounded-[9px] border border-slate-200 bg-white text-[17px] font-extrabold text-violet-700"
    {...props}
  >
    {children}
  </button>
);
const LevelOpt = ({ selected, title, sub, ...props }) => (
  <button
    type="button"
    className={`flex-1 rounded-[10px] border p-2.5 text-center text-[13px] font-extrabold ${
      selected
        ? "border-violet-500 bg-violet-50 text-violet-700"
        : "border-slate-200 bg-white text-slate-600"
    }`}
    {...props}
  >
    {title}
    <span
      className={`block text-[10.5px] font-semibold ${selected ? "text-violet-700" : "text-slate-400"}`}
    >
      {sub}
    </span>
  </button>
);
const RowButton = ({ icon, children, ...props }) => (
  <button
    type="button"
    className="flex w-full items-center gap-2.5 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 text-left text-[14px] font-bold text-slate-700"
    {...props}
  >
    <span className="flex-shrink-0 text-slate-400">{icon}</span>
    <span className="flex-1">{children}</span>
    <ChevronRight size={14} className="text-slate-300" />
  </button>
);

const ShareScreen = ({ savedCards, levelText, postToFeed, onTogglePostToFeed }) => (
  <>
    <div className="mb-3 text-[11px] font-extrabold uppercase tracking-[0.08em] text-slate-500">
      Your matches
    </div>
    <div className="mb-4 rounded-2xl border border-slate-200 px-3.5 shadow-sm">
      {savedCards.map((card) => (
        <div
          key={card.id}
          className="flex items-center gap-2.5 border-b border-slate-100 py-3 last:border-b-0 text-[13.5px] font-bold text-slate-700"
        >
          <Calendar size={15} className="flex-shrink-0 text-violet-500" />
          <span>
            <span className="block">
              {card.format} · {formatDayLabel(card.date)} {formatTimeLabel(card.startTime)}
            </span>
            <span className="block text-[12px] font-semibold text-slate-500">
              {levelText(card)}
              {card.duration ? ` · ${card.duration}h` : ""}
              {card.location ? ` · ${card.location}` : ""}
            </span>
          </span>
        </div>
      ))}
    </div>

    <div className="mb-3 text-[11px] font-extrabold uppercase tracking-[0.08em] text-slate-500">
      Sharing
    </div>

    <div
      className={`flex w-full items-start gap-3 rounded-2xl border-2 p-3.5 ${
        postToFeed ? "border-violet-500 bg-violet-50" : "border-slate-200"
      }`}
    >
      <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl bg-gradient-to-br from-lime-400 to-green-500 text-green-900">
        <Globe size={20} />
      </span>
      <span className="flex-1">
        <span className="block text-[15px] font-extrabold text-slate-900">
          Post to the public feed
        </span>
        <span className="mt-0.5 block text-[12.5px] font-semibold leading-snug text-slate-600">
          {postToFeed
            ? "Anyone at the right level can find and join your matches."
            : "Quiet — saved but not posted. Share the link yourself."}
        </span>
      </span>
      <Switch checked={postToFeed} onClick={onTogglePostToFeed} />
    </div>
  </>
);

const InviteScreen = ({
  tab,
  setTab,
  invitedCount,
  neededPlayers,
  invitedPlayers,
  manualInvitees,
  onRemoveInvitee,
  searchQuery,
  setSearchQuery,
  searchResults,
  searchLoading,
  recentPlayers,
  onAddInvitee,
  matchGroups,
  onInviteGroup,
  onCreateGroup,
  smsFirstName,
  setSmsFirstName,
  smsPhone,
  setSmsPhone,
  onAddManual,
}) => {
  const filledTotal = invitedCount + 1; // +1 host
  const short = neededPlayers - filledTotal;
  const addedIds = new Set(invitedPlayers.map((p) => p.id));
  const suggestions = recentPlayers.filter((p) => !addedIds.has(Number(p.id)));

  return (
    <>
      <div className="-mx-5 mb-4 flex items-center justify-between border-b border-slate-100 bg-slate-50 px-5 py-3">
        <span className="text-[13px] font-bold text-slate-600">
          {filledTotal} of {neededPlayers}
        </span>
        <span
          className={`text-[12px] font-extrabold ${short > 0 ? "text-amber-700" : "text-emerald-700"}`}
        >
          {short > 0 ? `${short} more needed` : "Match is full!"}
        </span>
      </div>

      {(invitedPlayers.length > 0 || manualInvitees.length > 0) && (
        <div className="mb-4 flex flex-wrap gap-2">
          {invitedPlayers.map((p) => (
            <span
              key={p.id}
              className="flex items-center gap-1.5 rounded-full bg-violet-50 py-1 pl-1 pr-2.5 text-[12.5px] font-bold text-violet-700"
            >
              <PlayerAvatar name={p.name} imageUrl={p.avatarUrl} size="xs" showBadge={false} />
              {p.name.split(" ")[0]}
              <button type="button" onClick={() => onRemoveInvitee(p.id)} aria-label="Remove">
                <X size={13} />
              </button>
            </span>
          ))}
          {manualInvitees.map((m) => (
            <span
              key={m.id}
              className="rounded-full bg-slate-100 px-2.5 py-1.5 text-[12.5px] font-bold text-slate-600"
            >
              {m.name || m.phone}
            </span>
          ))}
        </div>
      )}

      <div className="mb-4 flex gap-1 rounded-xl bg-slate-100 p-1">
        {[
          ["search", "Search"],
          ["groups", "Groups"],
          ["sms", "By text"],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`flex-1 rounded-[10px] px-2 py-2.5 text-[13px] font-extrabold ${
              tab === key ? "bg-white text-violet-700 shadow-sm" : "text-slate-500"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "search" && (
        <>
          <div className="mb-3 flex items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-100 px-3.5 py-3">
            <Search size={18} className="flex-shrink-0 text-slate-400" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name or email…"
              className="min-w-0 flex-1 bg-transparent text-[14.5px] font-semibold outline-none"
            />
          </div>
          {searchQuery.trim().length >= 2 ? (
            <PlayerList
              players={searchResults}
              loading={searchLoading}
              addedIds={addedIds}
              onAdd={onAddInvitee}
              emptyText="No players found"
            />
          ) : (
            <>
              <div className="mb-1 text-[11px] font-extrabold uppercase tracking-[0.08em] text-slate-500">
                Frequent teammates
              </div>
              <PlayerList
                players={suggestions}
                addedIds={addedIds}
                onAdd={onAddInvitee}
                emptyText="No recent players yet"
              />
            </>
          )}
        </>
      )}

      {tab === "groups" && (
        <>
          {matchGroups.length === 0 && (
            <div className="mb-3 text-[13px] font-semibold text-slate-500">
              No groups yet.
            </div>
          )}
          {matchGroups.map((group) => {
            const count = group.member_count || group.members?.length || 0;
            return (
              <div
                key={group.id}
                className="mb-3 flex items-center gap-3 rounded-2xl border border-slate-200 p-3.5"
              >
                <div className="flex-1">
                  <div className="text-[15px] font-extrabold text-slate-900">
                    {group.name}
                  </div>
                  <div className="text-[12.5px] font-bold text-slate-500">
                    {count} player{count === 1 ? "" : "s"}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onInviteGroup(group.id)}
                  className="flex-shrink-0 rounded-xl bg-violet-500 px-4 py-2.5 text-[13px] font-extrabold text-white"
                >
                  Invite all
                </button>
              </div>
            );
          })}
          <button
            type="button"
            onClick={() => onCreateGroup?.()}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 px-4 py-3.5 text-[14px] font-extrabold text-violet-700"
          >
            <Plus size={16} /> Create a new group
          </button>
        </>
      )}

      {tab === "sms" && (
        <>
          <div className="mb-4 flex items-start gap-3 text-[13px] font-semibold leading-relaxed text-slate-600">
            <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl bg-violet-50 text-violet-700">
              <Users size={20} />
            </span>
            We'll text a magic link to join — no app download needed.
          </div>
          <input
            value={smsFirstName}
            onChange={(e) => setSmsFirstName(e.target.value)}
            placeholder="First name"
            className="mb-2.5 w-full rounded-xl border border-transparent bg-slate-100 px-3.5 py-3 text-[15px] font-semibold outline-none"
          />
          <input
            value={smsPhone}
            onChange={(e) => setSmsPhone(e.target.value)}
            placeholder="Mobile number"
            className="mb-2.5 w-full rounded-xl border border-transparent bg-slate-100 px-3.5 py-3 text-[15px] font-semibold outline-none"
          />
          <button
            type="button"
            onClick={onAddManual}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-500 px-4 py-3 text-[15px] font-extrabold text-white shadow-lg shadow-violet-500/30"
          >
            <Plus size={16} /> Send text invite
          </button>
        </>
      )}
    </>
  );
};

const PlayerList = ({ players, loading, addedIds, onAdd, emptyText }) => {
  if (loading) {
    return <div className="py-4 text-[13px] font-semibold text-slate-400">Searching…</div>;
  }
  if (!players.length) {
    return <div className="py-4 text-[13px] font-semibold text-slate-400">{emptyText}</div>;
  }
  return players.map((p) => {
    const added = addedIds.has(Number(p.id));
    return (
      <div
        key={p.id}
        className="flex items-center gap-3 border-b border-slate-100 py-2.5"
      >
        <PlayerAvatar name={p.name} imageUrl={p.avatarUrl} size="md" showBadge={false} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14.5px] font-semibold text-slate-900">
            {p.name}
          </div>
          {p.ntrp && (
            <div className="text-[12px] font-semibold text-slate-500">NTRP {p.ntrp}</div>
          )}
        </div>
        <button
          type="button"
          disabled={added}
          onClick={() => onAdd(p)}
          className={`grid h-8 w-8 flex-shrink-0 place-items-center rounded-[10px] border text-[18px] font-extrabold ${
            added
              ? "border-violet-500 bg-violet-500 text-white"
              : "border-violet-100 bg-violet-50 text-violet-700"
          }`}
          aria-label={added ? "Added" : "Add"}
        >
          {added ? <Check size={16} /> : "+"}
        </button>
      </div>
    );
  });
};

const SuccessScreen = ({
  type,
  postToFeed,
  results,
  levelText,
  summaryTitle,
  onRetry,
  onShareAvailability,
  onDone,
}) => {
  const succeeded = results.filter((r) => r.ok);
  const failed = results.filter((r) => !r.ok);
  const defaultShareMessage = useMemo(
    () => buildAvailabilityShareMessage(succeeded),
    [succeeded],
  );
  const [shareMessage, setShareMessage] = useState(defaultShareMessage);
  useEffect(() => {
    setShareMessage(defaultShareMessage);
  }, [defaultShareMessage]);
  const n = succeeded.length;
  const title =
    type === "private"
      ? "Invites sent"
      : `${n} match${n === 1 ? "" : "es"} ${postToFeed ? "posted" : "saved"}`;
  const sub =
    type === "private"
      ? `Your ${n > 1 ? `${n} matches are` : "match is"} created and invites are on their way.`
      : postToFeed
        ? "Live in the feed. Players at the right level can find and join."
        : "Saved privately. Share your availability link below.";

  return (
    <div className="flex flex-col items-center py-6 text-center">
      <div className="mb-4 grid h-[74px] w-[74px] place-items-center rounded-full bg-emerald-50 text-emerald-600">
        <Check size={34} />
      </div>
      <div className="mb-1.5 text-[22px] font-extrabold tracking-tight text-slate-900">
        {title}
      </div>
      <div className="mb-5 text-[14px] font-semibold leading-relaxed text-slate-500">
        {sub}
      </div>

      <div className="mb-5 w-full rounded-2xl border border-slate-100 bg-slate-50 px-3.5">
        {succeeded.map((r) => (
          <div
            key={r.card.id}
            className="flex items-center gap-2.5 border-b border-slate-200 py-3 last:border-b-0 text-left text-[13.5px] font-bold text-slate-700"
          >
            <Calendar size={15} className="flex-shrink-0 text-violet-500" />
            <span>
              {summaryTitle(r.card)} · {levelText(r.card)}
            </span>
          </div>
        ))}
      </div>

      {failed.length > 0 && (
        <div className="mb-4 w-full rounded-2xl border border-rose-200 bg-rose-50 p-3.5 text-left">
          <div className="mb-2 text-[13px] font-extrabold text-rose-700">
            {failed.length} match{failed.length === 1 ? "" : "es"} failed to create
          </div>
          <button
            type="button"
            onClick={onRetry}
            className="w-full rounded-xl bg-rose-600 px-4 py-2.5 text-[14px] font-extrabold text-white"
          >
            Retry failed
          </button>
        </div>
      )}

      {type === "open" && n > 0 && (
        <div className="mb-4 w-full text-left">
          <label className="mb-1.5 block text-[11px] font-extrabold uppercase tracking-[0.08em] text-slate-500">
            Share my availability
          </label>
          <textarea
            value={shareMessage}
            onChange={(e) => setShareMessage(e.target.value)}
            rows={3}
            className="mb-2.5 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[14px] font-semibold leading-snug text-slate-700 outline-none focus:border-violet-500"
            placeholder="Add a personal note…"
          />
          <button
            type="button"
            onClick={() => onShareAvailability?.(shareMessage)}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-violet-500 px-4 py-3.5 text-[15.5px] font-extrabold text-white shadow-lg shadow-violet-500/30"
          >
            <Share2 size={18} /> Share my availability
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={onDone}
        className={`w-full rounded-2xl px-4 py-3.5 text-[15.5px] font-extrabold ${
          type === "open" && n > 0
            ? "border border-slate-200 bg-white text-slate-700"
            : "bg-violet-500 text-white shadow-lg shadow-violet-500/30"
        }`}
      >
        Done
      </button>
    </div>
  );
};

export default MultiMatchCreatorFlow;
