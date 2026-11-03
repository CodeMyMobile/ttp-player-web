import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getPlayerPersonalDetails, patchPlayerPersonalDetails } from "../../api/playerProfile";
import { getStoredAuthToken } from "../../services/authToken";
import { hasStoredRating, storeUpdatedProfile } from "../../features/ratingQuiz/storedRating";
import { quizHrefFromMatch } from "../../features/ratingQuiz/quizReturn";

/** NTRP levels a player can tap. Half steps, as the profile's own level picker saves them. */
const LEVELS = [2.5, 3.0, 3.5, 4.0, 4.5, 5.0];

const dismissKey = (matchId: string | number) => `matchLevelPrompt:skipped:${matchId}`;

const wasSkipped = (matchId: string | number) => {
  try {
    return localStorage.getItem(dismissKey(matchId)) === "1";
  } catch {
    return false;
  }
};

interface MatchLevelPromptProps {
  matchId: string | number;
  /**
   * "card" is the "You're in" follow-up, with Skip. "link" sits in the player's
   * own row in Who's playing and opens the same choices when tapped.
   */
  variant: "card" | "link";
  /** Called after a level is saved, so the page can reload the match and show it. */
  onSaved?: (level: number) => void;
}

/**
 * Asks a player who has just joined a match for their level, when they have none:
 * no declared USTA level, no quiz estimate and no rating from played matches
 * (hasStoredRating). Saves `usta_rating` only, the one rating field a player can
 * write; the API refuses it once a player has been seeded, and then the prompt
 * goes away.
 */
export function MatchLevelPrompt({ matchId, variant, onSaved }: MatchLevelPromptProps) {
  const [needsLevel, setNeedsLevel] = useState(false);
  const [open, setOpen] = useState(variant === "card");
  const [saving, setSaving] = useState<number | null>(null);
  const [saved, setSaved] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [skipped, setSkipped] = useState(() => variant === "card" && wasSkipped(matchId));

  useEffect(() => {
    const token = getStoredAuthToken();
    if (!token || skipped) return undefined;
    const controller = new AbortController();
    getPlayerPersonalDetails({ token, signal: controller.signal })
      .then((details) => setNeedsLevel(!hasStoredRating(details)))
      .catch(() => setNeedsLevel(false));
    return () => controller.abort();
  }, [skipped]);

  if (skipped || (!needsLevel && saved === null)) return null;

  if (saved !== null) {
    return variant === "card" ? (
      <p className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700" role="status">
        Saved. You're down as {saved.toFixed(1)}.
      </p>
    ) : null;
  }

  const save = async (level: number) => {
    const token = getStoredAuthToken();
    if (!token || saving !== null) return;
    setSaving(level);
    setError("");
    try {
      const details = await patchPlayerPersonalDetails({ token, body: { usta_rating: level } });
      storeUpdatedProfile(details);
      setSaved(level);
      onSaved?.(level);
    } catch (err) {
      const status = Number((err as { status?: unknown })?.status);
      // 409: their level now comes from played matches, so there's nothing to ask.
      if (status === 409) setNeedsLevel(false);
      else setError("We couldn't save your level. Try again.");
    } finally {
      setSaving(null);
    }
  };

  const skip = () => {
    try {
      localStorage.setItem(dismissKey(matchId), "1");
    } catch {
      // Best effort: without storage it shows again next time.
    }
    setSkipped(true);
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-0.5 min-h-[44px] text-left text-xs font-semibold text-violet-700 underline-offset-2 hover:underline sm:min-h-0"
      >
        Add your level
      </button>
    );
  }

  return (
    <section
      aria-labelledby={`match-level-prompt-${variant}-${matchId}`}
      className="rounded-2xl border border-slate-200 bg-white px-4 py-3.5"
    >
      <h3 id={`match-level-prompt-${variant}-${matchId}`} className="text-[15px] font-semibold text-slate-900">
        What's your level?
      </h3>
      <p className="mt-0.5 text-sm text-slate-600">Add it so the group knows who's playing.</p>
      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Your NTRP level">
        {LEVELS.map((level) => (
          <button
            key={level}
            type="button"
            onClick={() => save(level)}
            disabled={saving !== null}
            className="min-h-[44px] min-w-[56px] rounded-full border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 hover:border-violet-500 hover:text-violet-700 disabled:opacity-60"
          >
            {saving === level ? "Saving..." : level.toFixed(1)}
          </button>
        ))}
      </div>
      {error && (
        <p className="mt-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <Link
          to={quizHrefFromMatch(matchId)}
          className="inline-flex min-h-[44px] items-center text-sm font-semibold text-violet-700 underline-offset-2 hover:underline"
        >
          Not sure? Take the 5-question quiz
        </Link>
        {variant === "card" ? (
          <button
            type="button"
            onClick={skip}
            className="min-h-[44px] px-2 text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            Skip
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="min-h-[44px] px-2 text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            Not now
          </button>
        )}
      </div>
    </section>
  );
}
