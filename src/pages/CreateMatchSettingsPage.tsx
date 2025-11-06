import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Eye,
  EyeOff,
  Gauge,
  Hash,
  MessageSquare,
  Sparkles,
  Trophy,
  User,
  Users,
} from "lucide-react";

import MainLayout from "../components/MainLayout";

import "./CreateMatchPage.css";

type SkillLevel = {
  value: string;
  label: string;
  description: string;
};

type FormatOption = {
  value: string;
  title: string;
  description: string;
  icon: JSX.Element;
};

type VisibilityOption = {
  value: "public" | "hidden";
  title: string;
  description: string;
  icon: JSX.Element;
};

const skillLevels: SkillLevel[] = [
  { value: "2.0-2.5", label: "2.0 – 2.5", description: "Getting started with organized play." },
  { value: "2.5-3.0", label: "2.5 – 3.0", description: "Rallies are coming together." },
  { value: "3.0-3.5", label: "3.0 – 3.5", description: "Consistent baseline play." },
  { value: "3.5-4.0", label: "3.5 – 4.0", description: "Competitive club level." },
  { value: "4.0-4.5", label: "4.0 – 4.5", description: "Advanced match experience." },
  { value: "4.5+", label: "4.5+", description: "College & tournament ready." },
];

const formatOptions: FormatOption[] = [
  {
    value: "singles",
    title: "Singles",
    description: "One-on-one competitive play.",
    icon: <User size={22} />,
  },
  {
    value: "doubles",
    title: "Doubles",
    description: "Two teams of two players.",
    icon: <Users size={22} />,
  },
  {
    value: "round-robin",
    title: "Round robin",
    description: "Rotate opponents across short sets.",
    icon: <Trophy size={22} />,
  },
  {
    value: "dingles",
    title: "Dingles",
    description: "Play doubles points with singles movement.",
    icon: <Sparkles size={22} />,
  },
  {
    value: "other",
    title: "Other",
    description: "Create a custom format or clinic.",
    icon: <MessageSquare size={22} />,
  },
];

const visibilityOptions: VisibilityOption[] = [
  {
    value: "public",
    title: "Public link",
    description: "Appear in match search and accept requests.",
    icon: <Eye size={22} />,
  },
  {
    value: "hidden",
    title: "Hidden link",
    description: "Only players you share the link with can view.",
    icon: <EyeOff size={22} />,
  },
];

const CreateMatchSettingsPage = () => {
  const navigate = useNavigate();

  const [skillLevel, setSkillLevel] = useState(skillLevels[2]?.value ?? "3.0-3.5");
  const [format, setFormat] = useState(formatOptions[1]?.value ?? "doubles");
  const [visibility, setVisibility] = useState<VisibilityOption["value"]>("public");
  const [courtNumber, setCourtNumber] = useState("");
  const [notes, setNotes] = useState("Bring a new can of balls and arrive 10 minutes early.");

  const activeSkill = useMemo(
    () => skillLevels.find((level) => level.value === skillLevel) ?? skillLevels[0],
    [skillLevel],
  );

  const activeVisibility = useMemo(
    () => visibilityOptions.find((option) => option.value === visibility) ?? visibilityOptions[0],
    [visibility],
  );

  const handleNavigateBack = () => {
    navigate(-1);
  };

  const handleContinue = () => {
    navigate("/matches/create/review");
  };

  return (
    <MainLayout>
      <div className="create-match-page">
        <div className="create-match-page__header">
          <div>
            <p className="create-match-page__eyebrow">Create a Match</p>
            <h1 className="create-match-page__title">Match settings</h1>
            <p className="create-match-page__subtitle">
              Fine-tune the competitive level and how players will access your match before you publish.
            </p>
          </div>
          <div className="create-match-page__progress" aria-label="Match creation progress">
            <div className="progress-step progress-step--complete">
              <span className="progress-step__number">1</span>
              <span className="progress-step__label">Match details</span>
            </div>
            <div className="progress-connector" aria-hidden="true" />
            <div className="progress-step progress-step--active">
              <span className="progress-step__number">2</span>
              <span className="progress-step__label">Match settings</span>
            </div>
            <div className="progress-connector" aria-hidden="true" />
            <div className="progress-step progress-step--upcoming">
              <span className="progress-step__number">3</span>
              <span className="progress-step__label">Review &amp; publish</span>
            </div>
          </div>
        </div>

        <section className="create-match-card" aria-labelledby="skill-level-heading">
          <div className="create-match-card__header">
            <div>
              <h2 id="skill-level-heading">Skill level</h2>
              <p className="create-match-card__subtitle">Select the NTRP range you want for this match.</p>
            </div>
            <div className="settings-highlight">
              <Gauge size={18} aria-hidden="true" />
              <span>{activeSkill?.label} target</span>
            </div>
          </div>
          <div className="create-match-field">
            <span className="create-match-field__label">Quick picks</span>
            <div className="pill-group" role="radiogroup" aria-label="Skill level">
              {skillLevels.map((level) => (
                <button
                  key={level.value}
                  type="button"
                  className={`pill pill--outline${skillLevel === level.value ? " pill--active" : ""}`}
                  onClick={() => setSkillLevel(level.value)}
                  aria-pressed={skillLevel === level.value}
                >
                  {level.label}
                </button>
              ))}
            </div>
            <p className="skill-description">{activeSkill?.description}</p>
          </div>
        </section>

        <section className="create-match-card" aria-labelledby="format-heading">
          <h2 id="format-heading">Match format</h2>
          <p className="create-match-card__subtitle">Let players know what style of play to expect.</p>
          <div className="match-format-options" role="radiogroup" aria-label="Match format">
            {formatOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`match-type-card${format === option.value ? " match-type-card--active" : ""}`}
                onClick={() => setFormat(option.value)}
                aria-pressed={format === option.value}
              >
                <div className="match-type-card__icon" aria-hidden="true">
                  {option.icon}
                </div>
                <div className="match-type-card__content">
                  <span className="match-type-card__title">{option.title}</span>
                  <span className="match-type-card__description">{option.description}</span>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="create-match-card" aria-labelledby="details-heading">
          <div className="create-match-card__header">
            <div>
              <h2 id="details-heading">Court &amp; notes</h2>
              <p className="create-match-card__subtitle">Share on-site details to help everyone arrive prepared.</p>
            </div>
          </div>
          <div className="create-match-settings-grid">
            <div className="input-field">
              <label className="input-field__label" htmlFor="court-number">
                Court number <span aria-hidden="true">(optional)</span>
              </label>
              <div className="input-wrapper">
                <Hash size={18} aria-hidden="true" />
                <input
                  id="court-number"
                  type="text"
                  placeholder="e.g. Court 5A"
                  value={courtNumber}
                  onChange={(event) => setCourtNumber(event.target.value)}
                />
              </div>
              <p className="input-field__hint">Visible only to players you approve.</p>
            </div>
            <div className="input-field">
              <label className="input-field__label" htmlFor="match-notes">
                Additional notes
              </label>
              <div className="textarea-wrapper">
                <textarea
                  id="match-notes"
                  placeholder="Parking is on Rose Ave. Bring your favorite warm-up playlist."
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                />
              </div>
              <p className="input-field__hint">Set expectations about gear, balls, or timing.</p>
            </div>
          </div>
        </section>

        <section className="create-match-card" aria-labelledby="visibility-heading">
          <div className="create-match-card__header">
            <div>
              <h2 id="visibility-heading">Share settings</h2>
              <p className="create-match-card__subtitle">Control who can view and request to join this match.</p>
            </div>
            <div className="settings-highlight">
              {activeVisibility.icon}
              <span>{activeVisibility.title}</span>
            </div>
          </div>
          <div className="visibility-options" role="radiogroup" aria-label="Match visibility">
            {visibilityOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`match-type-card${visibility === option.value ? " match-type-card--active" : ""}`}
                onClick={() => setVisibility(option.value)}
                aria-pressed={visibility === option.value}
              >
                <div className="match-type-card__icon" aria-hidden="true">
                  {option.icon}
                </div>
                <div className="match-type-card__content">
                  <span className="match-type-card__title">{option.title}</span>
                  <span className="match-type-card__description">{option.description}</span>
                </div>
              </button>
            ))}
          </div>
        </section>

        <div className="create-match-actions">
          <button type="button" className="create-match-actions__secondary" onClick={handleNavigateBack}>
            Back
          </button>
          <button type="button" className="create-match-actions__primary" onClick={handleContinue}>
            Continue to review
          </button>
        </div>
      </div>
    </MainLayout>
  );
};

export default CreateMatchSettingsPage;
