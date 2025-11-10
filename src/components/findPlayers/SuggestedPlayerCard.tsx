import { MapPin, Phone, Send } from "lucide-react";

import styles from "./SuggestedPlayerCard.module.css";

export interface SuggestedPlayer {
  id?: number | string;
  user_id?: number | string;
  full_name?: string;
  name?: string;
  profile_picture?: string | null;
  avatar?: string | null;
  status?: number | string | null;
  distance?: string | number | null;
  distanceMiles?: number | null;
  rating?: number | string | null;
  phone_number?: string | null;
  [key: string]: unknown;
}

export interface SuggestedPlayerCardProps {
  player: SuggestedPlayer;
  onViewDetails: (player: SuggestedPlayer) => void;
  onContact?: (player: SuggestedPlayer) => void;
}

const deriveInitials = (value: string | null | undefined) => {
  if (!value) return "MP";
  const parts = value.split(" ").filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return value.slice(0, 2).toUpperCase();
};

const normalizeName = (player: SuggestedPlayer) =>
  (player.full_name || player.name || player.nickname || "Matchplay Player").toString();

const normalizeDistance = (player: SuggestedPlayer) => {
  if (typeof player.distance === "string" && player.distance.trim()) {
    return player.distance;
  }
  if (typeof player.distanceMiles === "number" && Number.isFinite(player.distanceMiles)) {
    return `${player.distanceMiles.toFixed(1)} mi away`;
  }
  if (typeof player.distance === "number" && Number.isFinite(player.distance)) {
    return `${player.distance.toFixed(1)} mi away`;
  }
  return null;
};

const normalizeStatus = (status: SuggestedPlayer["status"]) => {
  const numericStatus = typeof status === "string" ? Number.parseInt(status, 10) : status;
  switch (numericStatus) {
    case 0:
      return { label: "Pending", className: styles.badgePending };
    case 1:
      return { label: "Confirmed", className: styles.badgeConfirmed };
    case 2:
      return { label: "Cancelled", className: styles.badgeCancelled };
    default:
      return { label: "New", className: styles.badgeNew };
  }
};

const SuggestedPlayerCard = ({ player, onViewDetails, onContact }: SuggestedPlayerCardProps) => {
  const name = normalizeName(player);
  const distanceLabel = normalizeDistance(player);
  const { label: statusLabel, className: statusClass } = normalizeStatus(player.status);
  const avatar = player.profile_picture || player.avatar;

  return (
    <article className={styles.card}>
      <div className={styles.avatar} aria-hidden={!avatar}>
        {avatar ? <img src={avatar} alt={`${name} profile`} loading="lazy" /> : deriveInitials(name)}
      </div>
      <div className={styles.body}>
        <div className={styles.nameRow}>
          <span className={styles.name}>{name}</span>
          <span className={`${styles.badge} ${statusClass}`}>{statusLabel}</span>
        </div>
        <div className={styles.meta}>
          {distanceLabel ? (
            <span>
              <MapPin size={14} aria-hidden /> {distanceLabel}
            </span>
          ) : null}
          {player.rating ? <span>Rating: {player.rating}</span> : null}
          {player.match_type ? <span>{String(player.match_type)}</span> : null}
        </div>
      </div>
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.primaryButton}
          onClick={() => onViewDetails(player)}
        >
          <Send size={16} aria-hidden /> View details
        </button>
        {player.phone_number ? (
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() => onContact?.(player)}
          >
            <Phone size={16} aria-hidden /> Contact
          </button>
        ) : null}
      </div>
    </article>
  );
};

export default SuggestedPlayerCard;
