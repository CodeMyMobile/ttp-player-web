import { useEffect, useMemo, useState } from "react";
import { Loader2, Mail, MapPin, Phone, ShieldCheck, Target } from "lucide-react";
import MainLayout from "../components/MainLayout";
import { fetchPlayerDetails } from "../api/playerHome";
import { getStoredAuthToken } from "../services/authToken";
import { getPersonalDetails } from "../services/auth";
import { formatPhoneDisplay } from "../services/phone";

import "./PlayerSettingsPages.css";

type RawMatchProfileRecord = {
  userId?: number;
  full_name?: string;
  email?: string;
  phone?: string;
  profile_picture?: string;
  skillLevel?: string;
  availability?: string[] | string;
  playerLocations?: string[] | string;
  playerCourtLocations?: string[] | string;
  lookingFor?: string[] | string;
  gender?: string;
  genderAdditionalText?: string;
  about_me?: string;
  isLevelConfirmed?: boolean;
  verifiedLevelCount?: number | string;
  matchFrequency?: string;
  match_frequency?: string;
  playerExperience?: string;
  player_experience?: string;
  updated_at?: string;
  [key: string]: unknown;
};

type PersonalDetailsRecord = {
  id?: number;
  full_name?: string;
  email?: string;
  phone?: string;
  profile_picture?: string;
  about_me?: string;
};

type MatchProfile = {
  id?: string;
  name: string;
  initials: string;
  about?: string;
  location?: string;
  level?: string;
  levelVerified: boolean;
  verificationCount?: number;
  availability: string[];
  matchGoals: string[];
  localCourts: string[];
  locations: string[];
  matchFrequency?: string;
  experience?: string;
  gender?: string;
  email?: string;
  phone?: string;
  profileImageUrl?: string;
  updatedAtLabel?: string;
};

type Status = "idle" | "loading" | "ready" | "error";

const ensureStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter((item): item is string => item.length > 0);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return [];
    }
    return trimmed.includes(",")
      ? trimmed
          .split(",")
          .map((item) => item.trim())
          .filter((item) => item.length > 0)
      : [trimmed];
  }
  return [];
};

const pickString = (...values: unknown[]): string | undefined => {
  for (const value of values) {
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed.length > 0) {
        return trimmed;
      }
    }
  }
  return undefined;
};

const toInitials = (name?: string, email?: string): string => {
  if (name) {
    const parts = name
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    if (parts.length === 1) {
      return parts[0].slice(0, 2).toUpperCase();
    }
  }
  if (email) {
    return email.slice(0, 2).toUpperCase();
  }
  return "MP";
};

const parseNumber = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return undefined;
};

const normalizeGender = (primary?: string, fallback?: string): string | undefined => {
  const source = pickString(primary, fallback);
  if (!source) {
    return undefined;
  }
  return source
    .split(" ")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase())
    .join(" ");
};

const formatDateLabel = (value?: string): string | undefined => {
  if (!value) {
    return undefined;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
};

const normalizeMatchProfile = (
  raw: RawMatchProfileRecord | null,
  personal: PersonalDetailsRecord | null,
): MatchProfile | null => {
  if (!raw && !personal) {
    return null;
  }

  const availability = ensureStringArray(raw?.availability);
  const matchGoals = ensureStringArray(raw?.lookingFor);
  const localCourts = ensureStringArray(raw?.playerCourtLocations);
  const locations = ensureStringArray(raw?.playerLocations);
  const about = pickString(raw?.about_me, personal?.about_me);
  const name = pickString(raw?.full_name, personal?.full_name) ?? "Matchplay player";
  const email = pickString(raw?.email, personal?.email);
  const phone = pickString(raw?.phone, personal?.phone);
  const level = pickString(raw?.skillLevel);
  const matchFrequency = pickString(raw?.matchFrequency, raw?.match_frequency);
  const experience = pickString(raw?.playerExperience, raw?.player_experience);
  const gender = normalizeGender(raw?.gender, raw?.genderAdditionalText);
  const verificationCount = parseNumber(raw?.verifiedLevelCount);
  const profileImageUrl = pickString(raw?.profile_picture, personal?.profile_picture);
  const location = locations[0];
  const initials = toInitials(name, email);

  return {
    id: raw?.userId ? String(raw.userId) : personal?.id ? String(personal.id) : undefined,
    name,
    initials,
    about,
    location,
    level,
    levelVerified: Boolean(raw?.isLevelConfirmed),
    verificationCount,
    availability,
    matchGoals,
    localCourts,
    locations,
    matchFrequency,
    experience,
    gender,
    email,
    phone,
    profileImageUrl,
    updatedAtLabel: formatDateLabel(raw?.updated_at),
  };
};

const PlayerMatchProfilePage = () => {
  const [profile, setProfile] = useState<MatchProfile | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [refreshIndex, setRefreshIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const loadProfile = async () => {
      const token = getStoredAuthToken({ preferScheme: "Bearer" });
      if (!token) {
        setStatus("error");
        setError("Please sign in to view your match profile.");
        return;
      }

      setStatus("loading");
      setError(null);
      try {
        const personalDetails = (await getPersonalDetails()) as PersonalDetailsRecord | null;
        if (!personalDetails?.id) {
          throw new Error("We couldn’t determine your player profile ID.");
        }
        const rawProfile = (await fetchPlayerDetails({
          token,
          userId: personalDetails.id,
        })) as RawMatchProfileRecord | null;

        if (cancelled) {
          return;
        }

        const normalized = normalizeMatchProfile(rawProfile, personalDetails);
        setProfile(normalized);
        setStatus("ready");
      } catch (requestError) {
        if (cancelled) {
          return;
        }
        console.error("Failed to load match profile", requestError);
        setStatus("error");
        setError(
          requestError instanceof Error
            ? requestError.message
            : "We couldn’t load your match profile. Please try again.",
        );
      }
    };

    loadProfile();

    return () => {
      cancelled = true;
    };
  }, [refreshIndex]);

  const locationLabel = useMemo(() => {
    if (!profile) {
      return "Location not shared";
    }
    if (profile.location) {
      return profile.location;
    }
    if (profile.locations.length > 0) {
      return profile.locations[0];
    }
    return "Location not shared";
  }, [profile]);

  const handleRetry = () => {
    setRefreshIndex((index) => index + 1);
  };

  const availabilityContent = profile?.availability.length ? (
    <ul className="match-chip-list">
      {profile.availability.map((slot) => (
        <li key={slot} className="match-chip">
          {slot}
        </li>
      ))}
    </ul>
  ) : (
    <p className="match-profile-empty">No availability shared yet.</p>
  );

  const matchGoalsContent = profile?.matchGoals.length ? (
    <ul className="match-chip-list">
      {profile.matchGoals.map((goal) => (
        <li key={goal} className="match-chip match-chip--accent">
          {goal}
        </li>
      ))}
    </ul>
  ) : (
    <p className="match-profile-empty">Add the sessions you’re hoping to schedule.</p>
  );

  const localCourtsContent = profile?.localCourts.length ? (
    <ul className="match-sidebar__list">
      {profile.localCourts.map((court) => (
        <li key={court}>
          <MapPin size={16} aria-hidden="true" />
          <span>{court}</span>
        </li>
      ))}
    </ul>
  ) : (
    <p className="match-profile-empty">Share the courts where you usually meet players.</p>
  );

  const contactDetails = (
    <ul className="match-sidebar__list">
      {profile?.email ? (
        <li>
          <Mail size={16} aria-hidden="true" />
          <span>{profile.email}</span>
        </li>
      ) : null}
      {profile?.phone ? (
        <li>
          <Phone size={16} aria-hidden="true" />
          <span>{formatPhoneDisplay(profile.phone)}</span>
        </li>
      ) : null}
    </ul>
  );

  let bodyContent: JSX.Element | null = null;

  if (status === "loading" || status === "idle") {
    bodyContent = (
      <div className="match-card match-card--state" aria-busy="true">
        <Loader2 className="match-card__spinner" size={32} strokeWidth={2.5} aria-hidden="true" />
        <p>Loading your match profile…</p>
      </div>
    );
  } else if (status === "error") {
    bodyContent = (
      <div className="match-card match-card--state" role="alert">
        <p>{error ?? "We couldn’t load your match profile."}</p>
        <button type="button" className="match-card__retry" onClick={handleRetry}>
          Try again
        </button>
      </div>
    );
  } else if (profile) {
    bodyContent = (
      <section className="settings-section">
        <div className="match-profile__layout">
          <div className="match-profile__main">
            <article className="match-card match-card--summary">
              <div className="match-profile-summary">
                <div className="match-profile-avatar" aria-hidden="true">
                  {profile.profileImageUrl ? (
                    <img src={profile.profileImageUrl} alt="" />
                  ) : (
                    <span>{profile.initials}</span>
                  )}
                </div>
                <div className="match-profile-summary__content">
                  <p className="match-profile-summary__eyebrow">Match profile owner</p>
                  <h2>{profile.name}</h2>
                  <p>{locationLabel}</p>
                </div>
                {profile.level ? (
                  <span className="match-profile-pill" aria-label="NTRP level">
                    NTRP {profile.level}
                  </span>
                ) : null}
              </div>
              <p className="match-profile-summary__status">
                {profile.updatedAtLabel ? `Last updated ${profile.updatedAtLabel}` : "Updated recently"}
              </p>
              <p className="match-profile-about">
                {profile.about ?? "Share a short bio so partners know what you’re looking for."}
              </p>
              <dl className="match-profile-meta">
                <div>
                  <dt>Level verification</dt>
                  <dd>
                    {profile.levelVerified ? (
                      <span className="match-profile-meta__verified">
                        <ShieldCheck size={16} aria-hidden="true" />
                        Verified by the community
                      </span>
                    ) : (
                      "Level not verified yet"
                    )}
                    {profile.verificationCount ? (
                      <small>
                        {profile.verificationCount} {profile.verificationCount === 1 ? "player" : "players"} confirmed this level.
                      </small>
                    ) : null}
                  </dd>
                </div>
                <div>
                  <dt>Match frequency</dt>
                  <dd>{profile.matchFrequency ?? "Not shared"}</dd>
                </div>
                <div>
                  <dt>Experience</dt>
                  <dd>{profile.experience ?? "Not shared"}</dd>
                </div>
                <div>
                  <dt>Gender</dt>
                  <dd>{profile.gender ?? "Not shared"}</dd>
                </div>
              </dl>
            </article>

            <article className="match-card">
              <div className="match-card__heading">
                <h2 className="match-card__title">Match availability</h2>
                <p className="match-card__description">
                  These are the time windows you shared while building your profile.
                </p>
              </div>
              {availabilityContent}
            </article>

            <article className="match-card">
              <div className="match-card__heading">
                <h2 className="match-card__title">Match goals & session vibes</h2>
                <p className="match-card__description">
                  We use this to suggest compatible partners and session formats.
                </p>
              </div>
              {matchGoalsContent}
              <div className="match-profile-locations">
                <h3>Preferred locations</h3>
                {profile.locations.length ? (
                  <ul>
                    {profile.locations.map((spot) => (
                      <li key={spot}>{spot}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="match-profile-empty">No preferred locations shared yet.</p>
                )}
              </div>
            </article>
          </div>

          <aside className="match-sidebar">
            <div className="match-sidebar__card match-sidebar__card--info">
              <h3 className="match-sidebar__title">Contact details</h3>
              {profile?.email || profile?.phone ? contactDetails : (
                <p className="match-profile-empty">Add your email or phone so other players can reach you.</p>
              )}
            </div>

            <div className="match-sidebar__card">
              <h3 className="match-sidebar__title">Go-to courts</h3>
              {localCourtsContent}
            </div>
          </aside>
        </div>
      </section>
    );
  } else {
    bodyContent = (
      <div className="match-card match-card--state" role="status">
        <p>You haven’t created a match profile yet.</p>
        <button type="button" className="match-card__retry" onClick={handleRetry}>
          Refresh
        </button>
      </div>
    );
  }

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
              Tell other players how and when you like to compete so we can suggest better partners and session ideas.
            </p>
          </header>

          {bodyContent}
        </div>
      </div>
    </MainLayout>
  );
};

export default PlayerMatchProfilePage;
