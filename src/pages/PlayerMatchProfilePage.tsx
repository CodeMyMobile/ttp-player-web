import { useEffect, useMemo, useState } from "react";
import { useLocation, useParams, useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  Ban,
  BadgeCheck,
  Heart,
  Loader2,
  MessageCircle,
  Phone,
  ShieldCheck,
  Star,
} from "lucide-react";
import MainLayout from "../components/MainLayout";
import { addFavorite, blockPlayer, fetchPlayerDetails, removeFavorite, unblockPlayer, verifyUserLevel } from "../api/playerHome";
import { getStoredAuthToken } from "../services/authToken";
import { formatPhoneDisplay, getPhoneDigits } from "../services/phone";
import usePlayerIdentity from "../hooks/usePlayerIdentity";
import { useAuth } from "../context/AuthContext";

import "./PlayerMatchProfilePage.css";

type RawPlayerRecord = {
  userId?: number | string;
  id?: number | string;
  full_name?: string;
  skillLevel?: string;
  phone?: string;
  profile_picture?: string;
  about_me?: string;
  availability?: unknown;
  playerCourtLocations?: unknown;
  lookingFor?: unknown;
  verifiedLevelCount?: number | string;
  is_favorite?: boolean;
  is_blocked?: boolean;
  [key: string]: unknown;
};

type PlayerProfile = {
  userId: number | string;
  fullName: string;
  skillLevel?: string;
  phone?: string;
  profilePicture?: string;
  about?: string;
  availability: string[];
  courts: string[];
  lookingFor: string[];
  verifiedLevelCount: number;
  isFavorite: boolean;
  isBlocked: boolean;
};

const knownLookingFor = ["Fun / social", "Casual hitting", "Friendly competition"] as const;

const toStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter((item): item is string => Boolean(item));
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? [trimmed] : [];
  }
  return [];
};

const normalizeProfile = (record: RawPlayerRecord | null | undefined): PlayerProfile | null => {
  if (!record) return null;
  const userId = record.userId ?? record.id;
  if (!userId) return null;

  const fullName = typeof record.full_name === "string" && record.full_name.trim() ? record.full_name.trim() : "TTP Player";

  const verifiedCountRaw = record.verifiedLevelCount;
  const verifiedLevelCount = typeof verifiedCountRaw === "number"
    ? verifiedCountRaw
    : typeof verifiedCountRaw === "string"
      ? Number.parseInt(verifiedCountRaw, 10) || 0
      : 0;

  const lookingFor = toStringArray(record.lookingFor).filter((item) => knownLookingFor.includes(item as (typeof knownLookingFor)[number]));

  return {
    userId,
    fullName,
    skillLevel: typeof record.skillLevel === "string" ? record.skillLevel : undefined,
    phone: typeof record.phone === "string" ? record.phone : undefined,
    profilePicture: typeof record.profile_picture === "string" ? record.profile_picture : undefined,
    about: typeof record.about_me === "string" ? record.about_me : undefined,
    availability: toStringArray(record.availability),
    courts: toStringArray(record.playerCourtLocations),
    lookingFor,
    verifiedLevelCount,
    isFavorite: Boolean(record.is_favorite),
    isBlocked: Boolean(record.is_blocked),
  };
};

const extractUserId = (user: unknown): number | string | undefined => {
  if (!user || typeof user !== "object") return undefined;
  const profile = user as Record<string, unknown>;
  const idFields = ["id", "userId", "user_id", "playerId"] as const;
  for (const field of idFields) {
    const value = profile[field];
    if (typeof value === "number" || typeof value === "string") {
      return value;
    }
  }
  return undefined;
};

const extractSurveyAnswers = (user: unknown): unknown[] => {
  if (!user || typeof user !== "object") return [];
  const profile = user as Record<string, unknown>;
  const answers = (profile.survey_answers ?? profile.surveyAnswers ?? profile.surveys) as unknown;
  return Array.isArray(answers) ? answers : [];
};

const deriveViewerLevel = (user: unknown): string | undefined => {
  const answers = extractSurveyAnswers(user);
  for (const answer of answers) {
    if (!answer || typeof answer !== "object") continue;
    const entry = answer as Record<string, unknown>;
    const questionId = entry.questionId ?? entry.question_id ?? entry.questionID;
    if (questionId && String(questionId) === "3") {
      const value = entry.answer ?? entry.response ?? entry.value ?? entry.answer_text;
      if (typeof value === "string" && value.trim()) {
        return value.trim();
      }
      if (Array.isArray(value)) {
        const first = value.find((item) => typeof item === "string" && item.trim());
        if (typeof first === "string") {
          return first.trim();
        }
      }
    }
  }
  return undefined;
};

const PlayerMatchProfilePage = () => {
  const { id: routeUserId } = useParams();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const { user } = useAuth() as { user?: unknown };
  const { displayName } = usePlayerIdentity();

  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [favoriteLoading, setFavoriteLoading] = useState(false);
  const [blockLoading, setBlockLoading] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);

  const token = getStoredAuthToken({ preferScheme: "token" });

  const targetUserId = useMemo(() => {
    const stateUserId = (location.state as { userId?: number | string } | undefined)?.userId;
    return (
      stateUserId ||
      searchParams.get("userId") ||
      searchParams.get("id") ||
      routeUserId ||
      extractUserId(user)
    );
  }, [location.state, routeUserId, searchParams, user]);

  const viewerLevel = useMemo(() => deriveViewerLevel(user), [user]);
  const currentUserId = useMemo(() => extractUserId(user), [user]);

  const inviteMessage = useMemo(() => {
    const playerName = profile?.fullName ?? "there";
    const viewerLevelText = viewerLevel ?? "tennis";
    const profileLinkId = currentUserId ?? "me";
    return `Hi ${playerName}, I'm ${displayName} and I found you on the Tennis Plan App. I'm a ${viewerLevelText} level player and you can check out my profile here: ttp://player/profile/${profileLinkId}. Let me know if you'd be interested in hitting some time.`;
  }, [currentUserId, displayName, profile?.fullName, viewerLevel]);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!token) {
        setError("Missing authentication token.");
        setLoading(false);
        return;
      }
      if (!targetUserId) {
        setError("Missing player identifier.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const response = await fetchPlayerDetails({ token, authScheme: "token", userId: targetUserId });
        const firstRecord = Array.isArray(response)
          ? (response[0] as RawPlayerRecord | undefined)
          : Array.isArray((response as { data?: unknown[] })?.data)
            ? ((response as { data?: unknown[] }).data?.[0] as RawPlayerRecord | undefined)
            : (response as RawPlayerRecord | undefined);
        const normalized = normalizeProfile(firstRecord);
        if (!normalized) {
          setError("We couldn't load this player's profile.");
        }
        setProfile(normalized);
      } catch (err) {
        setError((err as Error).message || "Unable to load player profile.");
      } finally {
        setLoading(false);
      }
    };

    void fetchProfile();
  }, [targetUserId, token]);

  const toggleFavorite = async () => {
    if (!profile || !token) return;
    setFavoriteLoading(true);
    setActionError(null);
    try {
      if (profile.isFavorite) {
        await removeFavorite({ token, followeeId: profile.userId });
        setProfile((current) => (current ? { ...current, isFavorite: false } : current));
      } else {
        await addFavorite({ token, followeeId: profile.userId });
        setProfile((current) => (current ? { ...current, isFavorite: true } : current));
      }
    } catch (err) {
      setActionError((err as Error).message || "Unable to update favorite.");
    } finally {
      setFavoriteLoading(false);
    }
  };

  const toggleBlock = async () => {
    if (!profile || !token) return;
    setBlockLoading(true);
    setActionError(null);
    try {
      if (profile.isBlocked) {
        await unblockPlayer({ token, blockedId: profile.userId });
        setProfile((current) => (current ? { ...current, isBlocked: false } : current));
      } else {
        await blockPlayer({ token, blockedId: profile.userId });
        setProfile((current) => (current ? { ...current, isBlocked: true } : current));
      }
    } catch (err) {
      setActionError((err as Error).message || "Unable to update block status.");
    } finally {
      setBlockLoading(false);
    }
  };

  const verifyLevel = async () => {
    if (!profile || !token) return;
    setVerifyLoading(true);
    setActionError(null);
    try {
      await verifyUserLevel({ token, userId: profile.userId, level: true });
      setProfile((current) =>
        current
          ? { ...current, verifiedLevelCount: (current.verifiedLevelCount || 0) + 1 }
          : current,
      );
    } catch (err) {
      setActionError((err as Error).message || "Unable to verify level.");
    } finally {
      setVerifyLoading(false);
    }
  };

  const initials = useMemo(() => {
    const name = profile?.fullName ?? "Player";
    const parts = name.split(" ").filter(Boolean);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    if (parts[0]) return parts[0].slice(0, 2).toUpperCase();
    return "TP";
  }, [profile?.fullName]);

  const smsBody = encodeURIComponent(inviteMessage);
  const phoneDigits = getPhoneDigits(profile?.phone);
  const smsHref = phoneDigits ? `sms:${phoneDigits}?&body=${smsBody}` : undefined;

  return (
    <MainLayout>
      <div className="match-profile-page">
        {loading ? (
          <div className="match-profile-state" role="status">
            <Loader2 size={20} className="spin" aria-hidden="true" />
            <p>Loading player profile…</p>
          </div>
        ) : error || !profile ? (
          <div className="match-profile-state" role="alert">
            <AlertCircle size={20} aria-hidden="true" />
            <div>
              <p className="match-profile-state__title">Unable to load profile</p>
              <p className="match-profile-state__message">{error || "Please try again later."}</p>
            </div>
          </div>
        ) : (
          <article className="match-profile-card">
            <header className="match-profile-header">
              <div className="match-profile-person">
                <div className="match-profile-avatar" aria-hidden={!profile.profilePicture}>
                  {profile.profilePicture ? (
                    <img src={profile.profilePicture} alt={`${profile.fullName} profile`} />
                  ) : (
                    <span>{initials}</span>
                  )}
                </div>
                <div>
                  <h1>{profile.fullName}</h1>
                  <p className="match-profile-meta">
                    <Phone size={16} aria-hidden="true" />
                    <span>{profile.phone ? formatPhoneDisplay(profile.phone) : "No phone shared"}</span>
                  </p>
                </div>
              </div>
              <div className="match-profile-actions">
                <button
                  type="button"
                  className={`match-profile-button${profile.isFavorite ? " match-profile-button--active" : ""}`}
                  onClick={toggleFavorite}
                  disabled={favoriteLoading}
                >
                  {favoriteLoading ? <Loader2 size={16} className="spin" aria-hidden="true" /> : <Heart size={16} aria-hidden="true" />}
                  <span>{profile.isFavorite ? "Favorited" : "Favorite"}</span>
                </button>
                <a
                  className="match-profile-button match-profile-button--secondary"
                  href={smsHref}
                  onClick={(event) => {
                    if (!smsHref) {
                      event.preventDefault();
                    }
                  }}
                  aria-disabled={!smsHref}
                >
                  <MessageCircle size={16} aria-hidden="true" />
                  <span>SMS invite</span>
                </a>
                <button
                  type="button"
                  className={`match-profile-button match-profile-button--secondary${profile.isBlocked ? " match-profile-button--danger" : ""}`}
                  onClick={toggleBlock}
                  disabled={blockLoading}
                >
                  {blockLoading ? <Loader2 size={16} className="spin" aria-hidden="true" /> : <Ban size={16} aria-hidden="true" />}
                  <span>{profile.isBlocked ? "Unblock" : "Block"}</span>
                </button>
              </div>
            </header>

            {actionError && (
              <div className="match-profile-banner" role="alert">
                <AlertCircle size={16} aria-hidden="true" />
                <p>{actionError}</p>
              </div>
            )}

            <section className="match-profile-section">
              <h2>About</h2>
              <p className="match-profile-body">{profile.about || "This player hasn’t shared an about section yet."}</p>
            </section>

            <section className="match-profile-section">
              <div className="match-profile-section__header">
                <h2>Level</h2>
                <div className="match-profile-level-pill">
                  <BadgeCheck size={16} aria-hidden="true" />
                  <span>{profile.skillLevel || "Not shared"}</span>
                </div>
              </div>
              <p className="match-profile-body">
                {profile.verifiedLevelCount > 0
                  ? `${profile.verifiedLevelCount} players have verified this level.`
                  : "No level verifications yet."}
              </p>
              <button
                type="button"
                className="match-profile-button match-profile-button--secondary"
                onClick={verifyLevel}
                disabled={verifyLoading}
              >
                {verifyLoading ? <Loader2 size={16} className="spin" aria-hidden="true" /> : <ShieldCheck size={16} aria-hidden="true" />}
                <span>Verify level</span>
              </button>
            </section>

            <section className="match-profile-section">
              <h2>Availability</h2>
              {profile.availability.length > 0 ? (
                <ul className="match-profile-list">
                  {profile.availability.map((slot) => (
                    <li key={slot}>{slot}</li>
                  ))}
                </ul>
              ) : (
                <p className="match-profile-body">No preferences available.</p>
              )}
            </section>

            <section className="match-profile-section">
              <h2>Local courts</h2>
              {profile.courts.length > 0 ? (
                <ul className="match-profile-list">
                  {profile.courts.map((court) => (
                    <li key={court}>{court}</li>
                  ))}
                </ul>
              ) : (
                <p className="match-profile-body">No home courts shared yet.</p>
              )}
            </section>

            <section className="match-profile-section">
              <h2>Looking for</h2>
              {profile.lookingFor.length > 0 ? (
                <div className="match-profile-chips">
                  {profile.lookingFor.map((preference) => (
                    <span key={preference} className="match-profile-chip">
                      <Star size={14} aria-hidden="true" />
                      {preference}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="match-profile-body">No play preferences shared yet.</p>
              )}
            </section>

            <section className="match-profile-section match-profile-section--cta">
              <div>
                <h2>Invite {profile.fullName.split(" ")[0] || "this player"}</h2>
                <p className="match-profile-body">Send a quick SMS with your profile link and level.</p>
              </div>
              <a
                className="match-profile-button match-profile-button--primary"
                href={smsHref}
                onClick={(event) => {
                  if (!smsHref) {
                    event.preventDefault();
                  }
                }}
                aria-disabled={!smsHref}
              >
                <MessageCircle size={16} aria-hidden="true" />
                <span>Send SMS invite</span>
              </a>
            </section>
          </article>
        )}
      </div>
    </MainLayout>
  );
};

export default PlayerMatchProfilePage;
