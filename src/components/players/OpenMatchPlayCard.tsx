import { useLocation, useNavigate } from "react-router-dom";
import { Calendar, MapPin, Swords, Users } from "lucide-react";

import { getMatchSpots } from "../../play-dates/services/matches";
import { getAvatarInitials, getProfileImageFromSource } from "../../play-dates/utils/avatar";
import { isCurrentUserInMatch } from "./openMatchPlayCardState.js";

import "./OpenMatchPlayCard.css";

// Raw backend match (listMatches returns these un-normalized). We read fields
// defensively because key names vary across the API surface.
type MatchRecord = Record<string, unknown>;

type Spots = { joined: number; total: number | null; spotsLeft: number | null };

export interface OpenMatchPlayCardProps {
  match: MatchRecord;
  onJoin?: (matchId: string) => void;
  joining?: boolean;
  currentUserId?: string | number | null;
  // Authoritative host id for this listing (the profile owner — every card here
  // is created_by them). Fallback when the match object omits a host-id field.
  hostId?: string | number | null;
}

const firstString = (...values: unknown[]): string => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
};

const toNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const asRecord = (value: unknown): MatchRecord =>
  value && typeof value === "object" ? (value as MatchRecord) : {};

// Mirrors normalizeNtrpLevel + formatSkillRange in TennisMatchApp.jsx.
const normalizeLevel = (value: unknown): string => {
  if (value === undefined || value === null) {
    return "";
  }
  const trimmed = String(value).trim();
  if (!trimmed) {
    return "";
  }
  if (trimmed === "4.5") {
    return "4.5+";
  }
  return trimmed.replace(/\s*-\s*.*$/, "");
};

const formatLevel = (match: MatchRecord): string => {
  const min = normalizeLevel(
    match.skill_level_min ?? match.skillLevelMin ?? match.levelMin ?? match.skill_level ?? match.skillLevel,
  );
  const maxRaw = normalizeLevel(
    match.skill_level_max ?? match.skillLevelMax ?? match.levelMax ?? match.skill_level ?? match.skillLevel,
  );
  const max = maxRaw || min;
  const range = min && max && min !== max ? `${min} - ${max}` : min || max || "";
  return range ? `${range} NTRP` : "All levels";
};

const formatType = (match: MatchRecord): string => {
  const raw = firstString(match.match_format, match.format, match.type);
  if (!raw) {
    return "Match";
  }
  return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
};

const parseDate = (value: unknown): Date | null => {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    const dateOnly = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (dateOnly) {
      return new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]));
    }
    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
};

const formatDuration = (match: MatchRecord): string => {
  const minutes = toNumber(match.duration_minutes ?? match.durationMinutes);
  if (minutes && minutes > 0) {
    const hours = Math.floor(minutes / 60);
    const remainder = minutes % 60;
    if (hours && remainder) {
      return `${hours}h ${remainder}m`;
    }
    return hours ? `${hours}h` : `${remainder}m`;
  }
  const hours = toNumber(match.duration_hours ?? match.durationHours);
  if (hours && hours > 0) {
    return `${hours}h`;
  }
  return "";
};

const formatWhen = (match: MatchRecord): string => {
  const date = parseDate(match.dateTime ?? match.start_date_time ?? match.startDateTime ?? match.startsAt);
  if (!date) {
    return "Date to be announced";
  }
  const dayLabel = date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  const timeLabel = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const duration = formatDuration(match);
  return duration ? `${dayLabel} · ${timeLabel} · ${duration}` : `${dayLabel} · ${timeLabel}`;
};

const formatLocation = (match: MatchRecord): string =>
  firstString(match.location_text, match.location, match.court_name, match.courtName) ||
  "Location to be announced";

const participantName = (participant: MatchRecord): string => {
  const profile = asRecord(participant.profile);
  const user = asRecord(participant.user);
  return (
    firstString(
      profile.full_name,
      profile.fullName,
      participant.full_name,
      participant.fullName,
      profile.name,
      participant.name,
      user.name,
    ) || "Player"
  );
};

const participantImage = (participant: MatchRecord): string =>
  getProfileImageFromSource(participant.profile) ||
  getProfileImageFromSource(participant.player) ||
  getProfileImageFromSource(participant) ||
  "";

const OpenMatchPlayCard = ({
  match,
  onJoin,
  joining = false,
  currentUserId = null,
  hostId = null,
}: OpenMatchPlayCardProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const matchId = String(match.match_id ?? match.id ?? "");
  const spots = getMatchSpots(match) as Spots;

  // Tapping the card body opens the full match detail (/matches/:id). `from`
  // lets that page's close button return here instead of the matches feed.
  const openDetail = () => {
    if (!matchId) return;
    navigate(`/matches/${matchId}`, {
      state: { from: `${location.pathname}${location.search}` },
    });
  };
  const doubles = /doubles|mixed/i.test(formatType(match));

  const participants = Array.isArray(match.participants) ? (match.participants as MatchRecord[]) : [];
  const total = spots.total ?? participants.length;
  const filled = participants.slice(0, total || participants.length);
  const emptyCount = total ? Math.max(total - filled.length, 0) : 0;

  const { spotsLeft } = spots;
  const isFull = spotsLeft !== null && spotsLeft <= 0;
  const isTight = spotsLeft === 1;

  // You can't join your own match, one you're already in, or one where your
  // invite is already attached.
  const isSelf = isCurrentUserInMatch(match, currentUserId, hostId);

  // Non-member label only; host/joined render a "View Details" button instead.
  const joinLabel = joining ? "Joining…" : isFull ? "Match full" : "Join this match";

  return (
    <article
      className="omp-card omp-card--clickable"
      role="button"
      tabIndex={0}
      aria-label={`View ${formatType(match)} match details`}
      onClick={openDetail}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openDetail();
        }
      }}
    >
      <div className="omp-row1">
        <div className="omp-format">
          <span className="omp-fico" aria-hidden="true">
            {doubles ? <Users size={19} strokeWidth={2} /> : <Swords size={19} strokeWidth={2} />}
          </span>
          <div>
            <div className="omp-fmt">{formatType(match)}</div>
            <div className="omp-lvl">{formatLevel(match)}</div>
          </div>
        </div>
        {spotsLeft !== null ? (
          <div className="omp-spots">
            <div
              className={`omp-spots-num${
                isSelf ? " omp-spots-num--muted" : isTight ? " tight" : ""
              }`}
            >
              {spotsLeft <= 0 ? "Full" : `${spotsLeft} spot${spotsLeft === 1 ? "" : "s"} left`}
            </div>
            {total ? (
              <div className="omp-spots-lbl">
                {spots.joined} of {total}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="omp-detail">
        <Calendar size={15} strokeWidth={2} aria-hidden="true" />
        <span>{formatWhen(match)}</span>
      </div>
      <div className="omp-detail">
        <MapPin size={15} strokeWidth={2} aria-hidden="true" />
        <span>{formatLocation(match)}</span>
      </div>

      {filled.length > 0 || emptyCount > 0 ? (
        <div className="omp-roster">
          {filled.map((participant, index) => {
            const name = participantName(participant);
            const image = participantImage(participant);
            return image ? (
              <img key={`p-${index}`} className="omp-ra" src={image} alt={name} />
            ) : (
              <span key={`p-${index}`} className="omp-ra" role="img" aria-label={name}>
                {getAvatarInitials(name)}
              </span>
            );
          })}
          {Array.from({ length: emptyCount }).map((_, index) => (
            <span key={`e-${index}`} className="omp-ra omp-ra--empty" aria-hidden="true">
              ?
            </span>
          ))}
        </div>
      ) : null}

      {isSelf ? (
        <button
          type="button"
          className="omp-join omp-join--details"
          onClick={(event) => {
            event.stopPropagation();
            openDetail();
          }}
        >
          View Details
        </button>
      ) : (
        <button
          type="button"
          className="omp-join"
          disabled={joining || isFull}
          onClick={(event) => {
            event.stopPropagation();
            onJoin?.(matchId);
          }}
        >
          {joinLabel}
        </button>
      )}
    </article>
  );
};

export default OpenMatchPlayCard;
