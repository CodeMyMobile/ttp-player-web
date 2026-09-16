import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import {
  activeRatingQuizQuestions,
  scoreRatingQuiz,
  type RatingQuizAnswerKey,
  type RatingQuizAnswers,
  type RatingQuizResult,
} from "../../features/ratingQuiz/ratingQuizModel";
import type { GroupLesson, GroupLessonLevel } from "../../api/groupLessons";
import { meetsLevelRequirement } from "../../utils/groupLessonLevelRequirement";

interface LevelCheckDrawerProps {
  open: boolean;
  onClose: () => void;
  /** The class the player is looking at, so the result can speak about it. */
  className: string;
  requirement: GroupLessonLevel | null;
  /** Upcoming classes to suggest when the player is under the requirement. */
  suggestions: GroupLesson[];
  isSignedIn: boolean;
  onPromptSignIn: () => void;
  /**
   * Persists the self-assessed level. Resolves false when the profile refuses it
   * — the API locks a rating once the player has been seeded.
   */
  onSaveLevel: (level: number) => Promise<boolean>;
  onViewClass: (lessonId: number | string) => void;
  onBrowseAll: () => void;
}

export function LevelCheckDrawer({
  open,
  onClose,
  className,
  requirement,
  suggestions,
  isSignedIn,
  onPromptSignIn,
  onSaveLevel,
  onViewClass,
  onBrowseAll,
}: LevelCheckDrawerProps) {
  const [answers, setAnswers] = useState<RatingQuizAnswers>({});
  const [index, setIndex] = useState(0);
  const [result, setResult] = useState<RatingQuizResult | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "locked">("idle");
  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);

  const questions = useMemo(() => activeRatingQuizQuestions(answers), [answers]);
  const question = questions[index];

  const reset = useCallback(() => {
    setAnswers({});
    setIndex(0);
    setResult(null);
    setSaveState("idle");
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = panelRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  // The quiz starts clean each time it is opened. A half-finished run from an
  // earlier visit is more confusing than five quick questions.
  useEffect(() => {
    if (open) reset();
  }, [open, reset]);

  const answer = (key: RatingQuizAnswerKey, optionId: string) => {
    const next = { ...answers, [key]: optionId };
    setAnswers(next);
    const remaining = activeRatingQuizQuestions(next);
    // The beginner answer ends the quiz where it stands — it is an answer, not a
    // shortcut past the rest.
    if (key === "bg" && optionId === "starting") {
      setResult(scoreRatingQuiz(next));
      return;
    }
    if (index + 1 >= remaining.length) {
      setResult(scoreRatingQuiz(next));
      return;
    }
    setIndex(index + 1);
  };

  const save = async (level: number) => {
    if (!isSignedIn) {
      onPromptSignIn();
      return;
    }
    setSaveState("saving");
    const ok = await onSaveLevel(level);
    setSaveState(ok ? "saved" : "locked");
  };

  if (!open) return null;

  const clears = meetsLevelRequirement(result?.seed ?? null, requirement);
  const shown = suggestions.slice(0, 3);

  return (
    <div
      className="fixed inset-0 z-[190] flex items-end justify-end bg-[rgba(15,23,42,0.55)] sm:items-stretch"
      role="dialog"
      aria-modal="true"
      aria-labelledby="level-check-title"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        className="flex max-h-[88vh] w-full flex-col rounded-t-2xl bg-white sm:max-h-none sm:h-full sm:w-[360px] sm:rounded-none sm:shadow-[-12px_0_40px_rgba(0,0,0,0.18)]"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 id="level-check-title" className="m-0 text-[16px] font-extrabold text-slate-900">
            What's my tennis level?
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1 text-slate-500 hover:bg-slate-100"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {!result && question ? (
          <div className="flex-1 overflow-y-auto px-5 py-5">
            <div
              className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200"
              role="progressbar"
              aria-valuenow={index + 1}
              aria-valuemin={1}
              aria-valuemax={questions.length}
              aria-label={`Question ${index + 1} of ${questions.length}`}
            >
              <div
                className="h-full rounded-full bg-[#8b5cf6] transition-[width]"
                style={{ width: `${Math.round(((index + 1) / questions.length) * 100)}%` }}
              />
            </div>
            <p className="mt-2 text-[12px] font-bold uppercase tracking-wide text-slate-500">
              Question {index + 1} of {questions.length}
            </p>

            <p className="mt-4 text-[15px] font-extrabold text-slate-900">{question.prompt}</p>
            {question.hint ? <p className="mt-1 text-[13px] text-slate-500">{question.hint}</p> : null}

            <div className="mt-4 flex flex-col gap-2">
              {question.options.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => answer(question.key, option.id)}
                  className="rounded-xl border border-slate-200 px-4 py-3 text-left text-[14px] text-slate-900 hover:border-[#8b5cf6]"
                >
                  <span className="font-bold">{option.label}</span>
                  {option.detail ? (
                    <span className="mt-0.5 block text-[12px] text-slate-500">{option.detail}</span>
                  ) : null}
                </button>
              ))}
            </div>

            <button
              type="button"
              disabled={index === 0}
              onClick={() => setIndex(Math.max(0, index - 1))}
              className="mt-4 bg-transparent p-0 text-[13px] font-bold text-slate-500 disabled:opacity-40"
            >
              Back
            </button>
          </div>
        ) : null}

        {result ? (
          <div className="flex-1 overflow-y-auto px-5 py-5">
            <p className="m-0 text-[13px] text-slate-500">Based on your answers, you look like</p>
            <p className="m-0 mt-1 text-[28px] font-extrabold text-slate-900">NTRP {result.band}</p>

            {clears ? (
              <>
                <p className="mt-3 text-[14px] leading-[1.55] text-slate-700">
                  You're in range for {className}. The coach has final say on placement after your
                  first session.
                </p>
                <button
                  type="button"
                  onClick={onClose}
                  className="mt-5 w-full rounded-xl bg-[#8b5cf6] px-4 py-3 text-[15px] font-bold text-white"
                >
                  Back to booking
                </button>
              </>
            ) : (
              <>
                <p className="mt-3 text-[14px] leading-[1.55] text-slate-700">
                  {className} is for {requirement?.toFixed(1)}+ players. This class is a great fit
                  for your level:
                </p>
                {shown.length ? (
                  <div className="mt-3 flex flex-col gap-2">
                    {shown.map((lesson) => (
                      <div key={String(lesson.id)} className="rounded-xl border border-slate-200 p-3">
                        <p className="m-0 text-[14px] font-bold text-slate-900">{lesson.title}</p>
                        <p className="m-0 mt-0.5 text-[12px] text-slate-500">
                          {lesson.day} {lesson.startTime} · {lesson.locationName}
                        </p>
                        <button
                          type="button"
                          onClick={() => onViewClass(lesson.id)}
                          className="mt-2 rounded-lg bg-[#8b5cf6] px-3 py-2 text-[13px] font-bold text-white"
                        >
                          View class
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={onBrowseAll}
                    className="mt-3 bg-transparent p-0 text-[14px] font-bold text-[#7c3aed] underline underline-offset-2"
                  >
                    Browse all group lessons
                  </button>
                )}
              </>
            )}

            <div className="mt-6 border-t border-slate-200 pt-4">
              {saveState === "saved" ? (
                <p className="m-0 text-[13px] text-slate-500" role="status">
                  Saved to your profile.
                </p>
              ) : saveState === "locked" ? (
                <p className="m-0 text-[13px] text-slate-500" role="status">
                  Your level is already set from played matches, so we kept that one.
                </p>
              ) : (
                <button
                  type="button"
                  disabled={saveState === "saving"}
                  onClick={() => save(result.seed)}
                  className="w-full rounded-xl border border-[#8b5cf6] px-4 py-3 text-[14px] font-bold text-[#7c3aed] disabled:opacity-60"
                >
                  {saveState === "saving"
                    ? "Saving..."
                    : isSignedIn
                      ? "Save this to my profile"
                      : "Sign in to save this"}
                </button>
              )}
              <button
                type="button"
                onClick={reset}
                className="mt-3 w-full bg-transparent p-0 text-[13px] font-bold text-slate-500"
              >
                Take it again
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
