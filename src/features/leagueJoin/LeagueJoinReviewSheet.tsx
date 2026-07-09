import { useEffect, useId, useMemo, useRef, useState } from "react";
import { CircleAlert, CircleCheck, X } from "lucide-react";

import type { League } from "../../api/leagues";
import type { PlayerGender, PlayerPersonalDetails } from "../../api/playerProfile";
import {
  evaluateLeagueEligibility,
  type LeagueJoinEligibility,
  type LeagueJoinPending,
} from "./eligibility";

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
  loading?: boolean;
  onClose: () => void;
  onContinue?: (payload: { leagueId: League["id"]; pending: LeagueJoinPending }) => void;
}

const LeagueJoinReviewSheet = ({
  league,
  profile,
  loading = false,
  onClose,
  onContinue,
}: LeagueJoinReviewSheetProps) => {
  const titleId = useId();
  const descriptionId = useId();
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const [pending, setPending] = useState<LeagueJoinPending>({});

  useEffect(() => {
    restoreFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    closeButtonRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      restoreFocusRef.current?.focus?.();
    };
  }, [onClose]);

  useEffect(() => {
    setPending({});
  }, [league.id, profile?.id, profile?.user_id]);

  const latestEligibleDob = useMemo(() => getLatestEligibleDob(new Date()), []);

  const eligibility = useMemo(
    () =>
      evaluateLeagueEligibility({
        league: league as Parameters<typeof evaluateLeagueEligibility>[0]["league"],
        profile: {
          gender: profile?.gender,
          usta_rating: profile?.usta_rating,
          date_of_birth: profile?.date_of_birth,
        },
        pending,
        now: new Date(),
      }),
    [league, pending, profile?.date_of_birth, profile?.gender, profile?.usta_rating],
  );

  const genderValue = pending.gender ?? profile?.gender ?? "";
  const levelValue = String(pending.usta_rating ?? profile?.usta_rating ?? "");
  const dobValue = pending.date_of_birth ?? formatDateInputValue(profile?.date_of_birth);

  const canEditGender = eligibility.gender.status === "missing" || hasValue(pending.gender);
  const canEditLevel = eligibility.level.status === "missing" || hasValue(pending.usta_rating);
  const canEditAge = eligibility.age.status === "missing" || hasValue(pending.date_of_birth);

  const submit = () => {
    if (!eligibility.canContinue) {
      return;
    }

    onContinue?.({
      leagueId: league.id,
      pending,
    });
  };

  return (
    <div className="league-join-sheet" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId}>
      <button
        type="button"
        className="league-join-sheet__backdrop"
        aria-label="Close join review"
        onClick={onClose}
      />
      <div className="league-join-sheet__panel">
        <button
          ref={closeButtonRef}
          type="button"
          className="league-join-sheet__close"
          aria-label="Close join review"
          onClick={onClose}
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
                          onChange={() => setPending((current) => ({ ...current, gender: option.value }))}
                        />
                        <span>{option.label}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              ) : (
                <div className="league-join-sheet__locked-value">{profile?.gender ?? "Unavailable"}</div>
              )}
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
                    onChange={(event) =>
                      setPending((current) => ({
                        ...current,
                        usta_rating: event.target.value || undefined,
                      }))
                    }
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
                  {hasValue(profile?.usta_rating) ? profile?.usta_rating : "Unavailable"}
                </div>
              )}
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
                    onChange={(event) =>
                      setPending((current) => ({
                        ...current,
                        date_of_birth: event.target.value || undefined,
                      }))
                    }
                  />
                </label>
              ) : (
                <div className="league-join-sheet__locked-value">
                  {formatDateInputValue(profile?.date_of_birth) || "Unavailable"}
                </div>
              )}
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
          </>
        )}

        <div className="league-join-sheet__actions">
          <button type="button" className="league-join-sheet__secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="league-join-sheet__primary"
            disabled={loading || !eligibility.canContinue}
            onClick={submit}
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
};

export default LeagueJoinReviewSheet;
