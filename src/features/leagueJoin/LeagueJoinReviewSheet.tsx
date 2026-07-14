import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
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

        <div className="league-join-sheet__header">
          <p className="league-join-sheet__eyebrow">League join review</p>
          <h2 id={titleId}>Check your eligibility</h2>
          <p id={descriptionId}>
            {league.name} · {formatLeagueGender(league)} · {formatLeagueLevelRange(league)} · 18+
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

            <section className="league-join-sheet__section" aria-labelledby={`${titleId}-gender`}>
              <div className="league-join-sheet__field-head">
                <div>
                  <h3 id={`${titleId}-gender`}>Gender</h3>
                  <p>{describeFieldState({
                    field: eligibility.gender,
                    label: "Gender",
                    mismatch:
                      league.gender === "women"
                        ? "This league is limited to women players."
                        : league.gender === "men"
                          ? "This league is limited to men players."
                          : "This league only accepts Other players through the mixed division.",
                  })}</p>
                </div>
                {eligibility.gender.status === "pass" ? <CircleCheck size={18} /> : <CircleAlert size={18} />}
              </div>

              {canEditGender ? (
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
              ) : (
                <div className="league-join-sheet__locked-value">{localProfile?.gender ?? "Unavailable"}</div>
              )}
              {fieldErrors.gender ? (
                <p className="league-join-sheet__field-error">{fieldErrors.gender}</p>
              ) : null}
            </section>

            <section className="league-join-sheet__section" aria-labelledby={`${titleId}-level`}>
              <div className="league-join-sheet__field-head">
                <div>
                  <h3 id={`${titleId}-level`}>NTRP rating</h3>
                  <p>{describeFieldState({
                    field: eligibility.level,
                    label: "NTRP rating",
                    mismatch: `This league accepts ${formatLeagueLevelRange(league)}.`,
                  })}</p>
                </div>
                {eligibility.level.status === "pass" ? <CircleCheck size={18} /> : <CircleAlert size={18} />}
              </div>

              {canEditLevel ? (
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
              ) : (
                <div className="league-join-sheet__locked-value">
                  {hasValue(localProfile?.usta_rating) ? localProfile?.usta_rating : "Unavailable"}
                </div>
              )}
              {fieldErrors.level ? (
                <p className="league-join-sheet__field-error">{fieldErrors.level}</p>
              ) : null}
            </section>

            <section className="league-join-sheet__section" aria-labelledby={`${titleId}-dob`}>
              <div className="league-join-sheet__field-head">
                <div>
                  <h3 id={`${titleId}-dob`}>Date of birth</h3>
                  <p>{describeFieldState({
                    field: eligibility.age,
                    label: "Date of birth",
                    mismatch: "Players must be at least 18 years old to join this league.",
                  })}</p>
                </div>
                {eligibility.age.status === "pass" ? <CircleCheck size={18} /> : <CircleAlert size={18} />}
              </div>

              {canEditAge ? (
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
              ) : (
                <div className="league-join-sheet__locked-value">
                  {formatDateInputValue(profileDateOfBirth) || "Unavailable"}
                </div>
              )}
              {fieldErrors.age ? (
                <p className="league-join-sheet__field-error">{fieldErrors.age}</p>
              ) : null}
            </section>

            {eligibility.canContinue ? (
              <p className="league-join-sheet__status league-join-sheet__status--ready">
                Your profile matches this league. Continue to the next join step.
              </p>
            ) : (
              <p className="league-join-sheet__status">
                Fix the missing fields above or review the league requirements before continuing.
              </p>
            )}
            {submitError ? (
              <p className="league-join-sheet__status league-join-sheet__status--error">
                {submitError}
              </p>
            ) : null}
          </>
        )}

        <div className="league-join-sheet__actions">
          <button type="button" className="league-join-sheet__secondary" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </button>
          <button
            type="button"
            className="league-join-sheet__primary"
            disabled={continueDisabled}
            onClick={() => void submit()}
          >
            {isSubmitting ? "Saving…" : "Continue"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LeagueJoinReviewSheet;
