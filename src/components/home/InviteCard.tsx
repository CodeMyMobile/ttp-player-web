import { useState } from "react";
import { Clock } from "lucide-react";
import { Link } from "react-router-dom";
import {
  declinePromptFor,
  inviteMetaLabel,
  moreInvitesLabel,
  type HomeInviteItem,
} from "../../utils/homeInvite";

interface InviteCardProps {
  invite: HomeInviteItem | null;
  /** How many other invites are waiting; renders the "N more" link. */
  remaining: number;
  onAccept: (invite: HomeInviteItem) => void;
  onDecline: (invite: HomeInviteItem) => void;
  /** True while an action is in flight, so the buttons can't be double-fired. */
  busy?: boolean;
}

/**
 * The violet invite card, per established.html, with the confirm step from
 * decline-confirm.html.
 *
 * Only ever one card — selectHomeInvite picks the soonest and the rest become a
 * link. Two stacked violet cards would swamp everything below them.
 */
export function InviteCard({
  invite,
  remaining,
  onAccept,
  onDecline,
  busy = false,
}: InviteCardProps) {
  const [confirming, setConfirming] = useState(false);

  if (!invite) return null;

  const meta = inviteMetaLabel(invite);
  const more = moreInvitesLabel(remaining);

  // Declining SMSes the organiser, so it must not sit one mistap from Accept.
  // Dismissing is deliberately easy — anywhere on the card, or Escape — while
  // confirming stays a specific, aimed tap.
  const dismiss = () => setConfirming(false);

  return (
    <section className="home-invite">
      <div
        className="home-invite__card"
        onClick={confirming ? dismiss : undefined}
        onKeyDown={
          confirming
            ? (event) => {
                if (event.key === "Escape") dismiss();
              }
            : undefined
        }
        role={confirming ? "presentation" : undefined}
      >
        <div className="home-invite__head">
          {invite.avatarUrl ? (
            <img className="home-invite__avatar" src={invite.avatarUrl} alt="" />
          ) : (
            <span className="home-invite__avatar home-invite__avatar--initials" aria-hidden="true">
              {invite.initials}
            </span>
          )}
          <span className="home-invite__copy">
            <span className="home-invite__title">{invite.senderName} wants to play</span>
            {meta ? <span className="home-invite__meta">{meta}</span> : null}
          </span>
        </div>

        {confirming ? (
          // Stops a tap on the panel itself from bubbling to the card's dismiss
          // handler — otherwise pressing Decline would dismiss instead of decline.
          <div className="home-invite__confirm" onClick={(event) => event.stopPropagation()}>
            <p className="home-invite__confirm-copy">{declinePromptFor(invite)}</p>
            <div className="home-invite__actions">
              {/* Weight inverts here: in the resting state Accept is the filled
                  button, but once the question is "are you sure", the safe answer
                  takes the emphasis and Decline drops to a ghost. */}
              <button
                type="button"
                className="home-invite__btn home-invite__btn--primary"
                onClick={dismiss}
              >
                Keep it
              </button>
              <button
                type="button"
                className="home-invite__btn home-invite__btn--ghost-outline"
                disabled={busy}
                onClick={() => onDecline(invite)}
              >
                Decline
              </button>
            </div>
          </div>
        ) : (
          <div className="home-invite__actions">
            <button
              type="button"
              className="home-invite__btn home-invite__btn--primary"
              disabled={busy}
              onClick={() => onAccept(invite)}
            >
              Accept
            </button>
            {/* No "Propose time" — there is no endpoint for it. */}
            <button
              type="button"
              className="home-invite__btn home-invite__btn--ghost"
              onClick={() => setConfirming(true)}
            >
              Decline
            </button>
          </div>
        )}

        {invite.expiresLabel ? (
          <p className="home-invite__expiry">
            <Clock size={12} aria-hidden="true" />
            {invite.expiresLabel}
          </p>
        ) : null}
      </div>

      {more ? (
        <Link className="home-invite__more" to="/invites">
          {more}
        </Link>
      ) : null}
    </section>
  );
}
