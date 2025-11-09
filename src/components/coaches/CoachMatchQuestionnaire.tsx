import { Check, Loader2, Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import "./coaches.css";

type QuestionnaireOption = {
  value: string;
  label: string;
  description?: string;
  icon?: string;
};

type QuestionnaireStep = {
  id: string;
  prompt: string;
  summaryLabel: string;
  helperText?: string;
  multiSelect?: boolean;
  options: QuestionnaireOption[];
};

export type QuestionnaireAnswers = Record<string, string[]>;

type CoachMatchQuestionnaireProps = {
  onComplete?: (answers: QuestionnaireAnswers) => void;
};

const steps: QuestionnaireStep[] = [
  {
    id: "playingLevel",
    prompt: "What's your current playing level?",
    summaryLabel: "Playing level",
    options: [
      { value: "2_5_beginner", label: "2.5 – Beginner", description: "Learning basic strokes" },
      {
        value: "3_0_advanced_beginner",
        label: "3.0 – Advanced Beginner",
        description: "Can sustain short rallies",
      },
      { value: "3_5_intermediate", label: "3.5 – Intermediate", description: "Consistent on medium pace" },
      { value: "4_0_advanced", label: "4.0 – Advanced", description: "Dependable strokes" },
      { value: "4_5_expert", label: "4.5+ – Expert", description: "Tournament level" },
    ],
  },
  {
    id: "primaryGoals",
    prompt: "What are your main goals?",
    summaryLabel: "Primary goals",
    helperText: "Select all that apply",
    multiSelect: true,
    options: [
      { value: "improve_technique", label: "Improve Technique", icon: "🎯" },
      { value: "win_more_matches", label: "Win More Matches", icon: "🏆" },
      { value: "get_fit", label: "Get Fit", icon: "💪" },
      { value: "social_play", label: "Social Play", icon: "🤝" },
      { value: "tournament_prep", label: "Tournament Prep", icon: "⚡" },
      { value: "master_fundamentals", label: "Master Fundamentals", icon: "📚" },
    ],
  },
  {
    id: "lessonBudget",
    prompt: "What's your budget per lesson?",
    summaryLabel: "Budget",
    options: [
      { value: "under_60", label: "Under $60", description: "Budget-friendly" },
      { value: "60_80", label: "$60 – $80", description: "Mid-range" },
      { value: "80_100", label: "$80 – $100", description: "Premium" },
      { value: "100_plus", label: "$100+", description: "Elite coaching" },
    ],
  },
  {
    id: "trainingTimes",
    prompt: "When can you train?",
    summaryLabel: "Training times",
    helperText: "Select all that apply",
    multiSelect: true,
    options: [
      { value: "early_morning", label: "Early Morning", description: "6 – 9 AM" },
      { value: "morning", label: "Morning", description: "9 – 12 PM" },
      { value: "afternoon", label: "Afternoon", description: "12 – 5 PM" },
      { value: "evening", label: "Evening", description: "5 – 9 PM" },
      { value: "weekends", label: "Weekends", description: "Sat / Sun" },
    ],
  },
  {
    id: "coachingStyle",
    prompt: "What coaching style do you prefer?",
    summaryLabel: "Coaching style",
    options: [
      { value: "data_analytics", label: "Data & Analytics", description: "Video analysis, metrics" },
      { value: "motivational", label: "Motivational", description: "High energy, encouraging" },
      { value: "technical", label: "Technical", description: "Form and mechanics focus" },
      { value: "strategic", label: "Strategic", description: "Game planning, tactics" },
    ],
  },
  {
    id: "lessonFormat",
    prompt: "Preferred lesson format?",
    summaryLabel: "Lesson format",
    options: [
      { value: "private", label: "Private (1-on-1)", description: "Individual attention" },
      { value: "semi_private", label: "Semi-Private (2-3)", description: "Share with friends" },
      { value: "group", label: "Group Classes", description: "Social learning" },
      { value: "flexible", label: "Flexible", description: "Mix of formats" },
    ],
  },
];

const getInitialAnswers = (): QuestionnaireAnswers =>
  steps.reduce((acc, step) => {
    acc[step.id] = [];
    return acc;
  }, {} as QuestionnaireAnswers);

const CoachMatchQuestionnaire = ({ onComplete }: CoachMatchQuestionnaireProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [answers, setAnswers] = useState<QuestionnaireAnswers>(() => getInitialAnswers());
  const [isComplete, setIsComplete] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const analysisTimer = useRef<number>();
  const answersRef = useRef(answers);

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  useEffect(() => {
    return () => {
      if (analysisTimer.current) {
        window.clearTimeout(analysisTimer.current);
      }
    };
  }, []);

  const currentStep = steps[currentStepIndex];
  const isLastStep = currentStepIndex === steps.length - 1;
  const progress = Math.round(((currentStepIndex + 1) / steps.length) * 100);

  const optionLookup = useMemo(() => {
    const map = new Map<string, QuestionnaireOption>();
    steps.forEach((step) => {
      step.options.forEach((option) => {
        map.set(option.value, option);
      });
    });
    return map;
  }, []);

  const handleOptionSelect = (value: string) => {
    setAnswers((prev) => {
      const step = steps[currentStepIndex];
      const currentValues = prev[step.id] ?? [];
      let nextValues: string[];

      if (step.multiSelect) {
        if (currentValues.includes(value)) {
          nextValues = currentValues.filter((item) => item !== value);
        } else {
          nextValues = [...currentValues, value];
        }
      } else {
        nextValues = currentValues[0] === value ? [] : [value];
      }

      return {
        ...prev,
        [step.id]: nextValues,
      };
    });
  };

  const goToPreviousStep = () => {
    if (currentStepIndex === 0) {
      return;
    }
    setCurrentStepIndex((index) => Math.max(0, index - 1));
  };

  const goToNextStep = () => {
    if (isLastStep) {
      setIsAnalyzing(true);
      analysisTimer.current = window.setTimeout(() => {
        setIsAnalyzing(false);
        setIsComplete(true);
        onComplete?.(answersRef.current);
      }, 1400);
      return;
    }
    setCurrentStepIndex((index) => Math.min(steps.length - 1, index + 1));
  };

  const resetQuestionnaire = () => {
    if (analysisTimer.current) {
      window.clearTimeout(analysisTimer.current);
    }
    setIsAnalyzing(false);
    setIsComplete(false);
    setCurrentStepIndex(0);
  };

  const startOver = () => {
    if (analysisTimer.current) {
      window.clearTimeout(analysisTimer.current);
    }
    setAnswers(getInitialAnswers());
    setCurrentStepIndex(0);
    setIsComplete(false);
    setIsAnalyzing(false);
  };

  const canAdvance = currentStep ? answers[currentStep.id]?.length > 0 : false;

  const closeModal = () => {
    if (isAnalyzing) {
      return;
    }
    if (analysisTimer.current) {
      window.clearTimeout(analysisTimer.current);
    }
    setIsAnalyzing(false);
    setIsOpen(false);
  };

  const openModal = () => {
    setIsOpen(true);
  };

  const renderSummary = () => (
    <div className="coach-questionnaire__modal-content" aria-live="polite">
      <div className="coach-questionnaire__progress" role="status" aria-live="polite">
        <div className="coach-questionnaire__progress-meta">
          <span>Preferences saved</span>
          <span>100% complete</span>
        </div>
        <div className="coach-questionnaire__progress-track">
          <div className="coach-questionnaire__progress-bar" style={{ width: "100%" }} />
        </div>
      </div>
      <div className="coach-questionnaire__card coach-questionnaire__card--complete">
        <div className="coach-questionnaire__intro coach-questionnaire__intro--ai">
          <div className="coach-questionnaire__badge" aria-hidden="true">
            <Sparkles size={20} />
          </div>
          <div>
            <h2 id="coach-questionnaire-title" className="coach-questionnaire__title">
              Your AI coach scout has a plan
            </h2>
            <p className="coach-questionnaire__subtitle">
              We’ll use these insights to fine-tune recommendations and power your upcoming AI
              assistant.
            </p>
          </div>
        </div>

        <dl className="coach-questionnaire__summary">
          {steps.map((step) => {
            const selections = answers[step.id];
            if (!selections || selections.length === 0) {
              return null;
            }
            return (
              <div key={step.id} className="coach-questionnaire__summary-item">
                <dt>{step.summaryLabel}</dt>
                <dd>
                  {selections
                    .map((selection) => optionLookup.get(selection)?.label ?? selection)
                    .join(", ")}
                </dd>
              </div>
            );
          })}
        </dl>

        <div className="coach-questionnaire__actions">
          <button
            type="button"
            className="fc-button fc-button--secondary"
            onClick={resetQuestionnaire}
          >
            Update responses
          </button>
          <button type="button" className="fc-button fc-button--tertiary" onClick={startOver}>
            Clear all
          </button>
          <button type="button" className="fc-button fc-button--primary" onClick={closeModal}>
            View matches
          </button>
        </div>
      </div>
    </div>
  );

  const renderQuestionStep = () => (
    <div className="coach-questionnaire__modal-content">
      <div className="coach-questionnaire__progress" role="status" aria-live="polite">
        <div className="coach-questionnaire__progress-meta">
          <span>
            Question {currentStepIndex + 1} of {steps.length}
          </span>
          <span>{progress}% complete</span>
        </div>
        <div className="coach-questionnaire__progress-track" aria-hidden="true">
          <div className="coach-questionnaire__progress-bar" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="coach-questionnaire__card">
        <div className="coach-questionnaire__intro coach-questionnaire__intro--ai">
          <div className="coach-questionnaire__badge" aria-hidden="true">
            <Sparkles size={20} />
          </div>
          <div>
            <h2 id="coach-questionnaire-title" className="coach-questionnaire__title">
              AI Match Assistant
            </h2>
            <p className="coach-questionnaire__subtitle">{currentStep.prompt}</p>
          </div>
        </div>

        {currentStep.helperText ? (
          <p className="coach-questionnaire__helper">{currentStep.helperText}</p>
        ) : null}

        <div className="coach-questionnaire__options">
          {currentStep.options.map((option) => {
            const selected = answers[currentStep.id]?.includes(option.value);
            return (
              <button
                key={option.value}
                type="button"
                className={`coach-questionnaire__option${
                  selected ? " coach-questionnaire__option--selected" : ""
                }`}
                onClick={() => handleOptionSelect(option.value)}
                aria-pressed={selected}
              >
                <div className="coach-questionnaire__option-content">
                  <div className="coach-questionnaire__option-header">
                    {option.icon ? (
                      <span className="coach-questionnaire__option-icon" aria-hidden="true">
                        {option.icon}
                      </span>
                    ) : null}
                    <span className="coach-questionnaire__option-label">{option.label}</span>
                  </div>
                  {option.description ? (
                    <span className="coach-questionnaire__option-description">{option.description}</span>
                  ) : null}
                </div>
                <span className="coach-questionnaire__option-check" aria-hidden="true">
                  <Check size={18} />
                </span>
              </button>
            );
          })}
        </div>

        <div className="coach-questionnaire__actions">
          <button
            type="button"
            className="fc-button fc-button--secondary"
            onClick={goToPreviousStep}
            disabled={currentStepIndex === 0}
          >
            Back
          </button>
          <button
            type="button"
            className="fc-button fc-button--primary"
            onClick={goToNextStep}
            disabled={!canAdvance}
          >
            {isLastStep ? "Analyze Matches" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );

  const renderAnalysis = () => (
    <div className="coach-questionnaire__modal-content coach-questionnaire__modal-content--analysis">
      <div className="coach-questionnaire__card coach-questionnaire__card--analysis" role="status">
        <div className="coach-questionnaire__intro coach-questionnaire__intro--ai">
          <div className="coach-questionnaire__badge" aria-hidden="true">
            <Sparkles size={20} />
          </div>
          <div>
            <h2 id="coach-questionnaire-title" className="coach-questionnaire__title">
              Calibrating your coach match
            </h2>
            <p className="coach-questionnaire__subtitle">
              Our assistant is crunching the numbers and mapping the best-fit coaches for you.
            </p>
          </div>
        </div>

        <div className="coach-questionnaire__analysis-panel">
          <div className="coach-questionnaire__analysis-orb" aria-hidden="true">
            <div className="coach-questionnaire__analysis-orb-inner" />
          </div>
          <div className="coach-questionnaire__analysis-copy">
            <p>Reading player profile…</p>
            <p>Scanning local availability…</p>
            <p>Preparing tailored recommendations…</p>
          </div>
        </div>

        <div className="coach-questionnaire__analysis-footer">
          <Loader2 className="coach-questionnaire__analysis-spinner" aria-hidden="true" />
          <span>Generating matches</span>
        </div>
      </div>
    </div>
  );

  return (
    <section className="coach-questionnaire" aria-label="Coach match questionnaire launcher">
      <div className="coach-questionnaire__launch">
        <div className="coach-questionnaire__launch-copy">
          <span className="coach-questionnaire__launch-badge">AI assist</span>
          <h2 className="coach-questionnaire__launch-title">Get smarter coach matches</h2>
          <p className="coach-questionnaire__launch-subtitle">
            Answer a few quick prompts and let our AI agent fine-tune recommendations before you
            browse.
          </p>
        </div>
        <button type="button" className="fc-button fc-button--primary" onClick={openModal}>
          Launch match assistant
        </button>
      </div>

      {isOpen ? (
        <>
          <div
            className="coach-questionnaire__overlay"
            onClick={isAnalyzing ? undefined : closeModal}
            aria-hidden="true"
          />
          <div
            className="coach-questionnaire__modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="coach-questionnaire-title"
          >
            <button
              type="button"
              className="coach-questionnaire__close"
              onClick={closeModal}
              aria-label="Close questionnaire"
              disabled={isAnalyzing}
            >
              <X size={20} />
            </button>
            {isAnalyzing ? renderAnalysis() : isComplete ? renderSummary() : renderQuestionStep()}
          </div>
        </>
      ) : null}
    </section>
  );
};

export default CoachMatchQuestionnaire;
