import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, BadgeCheck, MapPin, MessageCircle, Users } from "lucide-react";
import moment from "moment";

import MainLayout from "../components/MainLayout";
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
    const id = parsed.user_id ?? parsed.id;
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
  const [matchProfile] = useState(() => getStoredMatchProfile());
  const [openMatches, setOpenMatches] = useState<OpenMatch[]>([]);
  const [matchesLoading, setMatchesLoading] = useState(true);
  const [matchesError, setMatchesError] = useState(false);
  const [playedWith, setPlayedWith] = useState<PlayedWithPlayer[]>([]);
  const [playedWithLoading, setPlayedWithLoading] = useState(true);
  const [playedWithError, setPlayedWithError] = useState(false);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const authToken = useMemo(
    () => getStoredAuthToken({ defaultScheme: "token", preferScheme: "token" }),
    [user],
  );
  const isSignedIn = Boolean(authToken);
  const promptSignIn = useCallback(() => {
    navigate("/login", { state: { from: `${location.pathname}${location.search}` } });
  }, [location.pathname, location.search, navigate]);

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

    getPlayedWith(id, { signal: controller.signal })
      .then((response) => {
        setPlayedWith(response.playedWith);
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

    const loadProfile = authToken
      ? fetchPlayerDetails({ token: authToken, userId: id })
      : fetchPublicPlayerProfile({ userId: id });

    loadProfile
      .then((payload) => {
        if (cancelled) {
          return;
        }
        const record = authToken
          ? extractSuggestedPlayer(payload)
          : mapPublicPlayerProfileRecord(payload);
        if (record) {
          setPlayer(mapSuggestedPlayer(record));
          if (!authToken && payload && typeof payload === "object") {
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

    const senderLevel = matchProfile.level ?? "3.0";
    const preferredTimes = matchProfile.availability?.length ? matchProfile.availability.join(", ") : "soon";
    const message = `Hi ${player.name}, I found you on The Tennis Plan. I'm a ${senderLevel} player looking to hit ${preferredTimes}. Let me know if you'd like to connect.`;
    const encodedMessage = encodeURIComponent(message);
    const isIos = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
    const smsUrl = isIos ? `sms:&body=${encodedMessage}` : `sms:?body=${encodedMessage}`;

    closeConnectModal();
    if (typeof window.navigator.share === "function") {
      window.navigator.share({ text: message }).catch(() => {
        window.location.href = smsUrl;
      });
      return;
    }
    window.location.href = smsUrl;
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
              {!playedWithLoading && !playedWithError && playedWith.length > 0 ? (
                <span className="ppv-sec-count">{playedWith.length} players</span>
              ) : null}
            </div>
            {playedWithLoading ? (
              <p className="ppv-state-text">Loading tennis network…</p>
            ) : playedWithError ? (
              <p className="ppv-state-text">We couldn&apos;t load this network right now.</p>
            ) : playedWith.length === 0 ? (
              <p className="ppv-state-text">No shared match history yet.</p>
            ) : (
              <div className="ppv-network-grid">
                {playedWith.map((networkPlayer) => (
                  <article key={networkPlayer.playerId} className="ppv-network-card">
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
                      onClick={() => navigate(`/players/${networkPlayer.playerId}`)}
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
        onShareIntro={shareIntro}
        onCreateMatch={createMatchInvite}
        senderAvailability={matchProfile?.availability ?? []}
        senderCourts={matchProfile?.localCourts ?? ""}
      />
    </MainLayout>
  );
};

export default PlayerProfilePage;
