import { useEffect, useState } from "react";
import { Check, Clock, MapPin, Target } from "lucide-react";
import MainLayout from "../components/MainLayout";
import { fetchPlayerDetails } from "../api/playerHome";
import { getPersonalDetails } from "../services/auth";
import { getStoredAuthToken } from "../services/authToken";

import "./PlayerSettingsPages.css";

const availabilitySlots = [
  "Early mornings",
  "Weekday afternoons",
  "Weekday evenings",
  "Weekend mornings",
  "Weekend afternoons",
  "Weekend evenings",
];

type PlayerMatchProfileResponse = {
  availability?: unknown;
  lookingFor?: unknown;
  matchPreferences?: unknown;
  preferred_formats?: unknown;
  matchIntensity?: unknown;
  intensity?: unknown;
  match_intensity?: unknown;
  playerCourtLocations?: unknown;
  playerLocations?: unknown;
  homeBase?: unknown;
  home_court?: unknown;
};

const matchIntensities = [
  { id: "competitive", label: "Competitive play", description: "USTA league or tournament focused" },
  { id: "balanced", label: "Balanced", description: "Mix of rally sessions and competitive sets" },
  { id: "casual", label: "Casual hits", description: "Easy going hits with rally focus" },
];

const preferredFormats = [
  { id: "singles", label: "Singles" },
  { id: "doubles", label: "Doubles" },
  { id: "mixed", label: "Mixed doubles" },
  { id: "drills", label: "Live-ball drills" },
  { id: "fitness", label: "Cardio tennis" },
];

const toStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .map((item) => item.split(",").map((part) => part.trim()))
      .flat()
      .filter((item) => item.length > 0);
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }
  return [];
};

const matchAvailability = (value: string) =>
  availabilitySlots.find((slot) => slot.toLowerCase() === value.trim().toLowerCase());

const normalizeAvailability = (value: unknown) => {
  const matches = toStringArray(value)
    .map((item) => matchAvailability(item) ?? null)
    .filter((item): item is string => Boolean(item));
  return Array.from(new Set(matches));
};

const normalizeFormats = (value: unknown) => {
  const entries = toStringArray(value)
    .map((item) => {
      const normalized = item.toLowerCase();
      const match = preferredFormats.find(
        (format) =>
          format.id.toLowerCase() === normalized || format.label.toLowerCase() === normalized,
      );
      return match?.id ?? null;
    })
    .filter((item): item is string => Boolean(item));

  return Array.from(new Set(entries));
};

const normalizeIntensity = (value: unknown) => {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  const match = matchIntensities.find(
    (option) => option.id === normalized || option.label.toLowerCase() === normalized,
  );
  return match?.id ?? null;
};

const formatLabel = (id: string) => preferredFormats.find((format) => format.id === id)?.label ?? id;

const intensityLabel = (id: string) => matchIntensities.find((option) => option.id === id)?.label ?? id;

const normalizeHomeBase = (record: PlayerMatchProfileResponse) => {
  const courtLocations =
    record.playerCourtLocations ?? record.playerLocations ?? record.homeBase ?? record.home_court;
  const courts = toStringArray(courtLocations);
  return courts[0] ?? "";
};

const PlayerMatchProfilePage = () => {
  const [selectedAvailability, setSelectedAvailability] = useState<string[]>([]);
  const [intensity, setIntensity] = useState("");
  const [formats, setFormats] = useState<string[]>([]);
  const [homeBase, setHomeBase] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const statusMessage = error
    ? "Unable to load profile"
    : loading
      ? "Loading..."
      : "Synced with your profile";

  useEffect(() => {
    let isCancelled = false;

    const loadProfile = async () => {
      setLoading(true);
      setError(null);

      try {
        const authToken = getStoredAuthToken({ defaultScheme: "token", preferScheme: "token" });
        if (!authToken) {
          setError("Sign in to view your match profile.");
          return;
        }

        const personalDetails = await getPersonalDetails();
        const userId =
          personalDetails?.id ?? personalDetails?.userId ?? personalDetails?.user_id ?? null;

        if (!userId) {
          setError("We couldn't determine your player id. Please try again.");
          return;
        }

        const payload =
          (await fetchPlayerDetails({ token: authToken, userId })) as PlayerMatchProfileResponse;

        if (isCancelled || !payload) return;

        const normalizedAvailability = normalizeAvailability(payload.availability);
        const normalizedFormats = normalizeFormats(
          payload.lookingFor ?? payload.matchPreferences ?? payload.preferred_formats,
        );
        const normalizedIntensity = normalizeIntensity(
          payload.matchIntensity ?? payload.intensity ?? payload.match_intensity,
        );
        const normalizedHomeBase = normalizeHomeBase(payload);

        setSelectedAvailability(
          normalizedAvailability.length > 0 ? normalizedAvailability : [],
        );
        setFormats(normalizedFormats.length > 0 ? normalizedFormats : []);
        setIntensity(normalizedIntensity ?? "");
        setHomeBase(normalizedHomeBase ?? "");
      } catch (err) {
        if (isCancelled) return;
        const message = err instanceof Error ? err.message : "Unable to load match profile.";
        setError(message);
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    loadProfile();

    return () => {
      isCancelled = true;
    };
  }, []);

  const toggleAvailability = (slot: string) => {
    setSelectedAvailability((current) =>
      current.includes(slot) ? current.filter((item) => item !== slot) : [...current, slot]
    );
  };

  const toggleFormat = (id: string) => {
    setFormats((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  };

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

          <section className="match-summary" aria-live="polite">
            <div className="match-summary__header">
              <div>
                <p className="match-summary__eyebrow">Your saved preferences</p>
                <h2 className="match-summary__title">Here&apos;s what other players see</h2>
              </div>
              <p className="match-summary__status">{statusMessage}</p>
            </div>

            <div className="match-summary__grid">
              <div className="match-summary__card">
                <p className="match-summary__label">Availability</p>
                <div className="match-summary__chips">
                  {selectedAvailability.length === 0 ? (
                    <span className="match-summary__chip match-summary__chip--empty">Not provided</span>
                  ) : (
                    selectedAvailability.map((slot) => (
                      <span key={slot} className="match-summary__chip">
                        {slot}
                      </span>
                    ))
                  )}
                </div>
              </div>

              <div className="match-summary__card">
                <p className="match-summary__label">Match intensity</p>
                <div className="match-summary__chips">
                  {intensity ? (
                    <span className="match-summary__chip">{intensityLabel(intensity)}</span>
                  ) : (
                    <span className="match-summary__chip match-summary__chip--empty">Not provided</span>
                  )}
                </div>
              </div>

              <div className="match-summary__card">
                <p className="match-summary__label">Preferred formats</p>
                <div className="match-summary__chips">
                  {formats.length === 0 ? (
                    <span className="match-summary__chip match-summary__chip--empty">Not provided</span>
                  ) : (
                    formats.map((format) => (
                      <span key={format} className="match-summary__chip">
                        {formatLabel(format)}
                      </span>
                    ))
                  )}
                </div>
              </div>

              <div className="match-summary__card">
                <p className="match-summary__label">Home courts</p>
                <div className="match-summary__chips">
                  {homeBase ? (
                    <span className="match-summary__chip">{homeBase}</span>
                  ) : (
                    <span className="match-summary__chip match-summary__chip--empty">Not provided</span>
                  )}
                </div>
              </div>
            </div>
          </section>

          {error ? (
            <p role="alert" style={{ color: "#b91c1c", margin: "0 0 1rem" }}>
              {error}
            </p>
          ) : null}
          {!error && loading ? (
            <p role="status" style={{ color: "#4b5563", margin: "0 0 1rem" }}>
              Loading your match profile...
            </p>
          ) : null}

          <section className="settings-section">
            <div className="match-profile__layout">
              <div className="match-profile__main">
                <article className="match-card">
                  <div className="match-card__heading">
                    <h2 className="match-card__title">
                      <Clock size={20} aria-hidden="true" />
                      Match availability
                    </h2>
                    <p className="match-card__description">Choose the windows when you&apos;re generally open to play.</p>
                  </div>
                  <div className="match-availability">
                    {availabilitySlots.map((slot) => {
                      const selected = selectedAvailability.includes(slot);
                      return (
                        <button
                          key={slot}
                          type="button"
                          onClick={() => toggleAvailability(slot)}
                          className={`match-availability__slot${selected ? " match-availability__slot--selected" : ""}`}
                          aria-pressed={selected}
                        >
                          <span className="match-availability__label">{slot}</span>
                          {selected ? (
                            <span className="match-availability__status">
                              <Check size={12} aria-hidden="true" />
                              Selected
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                </article>

                <article className="match-card">
                  <div className="match-card__heading">
                    <h2 className="match-card__title">Match intensity</h2>
                    <p className="match-card__description">Let others know how competitive you&apos;d like sessions to be.</p>
                  </div>
                  <div className="match-intensity">
                    {matchIntensities.map((option) => {
                      const selected = intensity === option.id;
                      return (
                        <label
                          key={option.id}
                          className={`match-intensity__option${selected ? " match-intensity__option--selected" : ""}`}
                        >
                          <input
                            type="radio"
                            name="match-intensity"
                            value={option.id}
                            checked={selected}
                            onChange={() => setIntensity(option.id)}
                            className="visually-hidden"
                          />
                          <span className="match-intensity__label">{option.label}</span>
                          <span className="match-intensity__detail">{option.description}</span>
                        </label>
                      );
                    })}
                  </div>
                </article>

                <article className="match-card">
                  <div className="match-card__heading">
                    <h2 className="match-card__title">Preferred formats</h2>
                    <p className="match-card__description">
                      Highlight the type of play you&apos;re hoping to schedule with new connections.
                    </p>
                  </div>
                  <div className="match-formats">
                    {preferredFormats.map((format) => {
                      const selected = formats.includes(format.id);
                      return (
                        <button
                          key={format.id}
                          type="button"
                          onClick={() => toggleFormat(format.id)}
                          className={`match-format-chip${selected ? " match-format-chip--selected" : ""}`}
                          aria-pressed={selected}
                        >
                          {format.label}
                        </button>
                      );
                    })}
                  </div>
                </article>
              </div>

              <aside className="match-sidebar">
                <div className="match-sidebar__card">
                  <h3 className="match-sidebar__title">
                    <MapPin size={18} aria-hidden="true" />
                    Home courts
                  </h3>
                  <p className="match-sidebar__note">
                    Share the courts where you typically host or prefer to meet.
                  </p>
                  <div className="match-sidebar__field">
                    <span className="match-sidebar__label">Primary facility</span>
                    <input
                      type="text"
                      value={homeBase}
                      onChange={(event) => setHomeBase(event.target.value)}
                      placeholder="Add your go-to courts"
                      className="match-sidebar__input"
                    />
                    <p className="match-sidebar__note">
                      We&apos;ll use this to estimate travel distance for other players.
                    </p>
                  </div>
                </div>

                <div className="match-sidebar__tips">
                  <h3>Tips</h3>
                  <ul>
                    <li>✓ Pick at least two availability windows to match faster.</li>
                    <li>✓ Competitive preferences help us pair you with similar goals.</li>
                    <li>✓ Update your home courts when you travel to new cities.</li>
                  </ul>
                </div>
              </aside>
            </div>
          </section>

          <div className="settings-save">
            <button type="button" className="settings-save__button" disabled={loading}>
              Save match profile
            </button>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default PlayerMatchProfilePage;
