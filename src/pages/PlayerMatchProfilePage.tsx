import { useState } from "react";
import { Check, Clock, MapPin, Target } from "lucide-react";
import MainLayout from "../components/MainLayout";

import "./PlayerSettingsPages.css";

const availabilitySlots = [
  "Early mornings",
  "Weekday afternoons",
  "Weekday evenings",
  "Weekend mornings",
  "Weekend afternoons",
  "Weekend evenings",
];

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

const PlayerMatchProfilePage = () => {
  const [selectedAvailability, setSelectedAvailability] = useState<string[]>([
    "Weekday evenings",
    "Weekend mornings",
  ]);
  const [intensity, setIntensity] = useState("balanced");
  const [formats, setFormats] = useState<string[]>(["singles", "doubles"]);
  const [homeBase, setHomeBase] = useState("Austin Tennis Center");

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
            <button type="button" className="settings-save__button">
              Save match profile
            </button>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default PlayerMatchProfilePage;
