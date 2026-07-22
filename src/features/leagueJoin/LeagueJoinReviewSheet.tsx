import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CircleAlert, CircleCheck, X } from "lucide-react";

import type { League } from "../../api/leagues";
import {
  patchPlayerPersonalDetails,
  type PlayerGender,
  type PlayerPersonalDetails,
} from "../../api/playerProfile";
import {
  evaluateLeagueEligibility,
  type LeagueJoinEligibility,
  type LeagueJoinPending,
} from "./eligibility";
import { buildJoinProfilePatch } from "./joinProfile";

import "./LeagueJoin.css";

const GENDER_OPTIONS: Array<{
  label: string;
  value: PlayerGender;
}> = [
  { label: "Male", value: "male" },
  { label: "Female", value: "female" },
  { label: "Other", value: "other" },
];

const NTRP_OPTIONS = Array.from({ length: 6 }, (_, index) => (2.5 + (index * 0.5)).toFixed(1));

const hasValue = (value: unknown) =>
  !(value == null || (typeof value === "string" && value.trim() === ""));

const formatLeagueLevelRange = (league: League) => {
  const low = league.bandLow ?? league.band_low;
  const high = league.bandHigh ?? league.band_high;
  if (!hasValue(low) || !hasValue(high)) {
    return "All levels";
  }
  return `NTRP ${low}-${high}`;
};

const formatLeagueGender = (league: League) => {
  switch (league.gender) {
    case "men":
      return "Men's";
    case "women":
      return "Women's";
    case "mixed":
      return "Mixed";
    default:
      return "Open";
  }
};

const formatDateInputValue = (value: string | null | undefined) => {
  if (!hasValue(value)) {
    return "";
  }

  const parsed = new Date(value as string);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  return parsed.toISOString().slice(0, 10);
};

const readProfileDateOfBirth = (profile: PlayerPersonalDetails | null | undefined) =>
  profile?.date_of_birth ?? profile?.dateOfBirth ?? profile?.dob;

const getLatestEligibleDob = (now: Date) => {
  const latest = new Date(Date.UTC(now.getUTCFullYear() - 18, now.getUTCMonth(), now.getUTCDate()));
  return latest.toISOString().slice(0, 10);
};

const describeFieldState = ({
  field,
  label,
  mismatch,
}: {
  field: LeagueJoinEligibility[keyof LeagueJoinEligibility];
  label: string;
  mismatch: string;
}) => {
  switch (field.status) {
    case "pass":
      return `${label} matches this league.`;
    case "missing":
      return `Add ${label.toLowerCase()} to continue.`;
    case "entered_mismatch":
      return mismatch;
    case "existing_mismatch":
      return mismatch;
    default:
      return "";
  }
};

export interface LeagueJoinReviewSheetProps {
  league: League;
  profile: PlayerPersonalDetails | null;
  token?: string;
  loading?: boolean;
  profileError?: string | null;
  onClose: () => void;
  onEligible?: (profile: PlayerPersonalDetails) => void;
  onContinue?: () => void;
}

type JoinFieldKey = "gender" | "level" | "age";

const getErrorMessage = (error: unknown) => {
  const apiError = error as {
    data?: { detail?: string; error?: string; errors?: string[] };
    message?: string;
  };

  if (apiError.data?.detail) {
    return apiError.data.detail;
  }

  if (apiError.data?.errors?.length) {
    return apiError.data.errors.join(", ");
  }

  if (apiError.data?.error === "self_rating_locked") {
    return "Your NTRP rating is locked and can't be changed here.";
  }

  return apiError.data?.error || apiError.message || "We couldn't save your profile.";
};

const getFieldErrorKey = (error: unknown): JoinFieldKey | null => {
  const message = getErrorMessage(error).toLowerCase();

  if (message.includes("gender")) {
    return "gender";
  }

  if (
    message.includes("usta_rating") ||
    message.includes("ntrp") ||
    message.includes("rating") ||
    message.includes("self_rating_locked")
  ) {
    return "level";
  }

  if (message.includes("date_of_birth") || message.includes("date of birth") || message.includes("18")) {
    return "age";
  }

  return null;
};

// Presentational only — a single "✓ Level — you're 4.5" style check row for the eligibility
// sheet's two variants. No logic; the sheet computes pass/fail and passes strings in.
const EligCheckRow = ({ label, value, ok = true }: { label: string; value: string; ok?: boolean }) => (
  <div className="ljr-check">
    <span className={`ljr-check__tick${ok ? "" : " is-alert"}`}>
      {ok ? <CircleCheck size={14} /> : <CircleAlert size={14} />}
    </span>
    <span className="ljr-check__lbl">{label}</span>
    <span className="ljr-check__val">{value}</span>
  </div>
);

const LeagueJoinReviewSheet = ({
  league,
  profile,
  token,
  loading = false,
  profileError = null,
  onClose,
  onEligible,
  onContinue,
}: LeagueJoinReviewSheetProps) => {
  const titleId = useId();
  const descriptionId = useId();
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const navigate = useNavigate();
  const [localProfile, setLocalProfile] = useState<PlayerPersonalDetails | null>(profile);
  const [pending, setPending] = useState<LeagueJoinPending>({});
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<JoinFieldKey, string>>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleClose = useCallback(() => {
    if (isSubmitting) {
      return;
    }

    onClose();
  }, [isSubmitting, onClose]);

  useEffect(() => {
    restoreFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    closeButtonRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        handleClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      restoreFocusRef.current?.focus?.();
    };
  }, [handleClose]);

  useEffect(() => {
    setLocalProfile(profile);
    setPending({});
    setFieldErrors({});
    setSubmitError(null);
  }, [league.id, profile]);

  const latestEligibleDob = useMemo(() => getLatestEligibleDob(new Date()), []);

  const eligibility = useMemo(
    () =>
      evaluateLeagueEligibility({
        league: league as Parameters<typeof evaluateLeagueEligibility>[0]["league"],
        profile: {
          gender: localProfile?.gender,
          usta_rating: localProfile?.usta_rating,
          date_of_birth: readProfileDateOfBirth(localProfile),
        },
        pending,
        now: new Date(),
      }),
    [league, localProfile, pending],
  );

  const genderValue = pending.gender ?? localProfile?.gender ?? "";
  const levelValue = String(pending.usta_rating ?? localProfile?.usta_rating ?? "");
  const profileDateOfBirth = readProfileDateOfBirth(localProfile);
  const dobValue = pending.date_of_birth ?? formatDateInputValue(profileDateOfBirth);

  const canEditGender = eligibility.gender.status === "missing" || hasValue(pending.gender);
  const canEditLevel = eligibility.level.status === "missing" || hasValue(pending.usta_rating);
  const canEditAge = eligibility.age.status === "missing" || hasValue(pending.date_of_birth);
  const controlsDisabled = isSubmitting || (!!profileError && !localProfile);
  const continueDisabled = loading || isSubmitting || !!profileError || !eligibility.canContinue;

  const submit = async () => {
    if (continueDisabled) {
      return;
    }

    const currentProfile = localProfile;
    if (!currentProfile) {
      setSubmitError("We couldn't load your profile. Please try again.");
      return;
    }

    const patch = buildJoinProfilePatch(currentProfile, pending);
    if (patch === null) {
      setSubmitError("The profile values entered for this join request don't agree. Please review them and try again.");
      return;
    }

    setIsSubmitting(true);
    setFieldErrors({});
    setSubmitError(null);

    try {
      let nextProfile = currentProfile;

      if (Object.keys(patch).length > 0) {
        if (!token) {
          throw new Error("You're no longer signed in. Please sign in again to continue.");
        }

        nextProfile = await patchPlayerPersonalDetails({
          token,
          body: patch,
        });
        setLocalProfile(nextProfile);
        setPending({});
      }

      const nextEligibility = evaluateLeagueEligibility({
        league: league as Parameters<typeof evaluateLeagueEligibility>[0]["league"],
        profile: {
          gender: nextProfile.gender,
          usta_rating: nextProfile.usta_rating,
          date_of_birth: readProfileDateOfBirth(nextProfile),
        },
        pending: {},
        now: new Date(),
      });

      if (!nextEligibility.canContinue) {
        setSubmitError("Your profile still doesn't meet this league's eligibility requirements.");
        return;
      }

      onEligible?.(nextProfile);
      onContinue?.();
    } catch (error) {
      const nextField = getFieldErrorKey(error);
      const message = getErrorMessage(error);

      if (nextField) {
        setFieldErrors({ [nextField]: message });
      } else {
        setSubmitError(message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Presentation-derived flags for the two prototype variants ("You're a match" vs "Two quick
  // things first"). Pure — no bearing on gate/submit logic (eligibility.canContinue drives that).
  const anyNeeds = canEditGender || canEditLevel || canEditAge;
  const allPass = eligibility.canContinue && !anyNeeds;
  const genderPass = eligibility.gender.status === "pass" && !canEditGender;
  const levelPass = eligibility.level.status === "pass" && !canEditLevel;
  const agePass = eligibility.age.status === "pass" && !canEditAge;
  const genderMismatch = !canEditGender && eligibility.gender.status !== "pass";
  const levelMismatch = !canEditLevel && eligibility.level.status !== "pass";
  const ageMismatch = !canEditAge && eligibility.age.status !== "pass";
  const levelCheckValue = hasValue(localProfile?.usta_rating)
    ? `You're ${localProfile?.usta_rating} — inside ${formatLeagueLevelRange(league)}`
    : `Inside ${formatLeagueLevelRange(league)}`;

  // Hard block: a locked, non-fixable disqualification (existing profile value doesn't meet the
  // league — wrong division, out-of-band rating, or under 18). Distinct from "missing" fields the
  // player can fill in. Presentation only — the gate is still eligibility.canContinue.
  const hardBlock = genderMismatch || levelMismatch || ageMismatch;
  // One clean, self-contained sentence per failing requirement (named against the player's
  // value) so a single-field block reads well and multiple don't repeat the requirements.
  const blockReasons = [
    genderMismatch
      ? `This league is ${formatLeagueGender(league)} only — your profile is set to a different division.`
      : null,
    levelMismatch
      ? `This league is for ${formatLeagueLevelRange(league)} — your profile rating is outside that range.`
      : null,
    ageMismatch
      ? "This league is 18-and-over — your date of birth on file doesn't meet that."
      : null,
  ].filter(Boolean) as string[];

  return (
    <div className="league-join-sheet" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId}>
      <button
        type="button"
        className="league-join-sheet__backdrop"
        aria-label="Close join review"
        onClick={handleClose}
        disabled={isSubmitting}
      />
      <div className="league-join-sheet__panel">
        <button
          ref={closeButtonRef}
          type="button"
          className="league-join-sheet__close"
          aria-label="Close join review"
          onClick={handleClose}
          disabled={isSubmitting}
        >
          <X size={18} />
        </button>

        <div className={`league-join-sheet__header ljr-elig-head${hardBlock ? " is-blocked" : ""}`}>
          <h2 id={titleId}>
            {hardBlock
              ? "This league isn't a match for your profile"
              : allPass
                ? "You're a match ✓"
                : "Two quick things first"}
          </h2>
          <p id={descriptionId}>
            {hardBlock ? (
              <>{blockReasons.join(" ")}</>
            ) : (
              <>
                This league needs {formatLeagueGender(league)}, {formatLeagueLevelRange(league)}, 18+.{" "}
                {allPass
                  ? "Here's how your profile lines up:"
                  : "Fill in what's missing — we'll save it to your profile."}
              </>
            )}
          </p>
        </div>

        {loading ? (
          <div className="league-join-sheet__loading">Loading your profile…</div>
        ) : (
          <>
            {profileError ? (
              <p className="league-join-sheet__status league-join-sheet__status--error">
                {profileError}
              </p>
            ) : null}

            <div className="ljr-check-list">
              {genderPass ? (
                <EligCheckRow label="Division" value={`${formatLeagueGender(league)} league`} />
              ) : null}
              {genderMismatch ? (
                <EligCheckRow
                  ok={false}
                  label="Division"
                  value={describeFieldState({
                    field: eligibility.gender,
                    label: "Gender",
                    mismatch:
                      league.gender === "women"
                        ? "This league is limited to women players."
                        : league.gender === "men"
                          ? "This league is limited to men players."
                          : "This league only accepts Other players through the mixed division.",
                  })}
                />
              ) : null}
              {levelPass ? <EligCheckRow label="Level" value={levelCheckValue} /> : null}
              {levelMismatch ? (
                <EligCheckRow
                  ok={false}
                  label="Level"
                  value={describeFieldState({
                    field: eligibility.level,
                    label: "NTRP rating",
                    mismatch: `This league accepts ${formatLeagueLevelRange(league)}.`,
                  })}
                />
              ) : null}
              {agePass ? <EligCheckRow label="Age" value="18+ confirmed" /> : null}
              {ageMismatch ? (
                <EligCheckRow
                  ok={false}
                  label="Age"
                  value={describeFieldState({
                    field: eligibility.age,
                    label: "Date of birth",
                    mismatch: "Players must be at least 18 years old to join this league.",
                  })}
                />
              ) : null}
            </div>

            {!hardBlock && canEditGender ? (
              <div className="ljr-need">
                <div className="ljr-need__lbl">Which division do you play in?</div>
                <div className="ljr-need__why">This is a {formatLeagueGender(league)} league.</div>
                <fieldset className="league-join-sheet__fieldset">
                  <legend className="league-join-sheet__legend">Gender</legend>
                  <div className="league-join-sheet__segmented" role="radiogroup" aria-label="Gender">
                    {GENDER_OPTIONS.map((option) => (
                      <label key={option.value} className={genderValue === option.value ? "is-selected" : undefined}>
                        <input
                          type="radio"
                          name="league-join-gender"
                          value={option.value}
                          checked={genderValue === option.value}
                          disabled={controlsDisabled}
                          onChange={() => {
                            setFieldErrors((current) => ({ ...current, gender: undefined }));
                            setSubmitError(null);
                            setPending((current) => ({ ...current, gender: option.value }));
                          }}
                        />
                        <span>{option.label}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                {fieldErrors.gender ? (
                  <p className="league-join-sheet__field-error">{fieldErrors.gender}</p>
                ) : null}
              </div>
            ) : null}

            {!hardBlock && canEditLevel ? (
              <div className="ljr-need">
                <div className="ljr-need__lbl">What&apos;s your NTRP rating?</div>
                <div className="ljr-need__why">This league accepts {formatLeagueLevelRange(league)}.</div>
                <label className="league-join-sheet__select-field" htmlFor="league-join-level">
                  <span>NTRP rating</span>
                  <select
                    id="league-join-level"
                    value={levelValue}
                    disabled={controlsDisabled}
                    onChange={(event) => {
                      setFieldErrors((current) => ({ ...current, level: undefined }));
                      setSubmitError(null);
                      setPending((current) => ({
                        ...current,
                        usta_rating: event.target.value || undefined,
                      }));
                    }}
                  >
                    <option value="">Select a rating</option>
                    {NTRP_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
                {fieldErrors.level ? (
                  <p className="league-join-sheet__field-error">{fieldErrors.level}</p>
                ) : null}
              </div>
            ) : null}

            {!hardBlock && canEditAge ? (
              <div className="ljr-need">
                <div className="ljr-need__lbl">Date of birth</div>
                <div className="ljr-need__why">League play requires players to be 18 or over.</div>
                <label className="league-join-sheet__date-field" htmlFor="league-join-dob">
                  <span>Date of birth</span>
                  <input
                    id="league-join-dob"
                    type="date"
                    max={latestEligibleDob}
                    value={dobValue}
                    disabled={controlsDisabled}
                    onChange={(event) => {
                      setFieldErrors((current) => ({ ...current, age: undefined }));
                      setSubmitError(null);
                      setPending((current) => ({
                        ...current,
                        date_of_birth: event.target.value || undefined,
                      }));
                    }}
                  />
                </label>
                {fieldErrors.age ? (
                  <p className="league-join-sheet__field-error">{fieldErrors.age}</p>
                ) : null}
              </div>
            ) : null}

            {!hardBlock && anyNeeds ? (
              <p className="ljr-save-note">
                These save to your player profile — you won&apos;t be asked again.
              </p>
            ) : null}

            {submitError ? (
              <p className="league-join-sheet__status league-join-sheet__status--error">
                {submitError}
              </p>
            ) : null}
          </>
        )}

        <div className="league-join-sheet__actions">
          {hardBlock ? (
            // Not eligible (locked mismatch): no way to continue from here — offer an exit to
            // browse instead of a permanently-disabled Continue. Gate logic is unchanged.
            <button
              type="button"
              className="league-join-sheet__primary league-join-sheet__primary--wide"
              onClick={() => {
                handleClose();
                navigate("/leagues");
              }}
            >
              Browse other leagues
            </button>
          ) : (
            <>
              <button type="button" className="league-join-sheet__secondary" onClick={handleClose} disabled={isSubmitting}>
                Cancel
              </button>
              <button
                type="button"
                className="league-join-sheet__primary"
                disabled={continueDisabled}
                onClick={() => void submit()}
              >
                {isSubmitting ? "Saving…" : allPass ? "Looks right — continue" : "Save & continue"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default LeagueJoinReviewSheet;
