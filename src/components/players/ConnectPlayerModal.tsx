import type { Player } from "../../data/mockPlayers";
import type { IntroStatus } from "../../hooks/usePlayerIntro";

import "./ConnectPlayerModal.css";

type ConnectPlayerModalProps = {
  isOpen: boolean;
  player: Player | null;
  onClose: () => void;
  onShareIntro: () => void;
  onCreateMatch: () => void;
  senderAvailability?: string[];
  senderCourts?: string | null;
  canShareIntro?: boolean;
  shareIntroDescription?: string;
  /** Where the quick intro is up to; see usePlayerIntro. */
  introStatus?: IntroStatus;
  introError?: string | null;
};

const formatAvailability = (slots?: string[]) => {
  if (!slots || !slots.length) {
    return [];
  }
  return slots.filter((slot) => typeof slot === "string" && slot.trim().length > 0);
};

const ConnectPlayerModal = ({
  isOpen,
  player,
  onClose,
  onShareIntro,
  onCreateMatch,
  senderAvailability,
  senderCourts,
  canShareIntro = true,
  shareIntroDescription,
  introStatus = "idle",
  introError = null,
}: ConnectPlayerModalProps) => {
  if (!isOpen || !player) {
    return null;
  }

  const availability = formatAvailability(senderAvailability);
  const hasAvailability = availability.length > 0;
  const trimmedCourts = senderCourts?.trim();
  const introDescription =
    shareIntroDescription ??
    `We'll text ${player.name} a short intro with a link to your profile. Your number isn't shared.`;

  return (
    <div className="connect-modal" role="dialog" aria-modal="true" aria-label="Connect with player">
      <div className="connect-modal__backdrop" onClick={onClose} aria-hidden="true" />
      <div className="connect-modal__panel">
        <div className="connect-modal__header">
          <div>
            <p className="connect-modal__eyebrow">Connect with</p>
            <h2 className="connect-modal__title">{player.name}</h2>
            <p className="connect-modal__subtitle">
              {canShareIntro
                ? "Share a quick intro or spin up a MatchPlay invite so you can align on a time to hit."
                : "Send a MatchPlay invite so you can align on a time to hit."}
            </p>
          </div>
          <button type="button" className="connect-modal__close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="connect-modal__body">
          <div className="connect-modal__card">
            <h3>Your match profile</h3>
            {hasAvailability ? (
              <div className="connect-modal__chips" aria-label="Preferred times">
                {availability.map((slot) => (
                  <span key={slot} className="connect-modal__chip">
                    {slot}
                  </span>
                ))}
              </div>
            ) : (
              <p className="connect-modal__helper">Share when you're free to help align on a time.</p>
            )}
            {trimmedCourts ? (
              <p className="connect-modal__helper">Preferred courts: {trimmedCourts}</p>
            ) : null}
          </div>

          <div className="connect-modal__actions">
            {/* No textable number: offer only the invite, so the sheet never reads as "can't connect". */}
            {canShareIntro && introStatus === "sent" ? (
              <div className="connect-modal__status" role="status">
                <span className="connect-modal__action-title">Intro sent</span>
                <span className="connect-modal__action-description">
                  {player.name} will get a text with a link to your profile.
                </span>
              </div>
            ) : canShareIntro ? (
              <div>
                <button
                  type="button"
                  className="connect-modal__action connect-modal__action--full"
                  onClick={onShareIntro}
                  disabled={introStatus === "sending"}
                >
                  <span className="connect-modal__action-title">
                    {introStatus === "sending" ? "Sending…" : "Send quick intro"}
                  </span>
                  <span className="connect-modal__action-description">{introDescription}</span>
                </button>
                {introStatus === "error" && introError ? (
                  <p className="connect-modal__error" role="alert">
                    {introError}
                  </p>
                ) : null}
              </div>
            ) : null}
            <button
              type="button"
              className="connect-modal__action connect-modal__action--primary"
              onClick={onCreateMatch}
            >
              <span className="connect-modal__action-title">Create MatchPlay invite</span>
              <span className="connect-modal__action-description">
                Jump into the match builder with this player pre-selected.
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConnectPlayerModal;
