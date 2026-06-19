import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, BadgeCheck, MapPin, MessageCircle } from "lucide-react";

import MainLayout from "../components/MainLayout";
import ConnectPlayerModal from "../components/players/ConnectPlayerModal";
import OpenMatchPlayCard from "../components/players/OpenMatchPlayCard";
import LockedMatchCard from "../components/players/LockedMatchCard";
import SignInSheet from "../components/players/SignInSheet";
import { fetchPlayerDetails, verifyUserLevel } from "../api/playerHome";
import {
  fetchPublicPlayerProfile,
  type PublicPlayerProfile,
} from "../api/publicPlayerProfile";
import { joinMatch, listMatches } from "../play-dates/services/matches";
import { getStoredAuthToken } from "../services/authToken";
import { useAuth } from "../context/AuthContext";
import type { ConnectIntent } from "../types/matchPlay";
import { getStoredMatchProfile } from "../utils/matchProfile";
import { getStoredLocation, DEFAULT_COORDINATES } from "../utils/userLocation";
import {
  extractSuggestedPlayer,
  mapSuggestedPlayer,
  type DirectoryPlayer,
} from "../utils/suggestedPlayer";

type OpenMatch = Record<string, unknown>;

import "./PlayerProfilePage.css";

// Unified display model for the identity + about blocks, so the same markup
// renders from either the authenticated DirectoryPlayer or the bounded
// PublicPlayerProfile (logged-out mode).
type ProfileView = {
  name: string;
  firstName: string;
  initials: string;
  profileImageUrl?: string;
  level?: string;
  levelVerified: boolean;
  verificationCount: number;
  location: string;
  bio?: string;
  availability: string[];
  courts: string[];
  playStyle: string[];
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

const VerifiedBadge = () => (
  <span className="ppv-cred ppv-cred--verified">
    <BadgeCheck size={13} strokeWidth={2.2} aria-hidden="true" />
    Verified
  </span>
);

// Shared identity block (left column). Actions are injected so the auth path
// opens the connect modal while the logged-out path opens the sign-in sheet.
const IdentityCard = ({
  view,
  onConnect,
  onReport,
}: {
  view: ProfileView;
  onConnect: () => void;
  onReport: () => void;
}) => (
  <aside className="ppv-identity">
    <div className="ppv-id-top">
      <div className="ppv-photo">
        {view.profileImageUrl ? (
          <img src={view.profileImageUrl} alt={`${view.name} profile portrait`} />
        ) : (
          <span aria-hidden="true">{view.initials}</span>
        )}
      </div>
      <div className="ppv-id-head">
        <h1 className="ppv-name">{view.name}</h1>
        <div className="ppv-creds">
          {view.levelVerified ? <VerifiedBadge /> : null}
          {view.level ? <span className="ppv-cred ppv-cred--level">{view.level} NTRP</span> : null}
        </div>
      </div>
    </div>

    <p className="ppv-loc">
      <MapPin size={14} strokeWidth={2} aria-hidden="true" />
      {view.location}
    </p>

    {view.bio ? <p className="ppv-bio">{view.bio}</p> : null}

    <button type="button" className="ppv-connect" onClick={onConnect}>
      <MessageCircle size={18} strokeWidth={2.2} aria-hidden="true" />
      Connect with {view.firstName}
    </button>

    <button type="button" className="ppv-block-link" onClick={onReport}>
      Report or block this player
    </button>
  </aside>
);

// Shared about section. `verify` is supplied only in the authenticated path;
// when omitted (logged-out) the verify button is not rendered.
const AboutSection = ({
  view,
  verify,
}: {
  view: ProfileView;
  verify?: { onVerify: () => void; verifying: boolean };
}) => (
  <section className="ppv-about" aria-label={`About ${view.firstName}`}>
    <div className="ppv-card">
      <div className="ppv-card-head">
        <h3 className="ppv-card-title">Player level</h3>
        {view.levelVerified ? <VerifiedBadge /> : null}
      </div>
      <div className="ppv-level-detail">
        <div className="ppv-level-big">
          <span className="ppv-level-n">{view.level ?? "—"}</span>
          <span className="ppv-level-l">NTRP</span>
        </div>
        <p className="ppv-level-txt">
          {view.verificationCount > 0 ? (
            <>
              Community-verified.{" "}
              <b>
                {view.verificationCount} {view.verificationCount === 1 ? "player" : "players"}
              </b>{" "}
              {view.verificationCount === 1 ? "has" : "have"} confirmed {view.firstName} plays at this level.
            </>
          ) : (
            `Be the first to confirm ${view.firstName}'s level.`
          )}
        </p>
      </div>
      {verify ? (
        <button
          type="button"
          className="ppv-verify"
          onClick={verify.onVerify}
          disabled={verify.verifying}
        >
          {verify.verifying ? "Verifying…" : "Verify level"}
        </button>
      ) : null}
    </div>

    {view.availability.length > 0 ? (
      <div className="ppv-card">
        <h3 className="ppv-card-title">Availability</h3>
        <div className="ppv-chips">
          {view.availability.map((slot) => (
            <span key={slot} className="ppv-chip">
              {slot}
            </span>
          ))}
        </div>
      </div>
    ) : null}

    {view.courts.length > 0 ? (
      <div className="ppv-card">
        <h3 className="ppv-card-title">Preferred courts</h3>
        <div className="ppv-courts">
          {view.courts.map((court) => (
            <div key={court} className="ppv-court">
              <MapPin size={16} strokeWidth={2} aria-hidden="true" />
              {court}
            </div>
          ))}
        </div>
      </div>
    ) : null}

    {view.playStyle.length > 0 ? (
      <div className="ppv-card">
        <h3 className="ppv-card-title">Play style</h3>
        <div className="ppv-chips">
          {view.playStyle.map((preference) => (
            <span key={preference} className="ppv-chip">
              {preference}
            </span>
          ))}
        </div>
      </div>
    ) : null}
  </section>
);

const PlayerProfilePage = ({ loggedOut = false }: { loggedOut?: boolean }) => {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth() as { user?: Record<string, unknown> | undefined };
  const currentUserId = (user?.id ?? user?.user_id ?? user?.userId ?? null) as string | number | null;
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
  const [joiningId, setJoiningId] = useState<string | null>(null);
  // Logged-out (build-ahead) state: bounded public profile + the sign-in sheet
  // that every gated action opens.
  const [publicProfile, setPublicProfile] = useState<PublicPlayerProfile | undefined>(undefined);
  const [signInSheet, setSignInSheet] = useState<{ open: boolean; action: string }>({
    open: false,
    action: "",
  });

  const openSignInSheet = (action: string) => setSignInSheet({ open: true, action });
  const closeSignInSheet = () => setSignInSheet((current) => ({ ...current, open: false }));

  // `silent` refetches (e.g. after a join) leave the section's loading/error
  // chrome untouched so the list updates in place without flashing a spinner.
  const loadOpenMatches = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      if (loggedOut || !id) {
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
    [id, loggedOut],
  );

  useEffect(() => {
    loadOpenMatches();
  }, [loadOpenMatches]);

  const handleJoinMatch = useCallback(
    async (matchId: string) => {
      if (!matchId || joiningId) {
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
    [joiningId, loadOpenMatches],
  );

  // Authenticated fetch-by-id (cold/shared links). Skipped entirely in
  // logged-out mode, which has no token and uses the public endpoint below.
  useEffect(() => {
    if (loggedOut) {
      return;
    }
    if (!id) {
      setLoading(false);
      setLoadError(true);
      return;
    }

    const token = getStoredAuthToken({ defaultScheme: "token", preferScheme: "token" });
    if (!token) {
      setLoading(false);
      setLoadError(true);
      return;
    }

    let cancelled = false;
    if (!fastPathPlayer) {
      setLoading(true);
    }
    setLoadError(false);

    fetchPlayerDetails({ token, userId: id })
      .then((payload) => {
        if (cancelled) {
          return;
        }
        const record = extractSuggestedPlayer(payload);
        if (record) {
          setPlayer(mapSuggestedPlayer(record));
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
  }, [id, fastPathPlayer, loggedOut]);

  // Logged-out (build-ahead): bounded public profile. Single seam —
  // fetchPublicPlayerProfile currently returns a typed stub.
  useEffect(() => {
    if (!loggedOut) {
      return;
    }
    if (!id) {
      setLoading(false);
      setLoadError(true);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setLoadError(false);

    fetchPublicPlayerProfile(id)
      .then((data) => {
        if (!cancelled) {
          setPublicProfile(data);
        }
      })
      .catch(() => {
        if (!cancelled) {
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
  }, [id, loggedOut]);

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

  // ----- Logged-out (build-ahead) render path -----------------------------
  // Returns before any authenticated derivation runs, so the auth path below
  // is unchanged and `player` stays guaranteed-defined there.
  if (loggedOut) {
    if (loading) {
      return (
        <MainLayout showDesktopNav={false} mobileChrome="immersive">
          <div className="ppv ppv--state" role="status" aria-live="polite">
            <div className="ppv-state-card">
              <p>Loading player profile…</p>
            </div>
          </div>
        </MainLayout>
      );
    }

    if (!publicProfile || loadError) {
      return (
        <MainLayout showDesktopNav={false} mobileChrome="immersive">
          <div className="ppv ppv--state" role="alert">
            <div className="ppv-state-card">
              <h1>Player profile not found</h1>
              <p>We couldn&apos;t find the player you were looking for.</p>
              <button type="button" className="ppv-state-btn" onClick={() => navigate("/login")}>
                Sign in
              </button>
            </div>
          </div>
        </MainLayout>
      );
    }

    const view: ProfileView = {
      name: publicProfile.name,
      firstName: publicProfile.name.split(" ")[0] || publicProfile.name,
      initials: publicProfile.initials,
      profileImageUrl: publicProfile.profileImageUrl,
      level: publicProfile.level,
      levelVerified: publicProfile.levelVerified,
      verificationCount: publicProfile.verificationCount,
      location: publicProfile.generalLocation,
      bio: publicProfile.bio,
      availability: publicProfile.availability,
      courts: publicProfile.preferredCourts,
      playStyle: publicProfile.playStyle,
    };
    const matches = publicProfile.matches;

    return (
      <MainLayout showDesktopNav={false} mobileChrome="immersive">
        <header className="ppv-lo-header">
          <div className="ppv-lo-brand">
            <span className="ppv-lo-logo" aria-hidden="true">🎾</span>
            <span className="ppv-lo-brandname">The Tennis Plan</span>
          </div>
          <button
            type="button"
            className="ppv-lo-signin"
            onClick={() => openSignInSheet(`see ${view.firstName}'s matches`)}
          >
            Sign in
          </button>
        </header>

        {publicProfile.invitedYou ? (
          <div className="ppv-lo-ribbon">
            <MessageCircle size={15} strokeWidth={2.2} aria-hidden="true" />
            {view.firstName} invited you to play — take a look
          </div>
        ) : null}

        <div className="ppv">
          <IdentityCard
            view={view}
            onConnect={() => openSignInSheet(`connect with ${view.firstName}`)}
            onReport={() => openSignInSheet("report or block players")}
          />

          <main className="ppv-main">
            <section className="ppv-section" aria-labelledby="open-match-play-heading">
              <div className="ppv-sec-head">
                <h2 id="open-match-play-heading" className="ppv-sec-title">
                  Open match play
                </h2>
                {matches.length > 0 ? (
                  <span className="ppv-sec-count">{matches.length} open</span>
                ) : null}
              </div>
              {matches.length === 0 ? (
                <p className="ppv-state-text">No open matches right now.</p>
              ) : (
                <div className="ppv-matches-list">
                  {matches.map((match) => (
                    <LockedMatchCard
                      key={match.id}
                      match={match}
                      onSignIn={() => openSignInSheet("join this match")}
                    />
                  ))}
                </div>
              )}
            </section>

            <AboutSection view={view} />

            <section className="ppv-danger">
              <h3 className="ppv-danger-title">Report this player</h3>
              <p className="ppv-danger-sub">Sign in to report or block players.</p>
              <button
                type="button"
                className="ppv-block-btn"
                onClick={() => openSignInSheet("report or block players")}
              >
                Sign in
              </button>
            </section>
          </main>
        </div>

        <div className="ppv-lo-bar">
          <div className="ppv-lo-bar-text">
            <b>Want to join {view.firstName}&apos;s matches?</b>
            Sign in to see times &amp; play
          </div>
          <button
            type="button"
            className="ppv-lo-bar-btn"
            onClick={() => openSignInSheet(`join ${view.firstName}'s matches`)}
          >
            Sign in
          </button>
        </div>

        <SignInSheet
          open={signInSheet.open}
          actionLabel={signInSheet.action}
          playerName={view.firstName}
          onClose={closeSignInSheet}
        />
      </MainLayout>
    );
  }

  // ----- Authenticated render path (unchanged behavior) -------------------
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
    if (!matchProfile) {
      navigate("/find-players");
      return;
    }
    setConnectModalOpen(true);
  };

  const closeConnectModal = () => setConnectModalOpen(false);

  const shareIntro = () => {
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
    window.alert(`You blocked ${player.name}.`);
  };

  const handleVerifyLevel = async () => {
    const token = getStoredAuthToken({ defaultScheme: "token", preferScheme: "token" });
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

  const view: ProfileView = {
    name: player.name,
    firstName,
    initials: player.initials,
    profileImageUrl: player.profileImageUrl,
    level: playerLevel,
    levelVerified: resolvedLevelConfirmed,
    verificationCount: resolvedVerificationCount,
    location: primaryLocation,
    bio: player.bio,
    availability: availabilityOptions,
    courts: courtList,
    playStyle: matchPreferences,
  };

  return (
    <MainLayout mobileChrome="home">
      <div className="ppv">
        {showBackButton ? (
          <button type="button" className="ppv-back" onClick={goBackToResults}>
            <ArrowLeft size={18} strokeWidth={2} aria-hidden="true" />
            Back
          </button>
        ) : null}

        <IdentityCard view={view} onConnect={openConnectModal} onReport={blockPlayer} />

        <main className="ppv-main">
          <section className="ppv-section" aria-labelledby="open-match-play-heading">
            <div className="ppv-sec-head">
              <h2 id="open-match-play-heading" className="ppv-sec-title">
                Open match play
              </h2>
              {!matchesLoading && !matchesError && openMatches.length > 0 ? (
                <span className="ppv-sec-count">{openMatches.length} open</span>
              ) : null}
            </div>
            {matchesLoading ? (
              <p className="ppv-state-text">Loading open matches…</p>
            ) : matchesError ? (
              <p className="ppv-state-text">We couldn&apos;t load open matches right now.</p>
            ) : openMatches.length === 0 ? (
              <p className="ppv-state-text">No open matches right now.</p>
            ) : (
              <div className="ppv-matches-list">
                {openMatches.map((openMatch, index) => {
                  const cardId = String(openMatch.match_id ?? openMatch.id ?? index);
                  return (
                    <OpenMatchPlayCard
                      key={cardId}
                      match={openMatch}
                      onJoin={handleJoinMatch}
                      joining={joiningId === cardId}
                      currentUserId={currentUserId}
                      hostId={id ?? null}
                    />
                  );
                })}
              </div>
            )}
          </section>

          <AboutSection
            view={view}
            verify={{ onVerify: handleVerifyLevel, verifying: verifyingLevel }}
          />

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
