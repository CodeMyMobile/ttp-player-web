import type { SurveyQuestion, SurveyQuestionOption } from "../api/playerHome";

export type NormalizedSurveyOption = SurveyQuestionOption & {
  optionText: string;
  value: unknown;
};

export type NormalizedSurveyQuestion = SurveyQuestion & {
  questionId: string | number;
  questionText: string;
  subText: string;
  answerRequired: boolean;
  placeholderText: string;
  options: NormalizedSurveyOption[];
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object";

const toText = (value: unknown) => {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
};

export const normalizeSurveyOption = (option: unknown): NormalizedSurveyOption => {
  const record = isObject(option) ? option : {};
  const optionText =
    toText(record.optionText) ||
    toText(record.label) ||
    toText(record.name) ||
    toText(record.value);

  return {
    ...record,
    optionText,
    value: record.value ?? optionText,
  };
};

export const normalizeSurveyQuestion = (question: SurveyQuestion): NormalizedSurveyQuestion => {
  const options = Array.isArray(question.options) ? question.options.map(normalizeSurveyOption) : [];

  return {
    ...question,
    questionId: question.questionId ?? question.id,
    questionText: toText(question.questionText ?? question.question_text),
    subText: toText(question.questionSubtext ?? question.question_subtext),
    answerRequired: Boolean(question.answerRequired ?? question.answer_required),
    placeholderText: toText(question.placeholderText ?? question.placeholder_text),
    options,
  };
};

export const extractSurveyQuestions = (payload: unknown): NormalizedSurveyQuestion[] => {
  if (Array.isArray(payload)) return payload.map((item) => normalizeSurveyQuestion(item as SurveyQuestion));
  if (isObject(payload) && Array.isArray(payload.questions)) {
    return payload.questions.map((item) => normalizeSurveyQuestion(item as SurveyQuestion));
  }
  return [];
};

export const getSurveyAnswerValue = (question: Partial<NormalizedSurveyQuestion>) => {
  const metadata = isObject(question.answerMetadata) ? question.answerMetadata : null;
  const metadataValue = metadata?.value;

  if (metadataValue !== undefined && metadataValue !== null) return metadataValue;
  if (question.answerText !== undefined && question.answerText !== null && question.answerText !== "") return question.answerText;
  return null;
};

export const hasSurveyAnswer = (question: Partial<NormalizedSurveyQuestion>) => {
  const value = getSurveyAnswerValue(question);
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
};

export const formatSurveyAnswer = (question: Partial<NormalizedSurveyQuestion>) => {
  const value = getSurveyAnswerValue(question);
  if (value === null || value === undefined) return "";

  if (question.questionType === "MultipleSelectionGroup" && Array.isArray(value)) {
    return value
      .map((entry) => {
        if (!isObject(entry)) return toText(entry);
        return toText(entry.optionText ?? entry.label ?? entry.name ?? entry.value);
      })
      .filter(Boolean)
      .join(", ");
  }

  if (question.questionType === "SelectionGroup" && isObject(value)) {
    return toText(value.optionText ?? value.label ?? value.name ?? value.value);
  }

  if (question.questionType === "ConditionalSelectionWithText") {
    const metadata = isObject(question.answerMetadata) ? question.answerMetadata : null;
    const selected = isObject(value) ? value : null;
    if (selected && toText(selected.value).toLowerCase() === "other") {
      return toText(metadata?.additionalText ?? question.additionalText);
    }
    return selected ? toText(selected.optionText ?? selected.label ?? selected.value) : toText(value);
  }

  if (question.questionType === "AddressPicker") {
    if (isObject(value)) return toText(value.formattedAddress ?? value.address);
    return toText(value);
  }

  if (question.questionType === "MultiAddressPicker" && Array.isArray(value)) {
    return value
      .map((entry) => {
        if (!isObject(entry)) return toText(entry);
        return toText(entry.formattedAddress ?? entry.address);
      })
      .filter(Boolean)
      .join("\n");
  }

  if (question.questionType === "ImageUpload") {
    if (typeof value === "string") return value;
    if (isObject(value) && "name" in value) return toText(value.name);
  }

  return toText(value);
};

export const buildSurveySubmissionPayload = (
  answers: Array<Record<string, unknown>>,
  questions: NormalizedSurveyQuestion[],
) =>
  answers.map((answer) => {
    const question = questions.find(
      (item) => String(item.questionId) === String(answer.questionId ?? ""),
    );
    return {
      ...answer,
      questionType: question?.questionType,
      questionText: question?.questionText,
    };
  });
