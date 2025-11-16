import {
  AlertCircle,
  Loader2,
  MapPin,
  ShieldCheck,
  Target,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchPlayerDetails } from "../api/playerHome";
import { getPlayerPersonalDetails, type PlayerPersonalDetails } from "../api/playerProfile";
import MainLayout from "../components/MainLayout";
import { extractTokenCredentials, getStoredAuthToken } from "../services/authToken";

import "./PlayerSettingsPages.css";

type MatchProfileRecord = Record<string, unknown>;

type PlayerMatchProfile = {
  id: string;
  name: string;
  initials: string;
  email?: string;
  phone?: string;
  about?: string;
  level?: string;
  availability: string[];
  lookingFor: string[];
  courts: string[];
  locations: string[];
  gender?: string;
  profileImageUrl?: string;
  verifiedLevelCount?: number | null;
  isLevelConfirmed?: boolean;
};

type Status = "loading" | "ready" | "error";

const canonicalAvailabilityLabels: Record<string, string> = {
  "weekdays am": "Weekdays AM",
  "weekday am": "Weekdays AM",
  "weekday morning": "Weekdays AM",
  "weekday mornings": "Weekdays AM",
  "weekdays pm": "Weekdays PM",
  "weekday pm": "Weekdays PM",
  "weekday evening": "Weekdays PM",
  "weekday evenings": "Weekdays PM",
  "weekend": "Weekends",
  "weekends": "Weekends",
  "weekend mornings": "Weekend mornings",
  "weekend morning": "Weekend mornings",
  "weekend afternoons": "Weekend afternoons",
  "weekend evening": "Weekend evenings",
  "weekend evenings": "Weekend evenings",
};

const toCanonicalAvailability = (label: string) => {
  const normalized = label.trim().toLowerCase();
  return canonicalAvailabilityLabels[normalized] ?? label.trim();
};

const ensureStringArray = (value: unknown, normalizer?: (value: string) => string): string[] => {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item !== "string") {
          return "";
        }
        const trimmed = item.trim();
        return trimmed.length ? (normalizer ? normalizer(trimmed) : trimmed) : "";
      })
      .filter((item): item is string => item.length > 0);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return [];
    }
    return [normalizer ? normalizer(trimmed) : trimmed];
  }
  return [];
};

const toInitials = (name: string, email?: string) => {
  const trimmed = name.trim();
  if (trimmed) {
    const parts = trimmed.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  }
  if (email) {
    return email.slice(0, 2).toUpperCase();
  }
  return "MP";
};

const formatPhoneNumber = (value?: string) => {
  if (!value) {
    return "";
  }
  const digits = value.replace(/\D/g, "");
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return value;
};

const extractMatchRecord = (payload: unknown): MatchProfileRecord => {
  if (!payload || typeof payload !== "object") {
    return {};
  }
  const record = payload as Record<string, unknown>;
  if (record.data && typeof record.data === "object" && !Array.isArray(record.data)) {
    return record.data as Record<string, unknown>;
  }
  return record;
};

const mapMatchProfileData = (
  record: MatchProfileRecord,
  personalDetails: PlayerPersonalDetails | null,
): PlayerMatchProfile => {
  const sanitizedRecord = record ?? {};
  const nameFromPersonal =
    typeof personalDetails?.full_name === "string" && personalDetails.full_name.trim().length
      ? personalDetails.full_name.trim()
      : null;
  const nameFromRecord =
    typeof sanitizedRecord.full_name === "string" && sanitizedRecord.full_name.trim().length
      ? (sanitizedRecord.full_name as string).trim()
      : null;
  const name = nameFromPersonal ?? nameFromRecord ?? "MatchPlay player";
  const email =
    (typeof personalDetails?.email === "string" && personalDetails.email) ||
    (typeof sanitizedRecord.email === "string" ? (sanitizedRecord.email as string) : undefined);
  const profileImage =
    (typeof personalDetails?.profile_picture === "string" && personalDetails.profile_picture?.trim()) ||
    (typeof sanitizedRecord.profile_picture === "string"
      ? (sanitizedRecord.profile_picture as string).trim()
      : undefined);
  const phone =
    (typeof personalDetails?.phone === "string" && personalDetails.phone) ||
    (typeof sanitizedRecord.phone === "string" ? (sanitizedRecord.phone as string) : undefined);
  const about =
    (typeof sanitizedRecord.about_me === "string" && sanitizedRecord.about_me.trim().length
      ? (sanitizedRecord.about_me as string).trim()
      : undefined) ||
    (typeof personalDetails?.about_me === "string" && personalDetails.about_me.trim().length
      ? personalDetails.about_me.trim()
      : undefined);
  const availability = ensureStringArray(sanitizedRecord.availability, toCanonicalAvailability);
  const lookingFor = ensureStringArray(sanitizedRecord.lookingFor);
  const courts = ensureStringArray(sanitizedRecord.playerCourtLocations);
  const locations = ensureStringArray(sanitizedRecord.playerLocations);
  const gender =
    (typeof sanitizedRecord.gender === "string" && sanitizedRecord.gender.trim()) ||
    (typeof personalDetails?.gender === "string" ? personalDetails.gender : undefined);
  const skillLabel = typeof sanitizedRecord.skillLevel === "string" ? sanitizedRecord.skillLevel.trim() : "";
  const levelMatch = skillLabel.match(/NTRP\s*([0-9.]+)/i);
  const level = levelMatch?.[1] ?? (skillLabel || undefined);
  const verifiedLevelCountRaw = sanitizedRecord.verifiedLevelCount;
  const verifiedLevelCount = (() => {
    if (typeof verifiedLevelCountRaw === "number") {
      return verifiedLevelCountRaw;
    }
    if (typeof verifiedLevelCountRaw === "string") {
      const parsed = Number.parseInt(verifiedLevelCountRaw, 10);
      return Number.isNaN(parsed) ? null : parsed;
    }
    return null;
  })();
  const idValue =
    sanitizedRecord.userId ??
    sanitizedRecord.id ??
    personalDetails?.id ??
    (name ? name.replace(/\s+/g, "-").toLowerCase() : "profile");

  return {
    id: String(idValue),
    name,
    initials: toInitials(name, email),
    email,
    phone,
    about,
    level,
    availability,
    lookingFor,
    courts,
    locations,
    gender,
    profileImageUrl: profileImage,
    verifiedLevelCount,
    isLevelConfirmed: Boolean(sanitizedRecord.isLevelConfirmed),
  };
};

const PlayerMatchProfilePage = () => {
  const [profile, setProfile] = useState<PlayerMatchProfile | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => () => {
    mountedRef.current = false;
  }, []);

  const loadProfile = useCallback(async () => {
    const authToken = getStoredAuthToken({ defaultScheme: "token", preferScheme: "token" });
    const tokenCredentials = extractTokenCredentials(authToken, {
      defaultScheme: "token",
      preferScheme: "token",
    });
    if (!authToken || !tokenCredentials) {
      setStatus("error");
      setProfile(null);
      setError("Sign in to view and share your match profile.");
      return;
    }

    setStatus("loading");
    setError(null);

    try {
      const personalDetails = await getPlayerPersonalDetails(authToken);
      const userId = personalDetails?.id;
      if (!userId) {
        throw new Error("We couldn\'t determine your player account. Please refresh the page.");
      }
      const matchRecord = await fetchPlayerDetails({
        token: authToken,
        userId,
        tokenCredentials,
      });
      if (!mountedRef.current) {
        return;
      }
      const extractedRecord = extractMatchRecord(matchRecord);
      setProfile(mapMatchProfileData(extractedRecord, personalDetails));
      setStatus("ready");
    } catch (requestError) {
      if (!mountedRef.current) {
        return;
      }
      console.error("Failed to load match profile", requestError);
      setError(
        requestError instanceof Error
          ? requestError.message
          : "We couldn\'t load your match profile. Please try again.",
      );
      setStatus("error");
      setProfile(null);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const formattedPhone = useMemo(() => formatPhoneNumber(profile?.phone), [profile?.phone]);
  const aboutCopy =
    profile?.about?.trim() ||
    "Share a short intro so local players know what kinds of hits or sessions you enjoy most.";

  const genderAndLevel = useMemo(() => {
    if (!profile) {
      return "";
    }
    if (profile.level && profile.gender) {
      return `NTRP ${profile.level} • ${profile.gender}`;
    }
    if (profile.level) {
      return `NTRP ${profile.level}`;
    }
    return profile.gender ?? "";
  }, [profile]);

  const availabilityChips = profile?.availability ?? [];
  const lookingForChips = profile?.lookingFor ?? [];
  const courts = profile?.courts ?? [];
  const locations = profile?.locations ?? [];

  const showProfileContent = status === "ready";

  return (
    <MainLayout>
      <div className="settings-page">
        <div className="settings-page__inner">
          <header className="settings-hero settings-hero--match">
            <span className="settings-hero__badge">
              <Target size={16} aria-hidden="true" />
              Match preferences
            </span>
            <h1 className="settings-hero__title">Player match profile</h1>
            <p className="settings-hero__subtitle">
              This is what other Tennis Plan members see when you opt-in to player matching or send a MatchPlay invite.
            </p>
          </header>

          <section className="settings-section">
            {status === "loading" ? (
              <div className="match-profile__state" role="status">
                <Loader2 className="match-profile__state-icon match-profile__state-icon--spinner" aria-hidden="true" />
                <div>
                  <p className="match-profile__state-title">Loading your match profile</p>
                  <p className="match-profile__state-message">Gathering your preferences and availability…</p>
                </div>
              </div>
            ) : null}

            {status === "error" && error ? (
              <div className="match-profile__state match-profile__state--error" role="alert">
                <AlertCircle className="match-profile__state-icon" aria-hidden="true" />
                <div>
                  <p className="match-profile__state-title">We couldn&apos;t load your profile</p>
                  <p className="match-profile__state-message">{error}</p>
                </div>
                <button type="button" className="match-profile__retry" onClick={loadProfile}>
                  Try again
                </button>
              </div>
            ) : null}

            {showProfileContent && profile ? (
              <div className="match-profile__layout">
                <div className="match-profile__main">
                  <article className="match-card">
                    <div className="match-card__heading">
                      <h2 className="match-card__title">Profile overview</h2>
                      <p className="match-card__description">
                        Your name, bio, and level appear to other members when you match.
                      </p>
                    </div>
                    <div className="match-profile-overview">
                      {profile.profileImageUrl ? (
                        <img
                          src={profile.profileImageUrl}
                          alt={`${profile.name} profile avatar`}
                          className="match-profile-avatar match-profile-avatar--image"
                        />
                      ) : (
                        <span className="match-profile-avatar" aria-hidden="true">
                          {profile.initials}
                        </span>
                      )}
                      <div className="match-profile-overview__identity">
                        <p className="match-profile-overview__name">{profile.name}</p>
                        {genderAndLevel ? (
                          <p className="match-profile-overview__meta">{genderAndLevel}</p>
                        ) : null}
                      </div>
                      <div className="match-profile-overview__badges">
                        {profile.isLevelConfirmed ? (
                          <span className="match-chip match-chip--success">
                            <ShieldCheck size={14} aria-hidden="true" /> Verified level
                          </span>
                        ) : (
                          <span className="match-chip match-chip--muted">Level unverified</span>
                        )}
                        {profile.verifiedLevelCount ? (
                          <span className="match-chip match-chip--muted">
                            {profile.verifiedLevelCount} confirmation
                            {profile.verifiedLevelCount === 1 ? "" : "s"}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <p className="match-profile-overview__about">{aboutCopy}</p>
                  </article>

                  <article className="match-card">
                    <div className="match-card__heading">
                      <h2 className="match-card__title">Match availability</h2>
                      <p className="match-card__description">
                        These time windows are shared when you contact players so you can align faster.
                      </p>
                    </div>
                    {availabilityChips.length ? (
                      <div className="match-card__chips" role="list">
                        {availabilityChips.map((slot) => (
                          <span key={slot} className="match-chip" role="listitem">
                            {slot}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="match-card__helper">
                        Add availability in the MatchPlay mobile app to help other members schedule with you.
                      </p>
                    )}
                  </article>

                  <article className="match-card">
                    <div className="match-card__heading">
                      <h2 className="match-card__title">Preferred play styles</h2>
                      <p className="match-card__description">We surface these goals when you search for partners.</p>
                    </div>
                    {lookingForChips.length ? (
                      <div className="match-card__chips" role="list">
                        {lookingForChips.map((preference) => (
                          <span key={preference} className="match-chip" role="listitem">
                            {preference}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="match-card__helper">Add what you&apos;re looking for to get more relevant invites.</p>
                    )}
                  </article>
                </div>

                <aside className="match-sidebar">
                  <div className="match-sidebar__card">
                    <h3 className="match-sidebar__title">Contact &amp; privacy</h3>
                    <div className="match-sidebar__field">
                      <span className="match-sidebar__label">Email</span>
                      <p className="match-sidebar__value">{profile.email ?? "Not shared"}</p>
                    </div>
                    <div className="match-sidebar__field">
                      <span className="match-sidebar__label">Phone</span>
                      <p className="match-sidebar__value">{formattedPhone || "Not shared"}</p>
                    </div>
                  </div>

                  <div className="match-sidebar__card">
                    <h3 className="match-sidebar__title">
                      <MapPin size={18} aria-hidden="true" />
                      Home courts &amp; neighborhoods
                    </h3>
                    <div className="match-sidebar__field">
                      <span className="match-sidebar__label">Preferred courts</span>
                      {courts.length ? (
                        <ul className="match-sidebar__list">
                          {courts.map((court) => (
                            <li key={court}>{court}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="match-sidebar__value">Add courts to show where you usually meet.</p>
                      )}
                    </div>
                    <div className="match-sidebar__field">
                      <span className="match-sidebar__label">Cities or neighborhoods</span>
                      {locations.length ? (
                        <ul className="match-sidebar__list">
                          {locations.map((location) => (
                            <li key={location}>{location}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="match-sidebar__value">Share at least one location to get better matches.</p>
                      )}
                    </div>
                  </div>

                  <div className="match-sidebar__tips">
                    <h3>Helpful reminders</h3>
                    <ul>
                      <li>Update your availability when your schedule changes.</li>
                      <li>Keep your courts current so travel estimates are accurate.</li>
                      <li>Need to edit these details? Head to the MatchPlay mobile app.</li>
                    </ul>
                  </div>
                </aside>
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </MainLayout>
  );
};

export default PlayerMatchProfilePage;
