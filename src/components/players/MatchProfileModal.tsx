import { useCallback, useEffect, useId, useMemo, useState, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, CalendarClock, CheckCircle2, Loader2, MapPin, Target, Trophy, UploadCloud, X } from "lucide-react";

import {
  getAllSurveyQuestionAnswered,
  submitSurveyAnswers,
} from "../../api/playerHome";
import AddressPicker from "../questionnaire/AddressPicker";
import TennisCourtPicker from "../questionnaire/TennisCourtPicker";
import { useAuth } from "../../context/AuthContext";
import { getStoredAuthToken } from "../../services/authToken";
import {
  extractSurveyQuestions,
  formatSurveyAnswer,
  type NormalizedSurveyOption,
  type NormalizedSurveyQuestion,
} from "../../utils/surveyQuestionnaire";

import "./MatchProfileModal.css";

export type MatchProfileDetails = {
  about: string;
  /** null when the player has not answered the level question. Never default this. */
  level: string | null;
  playStyles: string[];
  gender: string;
  localCourts: string;
  availability: string[];
};

type MatchProfileModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (profile: MatchProfileDetails) => void;
  initialProfile?: MatchProfileDetails | null;
  /** First name of the player the viewer tapped Connect on, when that is what opened the form. */
  connectingTo?: string | null;
};

type AuthUser = {
  session?: { access_token?: string | null } | null;
  access_token?: string | null;
  token?: string | null;
};

type SurveyAnswer = {
  questionId?: string | number;
  value?: unknown;
  questionType?: string;
  questionText?: string;
  additionalText?: unknown;
  answerMetadata?: Record<string, unknown>;
};

type SurveySubmissionAnswer = {
  questionId: string | number;
  value: unknown;
  questionType: string;
  questionText: string;
  additionalText?: unknown;
};

type UpdateSurveyAnswer = (
  question: NormalizedSurveyQuestion,
  patch: Omit<SurveyAnswer, "questionId">,
) => void;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object";

const toText = (value: unknown) => {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
};

const normalizeQuestionForSurvey = (question: NormalizedSurveyQuestion): NormalizedSurveyQuestion & { questionSubtext: string } => ({
  ...question,
  questionSubtext: question.subText,
});

const getQuestionKey = (question: NormalizedSurveyQuestion) => question.questionId ?? question.id;
const getAnswerKey = (question: NormalizedSurveyQuestion) => String(getQuestionKey(question));

const mergeAnsweredQuestions = (
  questions: NormalizedSurveyQuestion[],
  answeredQuestions: NormalizedSurveyQuestion[],
) => {
  if (questions.length === 0) {
    return answeredQuestions.map(normalizeQuestionForSurvey);
  }

  const answeredById = new Map(
    answeredQuestions.map((question) => [String(getQuestionKey(question)), question]),
  );

  return questions.map((question) => {
    const answered = answeredById.get(String(getQuestionKey(question)));
    return normalizeQuestionForSurvey(answered ? { ...question, ...answered } : question);
  });
};

const serializeAnswerValue = (value: unknown): unknown => {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof File !== "undefined" && value instanceof File) {
    return {
      name: value.name,
      size: value.size,
      type: value.type,
      lastModified: value.lastModified,
    };
  }

  if (Array.isArray(value)) {
    return value.map(serializeAnswerValue);
  }

  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, serializeAnswerValue(entry)]),
    );
  }

  return value;
};

const buildInitialAnswers = (questions: NormalizedSurveyQuestion[]): Record<string, SurveyAnswer> =>
  Object.fromEntries(
    questions.flatMap((question) => {
      const metadata = isRecord(question.answerMetadata) ? question.answerMetadata : null;
      const metadataValue = metadata?.value;
      const hasMetadataValue = metadataValue !== undefined && metadataValue !== null;
      const hasAnswerText =
        question.answerText !== undefined && question.answerText !== null && question.answerText !== "";
      const hasDefaultValue = question.defaultValue !== undefined;
      const value = hasMetadataValue
        ? metadataValue
        : hasAnswerText
          ? question.answerText
          : hasDefaultValue
            ? question.defaultValue
            : undefined;

      if (value === undefined) {
        return [];
      }

      return [
        [
          getAnswerKey(question),
          {
            questionId: getQuestionKey(question),
            value,
            additionalText: metadata?.additionalText,
            answerMetadata: metadata ?? undefined,
          },
        ],
      ];
    }),
  );

const buildSubmissionAnswers = (
  answers: SurveyAnswer[],
  questions: NormalizedSurveyQuestion[],
): SurveySubmissionAnswer[] =>
  answers
    .map((answer) => {
      const question = questions.find(
        (item) => String(getQuestionKey(item)) === String(answer.questionId ?? ""),
      );
      // Nothing answered (a deselected option, a cleared number) is left out rather than
      // sent as null or "". The API saves answers one by one with no transaction, and a
      // null option or an empty number threw partway through, so the questions after it
      // were never saved and the profile kept coming back incomplete.
      if (!question || question.questionType === "Info" || !hasAnswerValue(answer.value)) {
        return null;
      }

      const additionalText =
        answer.additionalText ??
        (isRecord(answer.answerMetadata) ? answer.answerMetadata.additionalText : undefined);

      return {
        questionId: getQuestionKey(question),
        value: serializeAnswerValue(answer.value),
        questionType: question.questionType,
        questionText: question.questionText,
        ...(additionalText !== undefined && additionalText !== null ? { additionalText } : {}),
      };
    })
    .filter((answer): answer is SurveySubmissionAnswer => Boolean(answer));

const valueToLabel = (value: unknown): string => {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(valueToLabel).filter(Boolean).join(", ");
  if (isRecord(value)) {
    return toText(value.optionText ?? value.label ?? value.name ?? value.formattedAddress ?? value.address ?? value.value).trim();
  }
  return "";
};

const valueToList = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.map(valueToLabel).filter(Boolean);
  }
  const label = valueToLabel(value);
  return label ? [label] : [];
};

const hasAnswerValue = (value: unknown) => {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
};

const getNumberSetting = (question: NormalizedSurveyQuestion, key: string) => {
  const rawValue = question.questionSettings?.[key];
  if (typeof rawValue === "number" && Number.isFinite(rawValue)) return rawValue;
  if (typeof rawValue === "string" && rawValue.trim()) {
    const parsed = Number(rawValue);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const isOtherOption = (option: unknown) => {
  if (!isRecord(option)) return false;
  return String(option.value ?? "").trim().toLowerCase() === "other";
};

const isSameOption = (left: unknown, right: unknown) => {
  if (isRecord(left) && isRecord(right)) {
    return String(left.value) === String(right.value);
  }
  return left === right;
};

const getQuestionValidationError = (question: NormalizedSurveyQuestion, answer?: SurveyAnswer) => {
  if (question.questionType === "Info") return null;

  const value = answer?.value;

  if (question.questionType === "MultipleSelectionGroup") {
    const values = Array.isArray(value) ? value : [];
    const minMultiSelect = getNumberSetting(question, "minMultiSelect") ?? (question.answerRequired ? 1 : 0);
    if (values.length < minMultiSelect) {
      return minMultiSelect > 1 ? `Select at least ${minMultiSelect} options.` : "Select an option.";
    }
    return null;
  }

  if (question.answerRequired && !hasAnswerValue(value)) {
    return "This question is required.";
  }

  if (question.questionType === "ConditionalSelectionWithText" && isOtherOption(value)) {
    const additionalText = typeof answer?.additionalText === "string" ? answer.additionalText.trim() : "";
    if (!additionalText) return "Please specify your answer.";
  }

  return null;
};

const buildMatchProfileDetails = (
  answers: SurveySubmissionAnswer[],
  fallback?: MatchProfileDetails | null,
): MatchProfileDetails => {
  const profile: MatchProfileDetails = {
    about: fallback?.about ?? "",
    level: fallback?.level ?? null,
    playStyles: fallback?.playStyles ?? [],
    gender: fallback?.gender ?? "",
    localCourts: fallback?.localCourts ?? "",
    availability: fallback?.availability ?? [],
  };

  answers.forEach((answer) => {
    const label = answer.questionText.toLowerCase();
    if (label.includes("about") || label.includes("background") || label.includes("bio")) {
      profile.about = valueToLabel(answer.value);
    } else if (label.includes("ntrp") || label.includes("level")) {
      profile.level = valueToLabel(answer.value) || profile.level;
    } else if (label.includes("gender")) {
      profile.gender = valueToLabel(answer.value);
    } else if (label.includes("court") || label.includes("location")) {
      profile.localCourts = valueToLabel(answer.value);
    } else if (label.includes("avail")) {
      profile.availability = valueToList(answer.value);
    } else if (label.includes("style") || label.includes("play type") || label.includes("looking")) {
      profile.playStyles = valueToList(answer.value);
    }
  });

  return profile;
};

const SurveyAddressField = ({
  question,
  value,
  onChange,
}: {
  question: NormalizedSurveyQuestion;
  value: unknown;
  onChange: UpdateSurveyAnswer;
}) => {
  const handleSelect = useCallback(
    (selectedAddress: unknown) => onChange(question, { value: selectedAddress }),
    [onChange, question],
  );

  return <AddressPicker onSelect={handleSelect} initialAddress={isRecord(value) ? value : null} />;
};

const SurveyMultiAddressField = ({
  question,
  value,
  onChange,
}: {
  question: NormalizedSurveyQuestion;
  value: unknown;
  onChange: UpdateSurveyAnswer;
}) => {
  const handleSelect = useCallback(
    (selectedCourts: unknown) => onChange(question, { value: selectedCourts }),
    [onChange, question],
  );

  return (
    <TennisCourtPicker
      onSelect={handleSelect}
      initialSelectedCourts={Array.isArray(value) ? value : []}
    />
  );
};

const MatchProfileModal = ({ isOpen, onClose, onComplete, initialProfile, connectingTo }: MatchProfileModalProps) => {
  const titleId = useId();
  const descriptionId = useId();
  const { user } = useAuth() as { user?: AuthUser | null };

  const playerToken = useMemo(() => {
    const storedToken = getStoredAuthToken({ defaultScheme: "token", preferScheme: "token" });
    return user?.session?.access_token ?? user?.access_token ?? user?.token ?? storedToken ?? null;
  }, [user]);

  const [questions, setQuestions] = useState<NormalizedSurveyQuestion[]>([]);
  const [answersByQuestionId, setAnswersByQuestionId] = useState<Record<string, SurveyAnswer>>({});
  const [pendingAnswers, setPendingAnswers] = useState<SurveySubmissionAnswer[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  // -1 is the intro ("why we ask"), then one question per step, then the review.
  const [step, setStep] = useState(-1);

  const loadSurvey = useCallback(async () => {
    if (!playerToken) {
      setQuestions([]);
      setError("Please sign in to edit your match profile.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setReviewOpen(false);
    setStep(-1);
    setPendingAnswers([]);
    setAnswersByQuestionId({});

    try {
      const scopedQuestions = await getAllSurveyQuestionAnswered({ token: playerToken });
      const mergedQuestions = mergeAnsweredQuestions([], extractSurveyQuestions(scopedQuestions));
      setQuestions(mergedQuestions);
      setAnswersByQuestionId(buildInitialAnswers(mergedQuestions));
    } catch (requestError) {
      setQuestions([]);
      setError(
        requestError instanceof Error
          ? requestError.message
          : "We couldn't load the match profile questions right now.",
      );
    } finally {
      setLoading(false);
    }
  }, [playerToken]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      void loadSurvey();
    }
  }, [isOpen, loadSurvey]);

  const handleOverlayClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  const answerList = useMemo(() => Object.values(answersByQuestionId), [answersByQuestionId]);
  const contentQuestions = useMemo(
    () => questions.filter((question) => question.questionType !== "Info"),
    [questions],
  );
  const validationErrors = useMemo(
    () =>
      Object.fromEntries(
        questions.flatMap((question) => {
          const error = getQuestionValidationError(question, answersByQuestionId[getAnswerKey(question)]);
          return error ? [[getAnswerKey(question), error]] : [];
        }),
      ),
    [answersByQuestionId, questions],
  );
  const hasValidationErrors = Object.keys(validationErrors).length > 0;

  const updateAnswer = useCallback<UpdateSurveyAnswer>((question, patch) => {
    setAnswersByQuestionId((current) => ({
      ...current,
      [getAnswerKey(question)]: {
        ...current[getAnswerKey(question)],
        questionId: getQuestionKey(question),
        ...patch,
      },
    }));
  }, []);

  const handleReviewAnswers = () => {
    if (hasValidationErrors) {
      setError("Please complete the required questions before reviewing.");
      return;
    }
    setError(null);
    setPendingAnswers(buildSubmissionAnswers(answerList, questions));
    setReviewOpen(true);
  };

  const currentQuestion = step >= 0 ? contentQuestions[step] ?? null : null;
  const currentError = currentQuestion ? validationErrors[getAnswerKey(currentQuestion)] : undefined;
  const currentAnswered = currentQuestion
    ? hasAnswerValue(answersByQuestionId[getAnswerKey(currentQuestion)]?.value)
    : false;

  const goNext = () => {
    if (step >= contentQuestions.length - 1) {
      handleReviewAnswers();
      return;
    }
    setError(null);
    setStep((current) => current + 1);
  };

  const goBack = () => {
    setError(null);
    if (reviewOpen) {
      setReviewOpen(false);
      setStep(contentQuestions.length - 1);
      return;
    }
    if (step <= -1) {
      onClose();
      return;
    }
    setStep((current) => current - 1);
  };

  // A single choice moves on by itself, like the rating quiz. "Other" waits for its text.
  const chooseAndAdvance = (question: NormalizedSurveyQuestion, option: NormalizedSurveyOption) => {
    updateAnswer(question, { value: option });
    if (isOtherOption(option)) return;
    window.setTimeout(() => {
      setStep((current) => (contentQuestions[current] === question ? current + 1 : current));
    }, 180);
  };

  const handleSubmit = async () => {
    if (!playerToken || pendingAnswers.length === 0) {
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await submitSurveyAnswers({
        token: playerToken,
        surveyAnswers: pendingAnswers,
      });
      onComplete(buildMatchProfileDetails(pendingAnswers, initialProfile));
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "We couldn't save your match profile right now.",
      );
    } finally {
      setSaving(false);
    }
  };

  const renderImageUpload = useCallback(
    (
      onChange: (value: unknown) => void,
      value: unknown,
      placeholderText?: string,
    ) => {
      const imageValue = isRecord(value) ? value : null;
      const imageUrl = toText(imageValue?.url ?? value);
      const imageName = toText(imageValue?.name);

      return (
        <div className="match-profile-upload">
          <label className="match-profile-upload__button">
            <UploadCloud size={18} strokeWidth={2} />
            <span>{imageName || placeholderText || "Select an image"}</span>
            <input
              type="file"
              accept="image/*"
              className="match-profile-upload__input"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;

                const reader = new FileReader();
                reader.onload = () => {
                  onChange({
                    name: file.name,
                    size: file.size,
                    type: file.type,
                    url: typeof reader.result === "string" ? reader.result : "",
                  });
                };
                reader.readAsDataURL(file);
              }}
            />
          </label>
          {imageUrl ? <img className="match-profile-image-preview" src={imageUrl} alt="Selected upload preview" /> : null}
        </div>
      );
    },
    [],
  );

  const renderOptionButton = (
    option: NormalizedSurveyOption,
    selected: boolean,
    onClick: () => void,
    multiSelect = false,
  ) => (
    <button
      key={String(option.value)}
      type="button"
      className={`match-profile-survey-option${selected ? " match-profile-survey-option--selected" : ""}${
        multiSelect ? " match-profile-survey-option--multi" : ""
      }`}
      onClick={onClick}
      aria-pressed={selected}
    >
      <span className="match-profile-survey-option__indicator" aria-hidden="true">
        {selected ? "✓" : ""}
      </span>
      <span className="match-profile-survey-option__copy">
        <span className="match-profile-survey-option__label">{option.optionText}</span>
        {option.optionDescription || option.description ? (
          <span className="match-profile-survey-option__description">
            {toText(option.optionDescription ?? option.description)}
          </span>
        ) : null}
      </span>
    </button>
  );

  const renderQuestionInput = (question: NormalizedSurveyQuestion) => {
    const answer = answersByQuestionId[getAnswerKey(question)];
    const value = answer?.value;

    switch (question.questionType) {
      case "Info":
        return null;
      case "TextInput":
        return (
          <input
            className="match-profile-input"
            type="text"
            value={toText(value)}
            placeholder={question.placeholderText || ""}
            onChange={(event) => updateAnswer(question, { value: event.target.value })}
          />
        );
      case "NumericInput":
        return (
          <input
            className="match-profile-input"
            type="number"
            value={typeof value === "number" || typeof value === "string" ? value : ""}
            placeholder={question.placeholderText || ""}
            onChange={(event) =>
              updateAnswer(question, {
                value: event.target.value === "" ? "" : Number(event.target.value),
              })
            }
          />
        );
      case "TextArea":
        return (
          <textarea
            className="match-profile-textarea"
            value={toText(value)}
            placeholder={question.placeholderText || "Enter detailed information here..."}
            rows={4}
            onChange={(event) => updateAnswer(question, { value: event.target.value })}
          />
        );
      case "SelectionGroup":
        return (
          <div className="match-profile-survey-options">
            {question.options.map((option) => {
              const selected = isSameOption(value, option);
              return renderOptionButton(
                option,
                selected,
                () => {
                  const allowDeselect = question.questionSettings?.allowDeselect !== false;
                  if (allowDeselect && selected) {
                    updateAnswer(question, { value: null });
                  } else if (step === contentQuestions.length - 1) {
                    updateAnswer(question, { value: option });
                  } else {
                    chooseAndAdvance(question, option);
                  }
                },
              );
            })}
          </div>
        );
      case "MultipleSelectionGroup": {
        const selectedValues = Array.isArray(value) ? value : [];
        const maxMultiSelect = getNumberSetting(question, "maxMultiSelect");
        return (
          <div className="match-profile-survey-options">
            {question.options.map((option) => {
              const selected = selectedValues.some((entry) => isSameOption(entry, option));
              const disabled = !selected && maxMultiSelect !== null && selectedValues.length >= maxMultiSelect;
              return (
                <button
                  key={String(option.value)}
                  type="button"
                  className={`match-profile-survey-option match-profile-survey-option--multi${
                    selected ? " match-profile-survey-option--selected" : ""
                  }`}
                  onClick={() => {
                    if (disabled) return;
                    updateAnswer(question, {
                      value: selected
                        ? selectedValues.filter((entry) => !isSameOption(entry, option))
                        : [...selectedValues, option],
                    });
                  }}
                  disabled={disabled}
                  aria-pressed={selected}
                >
                  <span className="match-profile-survey-option__indicator" aria-hidden="true">
                    {selected ? "✓" : ""}
                  </span>
                  <span className="match-profile-survey-option__copy">
                    <span className="match-profile-survey-option__label">{option.optionText}</span>
                    {option.optionDescription || option.description ? (
                      <span className="match-profile-survey-option__description">
                        {toText(option.optionDescription ?? option.description)}
                      </span>
                    ) : null}
                  </span>
                </button>
              );
            })}
          </div>
        );
      }
      case "ConditionalSelectionWithText": {
        const additionalText = typeof answer?.additionalText === "string" ? answer.additionalText : "";
        return (
          <>
            <div className="match-profile-survey-options">
              {question.options.map((option) => {
                const selected = isSameOption(value, option);
                return renderOptionButton(option, selected, () => {
                  updateAnswer(question, {
                    value: option,
                    additionalText: isOtherOption(option) ? additionalText : "",
                    answerMetadata: {
                      value: option,
                      additionalText: isOtherOption(option) ? additionalText : "",
                    },
                  });
                });
              })}
            </div>
            {isOtherOption(value) ? (
              <input
                className="match-profile-input"
                type="text"
                value={additionalText}
                placeholder="Please specify"
                onChange={(event) =>
                  updateAnswer(question, {
                    value,
                    additionalText: event.target.value,
                    answerMetadata: {
                      value,
                      additionalText: event.target.value,
                    },
                  })
                }
              />
            ) : null}
          </>
        );
      }
      case "AddressPicker":
        return (
          <SurveyAddressField question={question} value={value} onChange={updateAnswer} />
        );
      case "MultiAddressPicker":
        return (
          <SurveyMultiAddressField question={question} value={value} onChange={updateAnswer} />
        );
      case "DatePicker":
        return (
          <input
            className="match-profile-input"
            type="date"
            value={toText(value).slice(0, 10)}
            onChange={(event) => updateAnswer(question, { value: event.target.value })}
          />
        );
      case "TimePicker":
        return (
          <input
            className="match-profile-input"
            type="time"
            value={toText(value).slice(0, 5)}
            onChange={(event) => updateAnswer(question, { value: event.target.value })}
          />
        );
      case "DateTimePicker":
        return (
          <input
            className="match-profile-input"
            type="datetime-local"
            value={toText(value).slice(0, 16)}
            onChange={(event) => updateAnswer(question, { value: event.target.value })}
          />
        );
      case "ImageUpload":
        return renderImageUpload(
          (nextValue) => updateAnswer(question, { value: nextValue }),
          value,
          question.placeholderText || "Select an image",
        );
      default:
        return (
          <input
            className="match-profile-input"
            type="text"
            value={toText(value)}
            placeholder={question.placeholderText || ""}
            onChange={(event) => updateAnswer(question, { value: event.target.value })}
          />
        );
    }
  };

  if (!isOpen || typeof document === "undefined") {
    return null;
  }

  const isIntro = !reviewOpen && step === -1;
  const total = contentQuestions.length;
  const stepProgress = reviewOpen ? 100 : total > 0 && step >= 0 ? Math.round(((step + 1) / total) * 100) : 0;
  const title = initialProfile && !connectingTo
    ? "Edit your match profile"
    : connectingTo
      ? `Before you connect with ${connectingTo}`
      : "Set up your match profile";

  return createPortal(
    <div
      className="match-profile-form-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onMouseDown={handleOverlayClick}
    >
      <div className="match-profile-form-modal" role="document">
        <span className="match-profile-form-modal__grabber" aria-hidden="true" />
        <header className="match-profile-form-modal__header">
          <div className="match-profile-form-modal__heading">
            <h2 id={titleId}>{title}</h2>
            {!isIntro && total > 0 && !loading ? (
              <div className="match-profile-survey-progress" aria-label="Progress">
                <div className="match-profile-survey-progress__track">
                  <div className="match-profile-survey-progress__bar" style={{ width: `${stepProgress}%` }} />
                </div>
                <span>{reviewOpen ? "Review" : `${step + 1} of ${total}`}</span>
              </div>
            ) : null}
          </div>
          <button type="button" className="match-profile-form-modal__close" onClick={onClose} aria-label="Close profile form">
            <X size={20} strokeWidth={2} />
          </button>
        </header>

        <div className="match-profile-form-modal__form">
          <div className="match-profile-form-modal__body" id={descriptionId}>
            {loading ? (
              <div className="match-profile-survey-state">
                <Loader2 className="match-profile-survey-state__spinner" size={30} aria-hidden="true" />
                <h3>Loading your match profile</h3>
              </div>
            ) : error && !reviewOpen && questions.length === 0 ? (
              <div className="match-profile-survey-state match-profile-survey-state--error">
                <AlertTriangle size={30} aria-hidden="true" />
                <h3>Unable to load match profile</h3>
                <p>{error}</p>
                <button type="button" className="fc-button fc-button--secondary" onClick={loadSurvey}>
                  Try again
                </button>
              </div>
            ) : total === 0 ? (
              <div className="match-profile-survey-state">
                <Target size={30} aria-hidden="true" />
                <h3>No match profile questions yet</h3>
              </div>
            ) : isIntro ? (
              <div className="match-profile-intro">
                <p className="match-profile-intro__lead">
                  {connectingTo
                    ? `Players see a short match profile before they say yes to a game. ${connectingTo} will see yours with your request.`
                    : "Your match profile is how players near you decide whether you'd be a good game."}
                </p>
                <ul className="match-profile-intro__list">
                  <li>
                    <Trophy size={18} aria-hidden="true" />
                    <span><b>Your level</b> so you're matched with players who suit your game</span>
                  </li>
                  <li>
                    <MapPin size={18} aria-hidden="true" />
                    <span><b>Where you play</b> so games are at courts that work for both of you</span>
                  </li>
                  <li>
                    <CalendarClock size={18} aria-hidden="true" />
                    <span><b>When you're free</b> so it's easy to agree on a time</span>
                  </li>
                </ul>
                <p className="match-profile-intro__note">
                  {total} quick questions, one at a time. You only do this once and can change it anytime.
                </p>
              </div>
            ) : reviewOpen ? (
              <div className="match-profile-review">
                <div className="match-profile-review__icon">
                  <CheckCircle2 size={26} aria-hidden="true" />
                </div>
                <h3>Check your answers</h3>
                {pendingAnswers.length > 0 ? (
                  <dl className="match-profile-review__list">
                    {pendingAnswers.map((answer) => (
                      <div key={String(answer.questionId)} className="match-profile-review__item">
                        <dt>{answer.questionText}</dt>
                        <dd>{formatSurveyAnswer({ ...answer, answerMetadata: { value: answer.value, additionalText: answer.additionalText } }) || "Answered"}</dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <p className="match-profile-helper">No answers yet.</p>
                )}
                <p className="match-profile-review__consent">
                  By saving, you agree to share your contact details with other members you connect with and accept the
                  terms of use. You can remove yourself from player matching anytime in settings.
                </p>
                {error ? <p className="match-profile-error" role="alert">{error}</p> : null}
              </div>
            ) : currentQuestion ? (
              <section className="match-profile-survey-question" key={getAnswerKey(currentQuestion)}>
                <div className="match-profile-survey-question__header">
                  <h3>{currentQuestion.questionText}</h3>
                  {currentQuestion.subText ? <p>{currentQuestion.subText}</p> : null}
                  {!currentQuestion.answerRequired ? (
                    <span className="match-profile-survey-question__optional">Optional</span>
                  ) : null}
                </div>
                {currentQuestion.options.length === 0 &&
                (currentQuestion.questionType === "SelectionGroup" ||
                  currentQuestion.questionType === "MultipleSelectionGroup" ||
                  currentQuestion.questionType === "ConditionalSelectionWithText") ? (
                  <p className="match-profile-error">This question has no options to choose from.</p>
                ) : (
                  renderQuestionInput(currentQuestion)
                )}
                {currentQuestion.questionType === "MultipleSelectionGroup" ? (
                  <p className="match-profile-helper">Choose all that apply.</p>
                ) : null}
                {error ? <p className="match-profile-error" role="alert">{error}</p> : null}
              </section>
            ) : null}
          </div>

          {!loading && total > 0 ? (
            <footer className="match-profile-form-modal__footer">
              <div className="match-profile-form-modal__buttons">
                <button
                  type="button"
                  className="fc-button fc-button--secondary"
                  onClick={goBack}
                  disabled={saving}
                >
                  {isIntro ? "Not now" : "Back"}
                </button>
                {isIntro ? (
                  <button type="button" className="fc-button fc-button--primary" onClick={() => setStep(0)}>
                    {connectingTo || !initialProfile ? "Let's go" : "Edit my answers"}
                  </button>
                ) : reviewOpen ? (
                  <button
                    type="button"
                    className="fc-button fc-button--primary"
                    onClick={handleSubmit}
                    disabled={saving || pendingAnswers.length === 0}
                  >
                    {saving ? "Saving..." : "Agree & save"}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="fc-button fc-button--primary"
                    onClick={goNext}
                    disabled={Boolean(currentError)}
                  >
                    {!currentAnswered && !currentError ? "Skip" : step >= total - 1 ? "Review" : "Next"}
                  </button>
                )}
              </div>
            </footer>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default MatchProfileModal;
