import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ChevronDown,
  Gauge,
  Hash,
  MessageSquare,
  Sparkles,
  Globe,
  Trophy,
  User,
  Users,
  X,
} from "lucide-react";

import MainLayout from "../components/MainLayout";
import type { MatchDraftDetails } from "../types/matchPlay";

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
    title: "Visible in feed",
    description: "Appear in match search and accept requests.",
  },
  {
    value: "hidden",
    title: "Share by link only",
    description: "Only players you share the link with can view.",
  },
];

const skillRanges = skillLevels.map((level) => {
  const [min, max = min] = level.value.split("-");
  return {
    ...level,
    min,
    max,
  };
});

const ntrpOptions = ["2.0", "2.5", "3.0", "3.5", "4.0", "4.5+"];

const compareNtrp = (left: string, right: string) => {
  const normalize = (value: string) => Number.parseFloat(value.replace("+", ""));
  return normalize(left) - normalize(right);
};

const CreateMatchSettingsPage = () => {
  const navigate = useNavigate();
  const routerLocation = useLocation();
  const { matchDraft } = (routerLocation.state as { matchDraft?: MatchDraftDetails } | null) ?? {};

  const [skillMin, setSkillMin] = useState("3.0");
  const [skillMax, setSkillMax] = useState("3.5");
  const [format, setFormat] = useState(formatOptions[1]?.value ?? "doubles");
  const [visibility, setVisibility] = useState<VisibilityOption["value"]>("public");
  const [courtNumber, setCourtNumber] = useState("");
  const [notes, setNotes] = useState("Bring a new can of balls and arrive 10 minutes early.");

  const activeSkill = useMemo(
    () => (
      skillRanges.find((level) => level.min === skillMin && level.max === skillMax) ?? {
        value: `${skillMin}-${skillMax}`,
        label: `${skillMin} - ${skillMax}`,
        description: `Players rated ${skillMin}-${skillMax} will see this match.`,
        min: skillMin,
        max: skillMax,
      }
    ),
    [skillMax, skillMin],
  );

  const activeVisibility = useMemo(
    () => visibilityOptions.find((option) => option.value === visibility) ?? visibilityOptions[0],
    [visibility],
  );

  const handleNavigateBack = () => {
    navigate(-1);
  };

  const handleContinue = () => {
    navigate("/matches/create/review", {
      state: {
        matchDraft,
        settings: {
          skillLevel: skillMin === skillMax ? skillMin : `${skillMin}-${skillMax}`,
          format,
          visibility,
          courtNumber,
          notes,
        },
      },
    });
  };

  return (
    <MainLayout mobileChrome="immersive" showDesktopNav={false}>
      <div className="create-match-page">
        <div className="create-match-mobile-header">
          <div className="create-match-mobile-header__top">
            <button
              type="button"
              className="create-match-mobile-header__close"
              onClick={handleNavigateBack}
              aria-label="Close match creation"
            >
              <X size={18} />
            </button>
            <div className="create-match-mobile-header__meta">
              <span>Step 2 of 3</span>
            </div>
          </div>
          <div className="create-match-mobile-header__progress" aria-hidden="true">
            <span className="create-match-mobile-header__progress-fill" style={{ width: "66.667%" }} />
          </div>
        </div>
        <div className="create-match-mobile-page-title">
          <h1>Match details</h1>
        </div>
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
              <h2 id="skill-level-heading">Match details</h2>
              <p className="create-match-card__subtitle">Choose the level and format players will see.</p>
            </div>
            <div className="settings-highlight">
              <Gauge size={18} aria-hidden="true" />
              <span>{activeSkill?.label} target</span>
            </div>
          </div>
          <div className="create-match-field">
            <span className="create-match-field__label">NTRP skill range</span>
            <div className="create-match-range-grid">
              <label className="input-field" htmlFor="match-skill-min">
                <span className="input-field__label input-field__label--meta">Min</span>
                <div className="select-wrapper">
                  <select
                    id="match-skill-min"
                    value={skillMin}
                    onChange={(event) => {
                      const nextMin = event.target.value;
                      setSkillMin(nextMin);
                      if (compareNtrp(nextMin, skillMax) > 0) {
                        setSkillMax(nextMin);
                      }
                    }}
                  >
                    {ntrpOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={16} aria-hidden="true" />
                </div>
              </label>
              <label className="input-field" htmlFor="match-skill-max">
                <span className="input-field__label input-field__label--meta">Max</span>
                <div className="select-wrapper">
                  <select
                    id="match-skill-max"
                    value={skillMax}
                    onChange={(event) => {
                      const nextMax = event.target.value;
                      setSkillMax(nextMax);
                      if (compareNtrp(nextMax, skillMin) < 0) {
                        setSkillMin(nextMax);
                      }
                    }}
                  >
                    {ntrpOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={16} aria-hidden="true" />
                </div>
              </label>
            </div>
            <span className="create-match-field__label">Quick pick</span>
            <div className="pill-group" role="radiogroup" aria-label="Skill level">
              {skillRanges.map((level) => (
                <button
                  key={level.value}
                  type="button"
                  className={`pill pill--outline${skillMin === level.min && skillMax === level.max ? " pill--active" : ""}`}
                  onClick={() => {
                    setSkillMin(level.min);
                    setSkillMax(level.max);
                  }}
                  aria-pressed={skillMin === level.min && skillMax === level.max}
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
              <h2 id="visibility-heading">Visibility</h2>
              <p className="create-match-card__subtitle">Control who can view and request to join this match.</p>
            </div>
            <div className="settings-highlight">
              <span>{activeVisibility.title}</span>
            </div>
          </div>
          <div className="visibility-toggle-card">
            <div className="visibility-toggle-card__icon" aria-hidden="true">
              <Globe size={18} />
            </div>
            <div className="visibility-toggle-card__copy">
              <span className="visibility-toggle-card__title">Share by link only</span>
              <span className="visibility-toggle-card__description">
                {visibility === "hidden" ? "Only people with the link can view this match." : "Visible in feed"}
              </span>
            </div>
            <button
              type="button"
              className={`visibility-toggle${visibility === "hidden" ? " visibility-toggle--active" : ""}`}
              onClick={() => setVisibility((value) => (value === "hidden" ? "public" : "hidden"))}
              aria-pressed={visibility === "hidden"}
              aria-label="Toggle share by link only"
            >
              <span className="visibility-toggle__thumb" />
            </button>
          </div>
        </section>

        <div className="create-match-actions">
          <button type="button" className="create-match-actions__secondary" onClick={handleNavigateBack}>
            Back
          </button>
          <button type="button" className="create-match-actions__primary" onClick={handleContinue}>
            Next
            <span aria-hidden="true">→</span>
          </button>
        </div>
      </div>
    </MainLayout>
  );
};

export default CreateMatchSettingsPage;
