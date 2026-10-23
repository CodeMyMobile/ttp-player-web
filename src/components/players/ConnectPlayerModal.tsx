import type { Player } from "../../data/mockPlayers";
import type { HitRequestSendStatus } from "../../hooks/useHitRequest";

import "./ConnectPlayerModal.css";

type ConnectPlayerModalProps = {
  isOpen: boolean;
  player: Player | null;
  onClose: () => void;
  onRequestHit: () => void;
  onCreateMatch: () => void;
  senderAvailability?: string[];
  senderCourts?: string | null;
  /** The API can text this player a hit request. */
  canRequestHit?: boolean;
  /** Where the hit request is up to; see useHitRequest. */
  hitRequestStatus?: HitRequestSendStatus;
  hitRequestError?: string | null;
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
  onRequestHit,
  onCreateMatch,
  senderAvailability,
  senderCourts,
  canRequestHit = false,
  hitRequestStatus = "idle",
  hitRequestError = null,
}: ConnectPlayerModalProps) => {
  if (!isOpen || !player) {
    return null;
  }

  const availability = formatAvailability(senderAvailability);
  const hasAvailability = availability.length > 0;
  const trimmedCourts = senderCourts?.trim();

  return (
    <div className="connect-modal" role="dialog" aria-modal="true" aria-label="Connect with player">
      <div className="connect-modal__backdrop" onClick={onClose} aria-hidden="true" />
      <div className="connect-modal__panel">
        <div className="connect-modal__header">
          <div>
            <p className="connect-modal__eyebrow">Connect with</p>
            <h2 className="connect-modal__title">{player.name}</h2>
            <p className="connect-modal__subtitle">
              {canRequestHit
                ? "Ask to hit, or spin up a MatchPlay invite with a time and place."
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
            {canRequestHit && (hitRequestStatus === "sent" || hitRequestStatus === "connected") ? (
              <div className="connect-modal__status" role="status">
                <span className="connect-modal__action-title">
                  {hitRequestStatus === "connected" ? "You're connected" : "Request sent"}
                </span>
                <span className="connect-modal__action-description">
                  {hitRequestStatus === "connected"
                    ? `${player.name} had already asked you. We've texted you each other's numbers.`
                    : `We'll text you ${player.name}'s number if they accept.`}
                </span>
              </div>
            ) : canRequestHit ? (
              <div>
                <button
                  type="button"
                  className="connect-modal__action connect-modal__action--full"
                  onClick={onRequestHit}
                  disabled={hitRequestStatus === "sending"}
                >
                  <span className="connect-modal__action-title">
                    {hitRequestStatus === "sending" ? "Sending…" : "Ask to hit"}
                  </span>
                  <span className="connect-modal__action-description">
                    We'll text {player.name} your request. If they accept, you'll both get each other's numbers.
                  </span>
                </button>
                {hitRequestStatus === "error" && hitRequestError ? (
                  <p className="connect-modal__error" role="alert">
                    {hitRequestError}
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
