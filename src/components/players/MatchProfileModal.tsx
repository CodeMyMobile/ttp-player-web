import { useCallback, useEffect, useId, useMemo, useState, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, CheckCircle2, Loader2, Target, UploadCloud, X } from "lucide-react";

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
  level: string;
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
      if (!question || question.questionType === "Info") {
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
    level: fallback?.level ?? "3.0",
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

const MatchProfileModal = ({ isOpen, onClose, onComplete, initialProfile }: MatchProfileModalProps) => {
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
  const answeredCount = useMemo(
    () =>
      contentQuestions.filter((question) => hasAnswerValue(answersByQuestionId[getAnswerKey(question)]?.value)).length,
    [answersByQuestionId, contentQuestions],
  );
  const progress = contentQuestions.length > 0 ? Math.round((answeredCount / contentQuestions.length) * 100) : 0;
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

  const questionsMissingOptions = useMemo(
    () =>
      questions.filter(
        (question) =>
          (question.questionType === "SelectionGroup" ||
            question.questionType === "MultipleSelectionGroup" ||
            question.questionType === "ConditionalSelectionWithText") &&
          question.options.length === 0,
      ),
    [questions],
  );

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
      await loadSurvey();
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
          <p className="match-profile-upload__note">
            Image upload is stored with the survey answer. Server-side upload can be added here if the API exposes a survey image endpoint.
          </p>
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
                  updateAnswer(question, { value: allowDeselect && selected ? null : option });
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
        <header className="match-profile-form-modal__header">
          <div className="match-profile-form-modal__heading">
            <h2 id={titleId}>{initialProfile ? "Edit player match profile" : "Build your player match profile"}</h2>
            <p id={descriptionId}>
              Answer the player matching questionnaire so nearby players can understand your level, style, courts, and availability.
            </p>
          </div>
          <button type="button" className="match-profile-form-modal__close" onClick={onClose} aria-label="Close profile form">
            <X size={20} strokeWidth={2} />
          </button>
        </header>

        <div className="match-profile-form-modal__form">
          <div className="match-profile-form-modal__body">
            {questions.length > 0 && !reviewOpen ? (
              <div className="match-profile-survey-progress" aria-label="Survey progress">
                <div>
                  <span>{answeredCount} of {contentQuestions.length} answered</span>
                  <strong>{progress}% complete</strong>
                </div>
                <div className="match-profile-survey-progress__track">
                  <div className="match-profile-survey-progress__bar" style={{ width: `${progress}%` }} />
                </div>
              </div>
            ) : null}

            {questionsMissingOptions.length > 0 && !reviewOpen ? (
              <div className="match-profile-survey-banner match-profile-survey-banner--warning">
                <AlertTriangle size={18} aria-hidden="true" />
                <div>
                  <strong>Some selection questions are missing option data.</strong>
                  <p>{questionsMissingOptions.map((question) => question.questionText).join(", ")}</p>
                </div>
              </div>
            ) : null}

            {loading ? (
              <div className="match-profile-survey-state">
                <Loader2 className="match-profile-survey-state__spinner" size={30} aria-hidden="true" />
                <h3>Loading match profile questions</h3>
              </div>
            ) : error && !reviewOpen ? (
              <div className="match-profile-survey-state match-profile-survey-state--error">
                <AlertTriangle size={30} aria-hidden="true" />
                <h3>Unable to load match profile</h3>
                <p>{error}</p>
                <button type="button" className="fc-button fc-button--secondary" onClick={loadSurvey}>
                  Try again
                </button>
              </div>
            ) : reviewOpen ? (
              <div className="match-profile-review">
                <div className="match-profile-review__icon">
                  <CheckCircle2 size={26} aria-hidden="true" />
                </div>
                <h3>Review before saving</h3>
                <p>
                  Your answers will update your player match profile. By saving, you agree to share your contact details with
                  other Matchplay members and accept the terms of use.
                </p>
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
                  <p className="match-profile-helper">No publishable answers were collected.</p>
                )}
                {error ? <p className="match-profile-error">{error}</p> : null}
              </div>
            ) : questions.length > 0 ? (
              <div className="match-profile-survey-list">
                {error ? <p className="match-profile-error">{error}</p> : null}
                {questions.map((question, index) => {
                  const errorMessage = validationErrors[getAnswerKey(question)];
                  const isInfo = question.questionType === "Info";

                  return (
                    <section
                      key={getAnswerKey(question)}
                      className={`match-profile-survey-question${
                        isInfo ? " match-profile-survey-question--info" : ""
                      }`}
                    >
                      <div className="match-profile-survey-question__header">
                        <span className="match-profile-survey-question__eyebrow">
                          {isInfo ? "Info" : `Question ${index + 1}`}
                        </span>
                        <h3>{question.questionText}</h3>
                        {question.subText ? <p>{question.subText}</p> : null}
                        {question.answerRequired && !isInfo ? (
                          <span className="match-profile-survey-question__required">Required</span>
                        ) : null}
                      </div>
                      {isInfo ? null : renderQuestionInput(question)}
                      {errorMessage ? <p className="match-profile-error">{errorMessage}</p> : null}
                    </section>
                  );
                })}
              </div>
            ) : (
              <div className="match-profile-survey-state">
                <Target size={30} aria-hidden="true" />
                <h3>No match profile questions yet</h3>
                <p>Once the survey API returns questions, they will appear here.</p>
              </div>
            )}
          </div>

          <footer className="match-profile-form-modal__footer">
            <p className="match-profile-form-modal__disclaimer">
              You can update your match profile anytime. Info-only survey screens are not submitted as answers.
            </p>
            <div className="match-profile-form-modal__actions">
              <div className="match-profile-form-modal__buttons">
                {reviewOpen ? (
                  <button
                    type="button"
                    className="fc-button fc-button--secondary"
                    onClick={() => setReviewOpen(false)}
                    disabled={saving}
                  >
                    Back
                  </button>
                ) : (
                  <button type="button" className="fc-button fc-button--secondary" onClick={onClose}>
                    Cancel
                  </button>
                )}
                {reviewOpen ? (
                  <button
                    type="button"
                    className="fc-button fc-button--primary"
                    onClick={handleSubmit}
                    disabled={saving || pendingAnswers.length === 0}
                  >
                    {saving ? "Saving..." : "Agree & Save"}
                  </button>
                ) : null}
                {!reviewOpen && questions.length > 0 && !loading ? (
                  <button
                    type="button"
                    className="fc-button fc-button--primary"
                    onClick={handleReviewAnswers}
                    disabled={hasValidationErrors}
                  >
                    Review answers
                  </button>
                ) : null}
              </div>
            </div>
          </footer>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default MatchProfileModal;
