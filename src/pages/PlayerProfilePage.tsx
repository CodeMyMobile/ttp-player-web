import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, BadgeCheck, MapPin, MessageCircle, Users } from "lucide-react";
import moment from "moment";

import MainLayout from "../components/MainLayout";
import AuthDrawer from "../components/auth/AuthDrawer";
import ConnectPlayerModal from "../components/players/ConnectPlayerModal";
import OpenMatchPlayCard from "../components/players/OpenMatchPlayCard";
import { fetchPlayerDetails, fetchPublicPlayerProfile, verifyUserLevel } from "../api/playerHome";
import { getPlayedWith } from "../api/playerHistory";
import { joinMatch, listMatches } from "../play-dates/services/matches";
import { getMatchHostId, idsMatch } from "../play-dates/utils/matchHost";
import { getStoredAuthToken } from "../services/authToken";
import { useAuth } from "../context/AuthContext";
import type { ConnectIntent } from "../types/matchPlay";
import { getStoredMatchProfile } from "../utils/matchProfile";
import { getStoredLocation, DEFAULT_COORDINATES } from "../utils/userLocation";
import { formatPlayedWithCount, type PlayedWithPlayer } from "../utils/playedWith";
import {
  extractSuggestedPlayer,
  mapPublicPlayerProfileRecord,
  mapSuggestedPlayer,
  type DirectoryPlayer,
} from "../utils/suggestedPlayer";
import { buildSmsUrl, getSmsRecipient } from "../utils/smsLink";

type OpenMatch = Record<string, unknown>;

import "./PlayerProfilePage.css";

// "Open match play" = the app's canonical open/upcoming definition
// (mirrors TennisMatchApp.jsx: `status || "upcoming"`, then ["upcoming","open"]).
// Allowlist, so any other status — cancelled/canceled, completed, in_progress,
// draft, archived, expired — is excluded regardless of spelling.
const MATCH_OPEN_STATUSES = ["upcoming", "open"];
const isOpenStatus = (match: OpenMatch): boolean => {
  const status = String(match.status ?? "upcoming").trim().toLowerCase();
  return MATCH_OPEN_STATUSES.includes(status);
};

// Timezone-safe start instant for soonest-first ordering. Uses the same
// start-field precedence as getMatchStartDate (TennisMatchApp) and strict
// moment.utc parsing; missing/unparseable dates sort to the end.
const matchStartMs = (match: OpenMatch): number => {
  const value = match.dateTime ?? match.start_date_time ?? match.startDateTime ?? match.startsAt;
  if (value == null || value === "") {
    return Number.POSITIVE_INFINITY;
  }
  const parsed = moment.utc(String(value), moment.ISO_8601, true);
  return parsed.isValid() ? parsed.valueOf() : Number.POSITIVE_INFINITY;
};

// AuthContext doesn't rehydrate `user` from storage on mount, so on a cold load
// (refresh / shared link) `user` is null. Fall back to the persisted login
// response (services/auth.js → "authLoginResponse") for the id, like CoachProfilePage.
const readStoredUserId = (): string | number | null => {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.localStorage.getItem("authLoginResponse");
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const profile = parsed.profile as Record<string, unknown> | undefined;
    const user = parsed.user as Record<string, unknown> | undefined;
    const id = parsed.user_id ?? parsed.userId ?? profile?.user_id ?? profile?.userId ?? user?.user_id ?? user?.userId;
    return typeof id === "string" || typeof id === "number" ? id : null;
  } catch {
    return null;
  }
};

const normalizeStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter((item): item is string => item.length > 0);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? [trimmed] : [];
  }
  return [];
};

const getInitials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "P";

const PlayerProfilePage = () => {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth() as { user?: Record<string, unknown> | undefined };
  const currentUserId = useMemo<string | number | null>(() => {
    const session = user?.session as Record<string, unknown> | undefined;
    const fromUser = user?.id ?? user?.user_id ?? user?.userId ?? session?.user_id;
    if (typeof fromUser === "string" || typeof fromUser === "number") {
      return fromUser;
    }
    return readStoredUserId();
  }, [user]);
  // The current user's PLAYER id (the /players/... id space). Prefers user_id —
  // user.id is an internal account id (e.g. 1) that has no played-with history,
  // whereas user_id (e.g. 6) is the player id used across the players system.
  const myPlayerId = useMemo<string | number | null>(() => {
    const session = user?.session as Record<string, unknown> | undefined;
    const fromUser = user?.user_id ?? user?.userId ?? session?.user_id ?? user?.id;
    if (typeof fromUser === "string" || typeof fromUser === "number") {
      return fromUser;
    }
    return readStoredUserId();
  }, [user]);
  const locationState = location.state as { player?: DirectoryPlayer } | undefined;

  // The router-state player (set when navigating in-app) is only a fast-path so
  // we can render instantly. We always fetch by id below so cold/shared links
  // — which carry no router state — still resolve.
  const fastPathPlayer = useMemo(() => {
    const candidate = locationState?.player;
    if (!candidate) {
      return undefined;
    }
    if (!id || candidate.id === id) {
      return candidate;
    }
    return undefined;
  }, [id, locationState?.player]);

  const [player, setPlayer] = useState<DirectoryPlayer | undefined>(fastPathPlayer);
  const [loading, setLoading] = useState(!fastPathPlayer);
  const [loadError, setLoadError] = useState(false);
  const [verifyingLevel, setVerifyingLevel] = useState(false);
  const [levelConfirmed, setLevelConfirmed] = useState(false);
  const [verificationCountDelta, setVerificationCountDelta] = useState(0);
  const [connectModalOpen, setConnectModalOpen] = useState(false);
  const [authDrawerOpen, setAuthDrawerOpen] = useState(false);
  const [matchProfile] = useState(() => getStoredMatchProfile());
  const [openMatches, setOpenMatches] = useState<OpenMatch[]>([]);
  const [matchesLoading, setMatchesLoading] = useState(true);
  const [matchesError, setMatchesError] = useState(false);
  const [playedWith, setPlayedWith] = useState<PlayedWithPlayer[]>([]);
  const [playedWithTotal, setPlayedWithTotal] = useState(0);
  const [playedWithLoading, setPlayedWithLoading] = useState(true);
  const [playedWithError, setPlayedWithError] = useState(false);
  // The viewer's OWN played-with list, used to surface the mutual (shared) subset.
  const [myPlayedWith, setMyPlayedWith] = useState<PlayedWithPlayer[]>([]);
  const [myPlayedWithLoading, setMyPlayedWithLoading] = useState(false);
  const [networkFilter, setNetworkFilter] = useState<"all" | "mutual">("mutual");
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const authToken = useMemo(
    () => getStoredAuthToken({ defaultScheme: "token", preferScheme: "token" }),
    [user],
  );
  const isSignedIn = Boolean(authToken);
  // Open the in-page auth drawer instead of navigating to /login — the user
  // stays on the profile and, on success, AuthContext updates `user` so this
  // page re-renders authenticated (revealing the Mutuals view, etc.).
  const promptSignIn = useCallback(() => {
    setAuthDrawerOpen(true);
  }, []);

  // `silent` refetches (e.g. after a join) leave the section's loading/error
  // chrome untouched so the list updates in place without flashing a spinner.
  const loadOpenMatches = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      if (!id) {
        setMatchesLoading(false);
        return;
      }
      if (!authToken) {
        setMatchesLoading(false);
        return;
      }
      if (!silent) {
        setMatchesLoading(true);
        setMatchesError(false);
      }
      try {
        const location = getStoredLocation() ?? DEFAULT_COORDINATES;
        const result = await (listMatches as Function)(undefined, {
          created_by: id,
          when: "upcoming",
          includeHidden: true,
          latitude: location.latitude,
          longitude: location.longitude,
          distance: 5,
          ignoreLocation: true,
        });
        setOpenMatches(Array.isArray(result?.matches) ? result.matches : []);
      } catch {
        if (!silent) {
          setMatchesError(true);
        }
      } finally {
        if (!silent) {
          setMatchesLoading(false);
        }
      }
    },
    [authToken, id],
  );

  useEffect(() => {
    loadOpenMatches();
  }, [loadOpenMatches]);

  useEffect(() => {
    if (!id) {
      setPlayedWith([]);
      setPlayedWithLoading(false);
      return;
    }

    const controller = new AbortController();
    setPlayedWithLoading(true);
    setPlayedWithError(false);
    setNetworkFilter("mutual"); // reset to the default (Mutuals) on a new profile

    getPlayedWith(id, { signal: controller.signal })
      .then((response) => {
        setPlayedWith(response.playedWith);
        setPlayedWithTotal(response.total || response.playedWith.length);
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        console.error("Failed to load played-with network", error);
        setPlayedWith([]);
        setPlayedWithError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setPlayedWithLoading(false);
        }
      });

    return () => controller.abort();
  }, [id]);

  // Fetch the viewer's OWN played-with network so we can surface the mutual
  // (shared) subset. Only when signed in and viewing someone else's profile.
  useEffect(() => {
    if (!myPlayerId || !id || String(myPlayerId) === String(id)) {
      setMyPlayedWith([]);
      setMyPlayedWithLoading(false);
      return;
    }
    const controller = new AbortController();
    setMyPlayedWithLoading(true);
    getPlayedWith(myPlayerId, { signal: controller.signal, token: authToken })
      .then((response) => {
        if (!controller.signal.aborted) setMyPlayedWith(response.playedWith);
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        console.error("Failed to load your played-with network", error);
        setMyPlayedWith([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) setMyPlayedWithLoading(false);
      });
    return () => controller.abort();
  }, [myPlayerId, id, authToken]);

  const myPlayedWithIds = useMemo(
    () => new Set(myPlayedWith.map((entry) => entry.userId)),
    [myPlayedWith],
  );
  // Players the viewed player has played who the viewer has ALSO played.
  const mutualPlayedWith = useMemo(
    () => playedWith.filter((entry) => myPlayedWithIds.has(entry.userId)),
    [playedWith, myPlayedWithIds],
  );
  // The mutual filter only makes sense when signed in and viewing someone else.
  const canShowMutual = isSignedIn && myPlayerId != null && String(myPlayerId) !== String(id);
  const visiblePlayedWith =
    canShowMutual && networkFilter === "mutual" ? mutualPlayedWith : playedWith;

  // Guest summary — proof without exposing individual identities.
  const networkCount = playedWithTotal || playedWith.length;
  const networkAvgNtrp = useMemo(() => {
    const values = playedWith
      .map((entry) => entry.ntrp)
      .filter((n): n is number => typeof n === "number" && Number.isFinite(n));
    if (!values.length) return null;
    return (values.reduce((sum, n) => sum + n, 0) / values.length).toFixed(1);
  }, [playedWith]);

  const handleJoinMatch = useCallback(
    async (matchId: string) => {
      if (!matchId || joiningId) {
        return;
      }
      if (!isSignedIn) {
        promptSignIn();
        return;
      }
      try {
        setJoiningId(matchId);
        await joinMatch(matchId);
        await loadOpenMatches({ silent: true });
      } catch (error) {
        window.alert(
          error instanceof Error ? error.message : "We couldn't join this match right now.",
        );
      } finally {
        setJoiningId(null);
      }
    },
    [isSignedIn, joiningId, loadOpenMatches, promptSignIn],
  );

  useEffect(() => {
    if (!id) {
      setLoading(false);
      setLoadError(true);
      return;
    }

    let cancelled = false;
    if (!fastPathPlayer) {
      setLoading(true);
    }
    setLoadError(false);

    // The authed details endpoint (`/player/.../specific_user`) only resolves
    // players within the viewer's discovery scope, so it 404s for arbitrary
    // profiles opened via shared/public links. Fall back to the public profile
    // endpoint so signed-in users can view any player too.
    const loadProfile: Promise<{ payload: Record<string, unknown>; source: "authed" | "public" }> =
      authToken
        ? fetchPlayerDetails({ token: authToken, userId: id })
            .then((payload) => ({ payload, source: "authed" as const }))
            .catch(() =>
              fetchPublicPlayerProfile({ userId: id }).then((payload) => ({
                payload,
                source: "public" as const,
              })),
            )
        : fetchPublicPlayerProfile({ userId: id }).then((payload) => ({
            payload,
            source: "public" as const,
          }));

    loadProfile
      .then(({ payload, source }) => {
        if (cancelled) {
          return;
        }
        const record =
          source === "authed"
            ? extractSuggestedPlayer(payload)
            : mapPublicPlayerProfileRecord(payload);
        if (record) {
          setPlayer(mapSuggestedPlayer(record));
          if (source === "public" && payload && typeof payload === "object") {
            const publicMatches = (payload as { matches?: unknown }).matches;
            setOpenMatches(Array.isArray(publicMatches) ? (publicMatches as OpenMatch[]) : []);
            setMatchesLoading(false);
            setMatchesError(false);
          }
        } else if (!fastPathPlayer) {
          setLoadError(true);
        }
      })
      .catch(() => {
        if (!cancelled && !fastPathPlayer) {
          setLoadError(true);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [authToken, id, fastPathPlayer]);

  // Single source for the section: open/upcoming only (Change 2), hosted by THIS
  // profile owner (the feed guard — the backend currently ignores created_by, so
  // we scope client-side and drop anything we can't attribute to the owner),
  // soonest-first (Change 4). Count, empty-state, and list all read this.
  const visibleMatches = useMemo(
    () =>
      openMatches
        .filter((match) => isOpenStatus(match) && (!isSignedIn || idsMatch(getMatchHostId(match), id)))
        .sort((a, b) => matchStartMs(a) - matchStartMs(b)),
    [openMatches, id, isSignedIn],
  );

  const goBackToResults = () => {
    if (typeof window !== "undefined" && window.history.length <= 2) {
      navigate("/find-players");
      return;
    }
    navigate(-1);
  };

  const goToPlayers = () => {
    navigate("/find-players");
  };

  if (loading) {
    return (
      <MainLayout mobileChrome="home">
        <div className="ppv ppv--state" role="status" aria-live="polite">
          <div className="ppv-state-card">
            <p>Loading player profile…</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (!player || loadError) {
    return (
      <MainLayout mobileChrome="home">
        <div className="ppv ppv--state" role="alert">
          <div className="ppv-state-card">
            <h1>Player profile not found</h1>
            <p>
              We couldn&apos;t find the player you were looking for. Try heading back to the player directory to explore other
              match partners.
            </p>
            <button type="button" className="ppv-state-btn" onClick={goToPlayers}>
              Back to players
            </button>
          </div>
        </div>
      </MainLayout>
    );
  }

  const firstName = player.name.split(" ")[0];
  const primaryLocation = player.location || normalizeStringArray(player.raw?.playerLocations)[0] || "Location unavailable";
  const playerLevel = player.level || (typeof player.raw?.skillLevel === "string" ? player.raw.skillLevel : undefined);
  const isLevelConfirmed = player.verified || Boolean(player.raw?.isLevelConfirmed);
  const verificationCountRaw = player.verificationCount ?? player.raw?.verifiedLevelCount;
  const verificationCount =
    typeof verificationCountRaw === "number"
      ? verificationCountRaw
      : typeof verificationCountRaw === "string"
        ? Number.parseInt(verificationCountRaw, 10)
        : undefined;
  const resolvedVerificationCount = Math.max(0, (verificationCount ?? 0) + verificationCountDelta);
  const resolvedLevelConfirmed = isLevelConfirmed || levelConfirmed;
  const matchPreferences =
    (Array.isArray(player.matchPreferences) && player.matchPreferences.length > 0
      ? player.matchPreferences
      : normalizeStringArray(player.raw?.lookingFor)) || [];
  const availabilityOptions =
    (Array.isArray(player.availability) && player.availability.length > 0
      ? player.availability
      : normalizeStringArray(player.raw?.availability)) || [];
  const preferredCourts =
    (Array.isArray(player.localCourts) && player.localCourts.length > 0
      ? player.localCourts
      : normalizeStringArray(player.raw?.playerCourtLocations)) || [];
  const favoriteCourt = typeof player.favoriteCourt === "string" ? player.favoriteCourt : undefined;

  const openConnectModal = () => {
    if (!isSignedIn) {
      promptSignIn();
      return;
    }
    if (!matchProfile) {
      navigate("/find-players");
      return;
    }
    setConnectModalOpen(true);
  };

  const closeConnectModal = () => setConnectModalOpen(false);

  const shareIntro = () => {
    if (!isSignedIn) {
      promptSignIn();
      return;
    }
    if (!matchProfile) {
      navigate("/find-players");
      return;
    }

    const recipientPhone = getSmsRecipient(player.raw?.phone);
    if (!recipientPhone) {
      window.alert("This player doesn't have a valid mobile number available for SMS yet.");
      return;
    }

    const senderLevel = matchProfile.level ?? "3.0";
    const preferredTimes = matchProfile.availability?.length ? matchProfile.availability.join(", ") : "soon";
    const message = `Hi ${player.name}, I found you on The Tennis Plan. I'm a ${senderLevel} player looking to hit ${preferredTimes}. Let me know if you'd like to connect.`;

    closeConnectModal();
    window.location.assign(buildSmsUrl(recipientPhone, message));
  };

  const createMatchInvite = () => {
    if (!isSignedIn) {
      promptSignIn();
      return;
    }
    if (!matchProfile) {
      navigate("/find-players");
      return;
    }

    const connectIntent: ConnectIntent = {
      invitee: {
        id: player.id,
        name: player.name,
        avatarUrl: player.profileImageUrl,
        level: player.level,
      },
      senderName: "You",
      senderLevel: matchProfile.level,
      suggestedAvailability: [...(matchProfile.availability ?? [])],
      preferredCourt: matchProfile.localCourts?.trim() ? matchProfile.localCourts.trim() : null,
      source: "find-players",
    };

    closeConnectModal();
    navigate("/matches/create", { state: { connectIntent } });
  };

  const blockPlayer = () => {
    if (!isSignedIn) {
      promptSignIn();
      return;
    }
    window.alert(`You blocked ${player.name}.`);
  };

  const handleVerifyLevel = async () => {
    const token = authToken;
    const userId = player.raw?.userId;
    const level = typeof playerLevel === "string" ? playerLevel.trim() : "";

    if (!token) {
      window.alert("Please sign in again to verify a player's level.");
      return;
    }

    if (!userId || !level) {
      window.alert("We couldn't verify this player's level because their profile data is incomplete.");
      return;
    }

    const confirmed = window.confirm(`Do you confirm ${player.name}'s tennis level as "${level}"?`);
    if (!confirmed) {
      return;
    }

    try {
      setVerifyingLevel(true);
      await verifyUserLevel({ token, userId, level });
      setLevelConfirmed(true);
      setVerificationCountDelta((current) => current + 1);
      window.alert("Thanks. Your level verification has been recorded.");
    } catch (requestError) {
      window.alert(
        requestError instanceof Error
          ? requestError.message
          : "We couldn't verify this player's level right now.",
      );
    } finally {
      setVerifyingLevel(false);
    }
  };

  const courtList = Array.from(
    new Set([favoriteCourt, ...preferredCourts].filter((court): court is string => Boolean(court))),
  );
  const showBackButton =
    Boolean(locationState?.player) ||
    (typeof window !== "undefined" && window.history.length > 2);

  return (
    <MainLayout mobileChrome="home">
      <div className="ppv">
        {showBackButton ? (
          <button type="button" className="ppv-back" onClick={goBackToResults}>
            <ArrowLeft size={18} strokeWidth={2} aria-hidden="true" />
            Back
          </button>
        ) : null}

        <aside className="ppv-identity">
          <div className="ppv-id-top">
            <div className="ppv-photo">
              {player.profileImageUrl ? (
                <img src={player.profileImageUrl} alt={`${player.name} profile portrait`} />
              ) : (
                <span aria-hidden="true">{player.initials}</span>
              )}
            </div>
            <div className="ppv-id-head">
              <h1 className="ppv-name">{player.name}</h1>
              <div className="ppv-creds">
                {resolvedLevelConfirmed ? (
                  <span className="ppv-cred ppv-cred--verified">
                    <BadgeCheck size={13} strokeWidth={2.2} aria-hidden="true" />
                    Verified
                  </span>
                ) : null}
                {playerLevel ? <span className="ppv-cred ppv-cred--level">{playerLevel} NTRP</span> : null}
              </div>
            </div>
          </div>

          <p className="ppv-loc">
            <MapPin size={14} strokeWidth={2} aria-hidden="true" />
            {primaryLocation}
          </p>

          {player.bio ? <p className="ppv-bio">{player.bio}</p> : null}

          <button type="button" className="ppv-connect" onClick={openConnectModal}>
            <MessageCircle size={18} strokeWidth={2.2} aria-hidden="true" />
            Connect with {firstName}
          </button>

          <button type="button" className="ppv-block-link" onClick={blockPlayer}>
            Report or block this player
          </button>
        </aside>

        <main className="ppv-main">
          <section className="ppv-section" aria-labelledby="open-match-play-heading">
            <div className="ppv-sec-head">
              <h2 id="open-match-play-heading" className="ppv-sec-title">
                Open match play
              </h2>
              {!matchesLoading && !matchesError && visibleMatches.length > 0 ? (
                <span className="ppv-sec-count">{visibleMatches.length} open</span>
              ) : null}
            </div>
            {matchesLoading ? (
              <p className="ppv-state-text">Loading open matches…</p>
            ) : matchesError ? (
              <p className="ppv-state-text">We couldn&apos;t load open matches right now.</p>
            ) : visibleMatches.length === 0 ? (
              <p className="ppv-state-text">No open matches right now.</p>
            ) : (
              <div className="ppv-matches-list">
                {visibleMatches.map((openMatch, index) => {
                  const cardId = String(openMatch.match_id ?? openMatch.id ?? index);
                  return (
                    <OpenMatchPlayCard
                      key={cardId}
                      match={openMatch}
                      onJoin={handleJoinMatch}
                      joining={joiningId === cardId}
                      currentUserId={currentUserId}
                      hostId={id ?? null}
                      onViewDetails={isSignedIn ? undefined : promptSignIn}
                    />
                  );
                })}
              </div>
            )}
          </section>

          <section className="ppv-section" aria-labelledby="played-with-heading">
            <div className="ppv-sec-head">
              <h2 id="played-with-heading" className="ppv-sec-title">
                Played with
              </h2>
              {isSignedIn && !playedWithLoading && !playedWithError && playedWith.length > 0 ? (
                <span className="ppv-sec-count">{visiblePlayedWith.length} players</span>
              ) : null}
            </div>
            {canShowMutual && !playedWithLoading && !playedWithError && playedWith.length > 0 ? (
              <div className="ppv-network-filter" role="tablist" aria-label="Filter network">
                <button
                  type="button"
                  role="tab"
                  aria-selected={networkFilter === "mutual"}
                  className={`ppv-network-filter__btn${networkFilter === "mutual" ? " ppv-network-filter__btn--active" : ""}`}
                  onClick={() => setNetworkFilter("mutual")}
                >
                  Mutuals ({mutualPlayedWith.length})
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={networkFilter === "all"}
                  className={`ppv-network-filter__btn${networkFilter === "all" ? " ppv-network-filter__btn--active" : ""}`}
                  onClick={() => setNetworkFilter("all")}
                >
                  Everyone ({playedWith.length})
                </button>
              </div>
            ) : null}
            {playedWithLoading ? (
              <p className="ppv-state-text">Loading tennis network…</p>
            ) : playedWithError ? (
              <p className="ppv-state-text">We couldn&apos;t load this network right now.</p>
            ) : playedWith.length === 0 ? (
              <p className="ppv-state-text">No shared match history yet.</p>
            ) : !isSignedIn ? (
              <>
                <div className="ppv-network-summary">
                  Played with <strong>{networkCount}</strong> Tennis Plan{" "}
                  {networkCount === 1 ? "player" : "players"}
                  {networkAvgNtrp ? (
                    <>
                      {" · "}avg <strong>{networkAvgNtrp}</strong> NTRP
                    </>
                  ) : null}
                </div>
                <button type="button" className="ppv-network-teaser" onClick={promptSignIn}>
                  <span className="ppv-network-teaser__copy">
                    <strong>See who you both know</strong>
                    <span>Sign in to reveal your mutual connections with {firstName}.</span>
                  </span>
                  <span className="ppv-network-teaser__btn">Sign in</span>
                </button>
              </>
            ) : canShowMutual && networkFilter === "mutual" && myPlayedWithLoading ? (
              <p className="ppv-state-text">Finding players you&apos;ve both played…</p>
            ) : visiblePlayedWith.length === 0 ? (
              <p className="ppv-state-text">No players you&apos;ve both played yet.</p>
            ) : (
              <div className="ppv-network-grid">
                {visiblePlayedWith.map((networkPlayer) => (
                  <article key={networkPlayer.userId} className="ppv-network-card">
                    <div className="ppv-network-avatar">
                      {networkPlayer.avatarUrl ? (
                        <img src={networkPlayer.avatarUrl} alt={`${networkPlayer.name} profile portrait`} />
                      ) : (
                        <span aria-hidden="true">{getInitials(networkPlayer.name)}</span>
                      )}
                    </div>
                    <div className="ppv-network-copy">
                      <h3>{networkPlayer.name}</h3>
                      <p>
                        {formatPlayedWithCount(networkPlayer.matchCount)}
                        {networkPlayer.ntrp !== null ? ` · ${networkPlayer.ntrp} NTRP` : ""}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="ppv-network-action"
                      onClick={() => navigate(`/players/${networkPlayer.userId}`)}
                      aria-label={`View ${networkPlayer.name}'s profile`}
                    >
                      <Users size={16} strokeWidth={2} aria-hidden="true" />
                    </button>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="ppv-about" aria-label={`About ${firstName}`}>
            <div className="ppv-card">
              <div className="ppv-card-head">
                <h3 className="ppv-card-title">Player level</h3>
                {resolvedLevelConfirmed ? (
                  <span className="ppv-cred ppv-cred--verified">
                    <BadgeCheck size={13} strokeWidth={2.2} aria-hidden="true" />
                    Verified
                  </span>
                ) : null}
              </div>
              <div className="ppv-level-detail">
                <div className="ppv-level-big">
                  <span className="ppv-level-n">{playerLevel ?? "—"}</span>
                  <span className="ppv-level-l">NTRP</span>
                </div>
                <p className="ppv-level-txt">
                  {resolvedVerificationCount > 0 ? (
                    <>
                      Community-verified.{" "}
                      <b>
                        {resolvedVerificationCount} {resolvedVerificationCount === 1 ? "player" : "players"}
                      </b>{" "}
                      {resolvedVerificationCount === 1 ? "has" : "have"} confirmed {firstName} plays at this level.
                    </>
                  ) : (
                    `Be the first to confirm ${firstName}'s level.`
                  )}
                </p>
              </div>
              <button
                type="button"
                className="ppv-verify"
                onClick={handleVerifyLevel}
                disabled={verifyingLevel}
              >
                {verifyingLevel ? "Verifying…" : "Verify level"}
              </button>
            </div>

            {availabilityOptions.length > 0 ? (
              <div className="ppv-card">
                <h3 className="ppv-card-title">Availability</h3>
                <div className="ppv-chips">
                  {availabilityOptions.map((slot) => (
                    <span key={slot} className="ppv-chip">
                      {slot}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            {courtList.length > 0 ? (
              <div className="ppv-card">
                <h3 className="ppv-card-title">Preferred courts</h3>
                <div className="ppv-courts">
                  {courtList.map((court) => (
                    <div key={court} className="ppv-court">
                      <MapPin size={16} strokeWidth={2} aria-hidden="true" />
                      {court}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {matchPreferences.length > 0 ? (
              <div className="ppv-card">
                <h3 className="ppv-card-title">Play style</h3>
                <div className="ppv-chips">
                  {matchPreferences.map((preference) => (
                    <span key={preference} className="ppv-chip">
                      {preference}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </section>

          <section className="ppv-danger">
            <h3 className="ppv-danger-title">Report or block this player</h3>
            <p className="ppv-danger-sub">
              Block this player if you no longer want to match or receive messages from them.
            </p>
            <button type="button" className="ppv-block-btn" onClick={blockPlayer}>
              Block player
            </button>
          </section>
        </main>
      </div>
      <ConnectPlayerModal
        isOpen={connectModalOpen}
        player={player}
        onClose={closeConnectModal}
        canShareIntro={Boolean(getSmsRecipient(player.raw?.phone))}
        shareIntroDescription={
          getSmsRecipient(player.raw?.phone)
            ? "Open a text message with this player's number and your profile details prefilled."
            : "This player doesn't have a valid mobile number available for SMS yet."
        }
        onShareIntro={shareIntro}
        onCreateMatch={createMatchInvite}
        senderAvailability={matchProfile?.availability ?? []}
        senderCourts={matchProfile?.localCourts ?? ""}
      />

      <AuthDrawer
        open={authDrawerOpen}
        onClose={() => setAuthDrawerOpen(false)}
        initialMode="signup"
        title={`See who you both know`}
        subtitle={`Sign up or sign in to reveal your mutual connections with ${firstName}.`}
      />
    </MainLayout>
  );
};

export default PlayerProfilePage;
