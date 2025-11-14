import type { CoachRosterStatus } from "../../hooks/useCoachRoster";

type JoinMyRosterBannerProps = {
  coachName?: string;
  rosterStatus: CoachRosterStatus;
  canRequest: boolean;
  onRequestJoin: () => void;
  requestingJoin: boolean;
  joinError?: string | null;
  joinSuccess?: boolean;
  rosterError?: string | null;
  rosterLoading?: boolean;
};

const JoinMyRosterBanner = ({
  coachName,
  rosterStatus,
  canRequest,
  onRequestJoin,
  requestingJoin,
  joinError,
  joinSuccess,
  rosterError,
  rosterLoading,
}: JoinMyRosterBannerProps) => {
  if (rosterStatus === "accepted") {
    return null;
  }

  const isPending = rosterStatus === "pending";
  const disableAction = !canRequest || requestingJoin || isPending || Boolean(rosterLoading);
  const buttonLabel = rosterLoading
    ? "Checking status…"
    : isPending
      ? "Awaiting approval"
      : requestingJoin
        ? "Requesting…"
        : "Join my roster";

  let helperText: { tone: "error" | "success" | "note"; text: string } | null = null;
  if (joinError) {
    helperText = { tone: "error", text: joinError };
  } else if (rosterError) {
    helperText = { tone: "error", text: rosterError };
  } else if (!canRequest) {
    helperText = { tone: "note", text: "Sign in to request this coach." };
  } else if (joinSuccess) {
    helperText = { tone: "success", text: "Coach request sent! We'll notify you once it's approved." };
  } else if (isPending) {
    helperText = { tone: "note", text: "Your coach request is pending approval." };
  } else {
    helperText = {
      tone: "note",
      text: `Join ${coachName ? `${coachName}'s` : "this coach's"} roster to unlock lesson requests.`,
    };
  }

  return (
    <div className="join-roster-banner" role="status" aria-live="polite">
      <div className="join-roster-banner__content">
        <p className="join-roster-banner__eyebrow">Coach approval required</p>
        <h3 className="join-roster-banner__title">Join {coachName ? `${coachName}'s` : "this"} roster</h3>
        <p className="join-roster-banner__body">
          Get approved before booking private lessons or requesting training slots.
        </p>
      </div>
      <div className="join-roster-banner__actions">
        <button
          type="button"
          className="join-roster-banner__button"
          onClick={onRequestJoin}
          disabled={disableAction}
        >
          {buttonLabel}
        </button>
        {helperText ? (
          <span
            className={`join-roster-banner__message join-roster-banner__message--${helperText.tone}`}
            role={helperText.tone === "error" ? "alert" : "status"}
          >
            {helperText.text}
          </span>
        ) : null}
      </div>
    </div>
  );
};

export default JoinMyRosterBanner;
