import { useState } from "react";
import moment from "moment";
import {
  MapPin,
  Users,
  Clock,
  Layers,
  Share2,
  CheckCircle2,
  Hourglass,
  AlertTriangle,
  Circle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Lesson } from "../api/playerLessons";
import "./LessonDetailCard.css";

type LessonDetailCardProps = {
  lesson: Lesson;
  statusLabel?: string;
  onShare?: (lesson: Lesson) => void;
  currentUserId?: string | number;
  footerActionLabel?: string;
  onFooterAction?: (lesson: Lesson) => void;
  footerActionTone?: "neutral" | "danger";
  footerActionDisabled?: boolean;
};

type StatusTone = "success" | "pending" | "danger" | "neutral";

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
const discountCalc = (bill: number, discount = 0) => {
  const percentage = clamp(discount, 0, 100);
  return Math.round((bill - (bill * percentage) / 100) * 100) / 100;
};
const percentageCalc = (percentage: number, amount: number) =>
  Math.round(((percentage / 100) * amount) * 100) / 100;

const resolveStatus = (
  lesson: Lesson,
  statusLabel?: string,
  currentUserId?: string | number,
): { label: string; tone: StatusTone } => {
  if (statusLabel) {
    const normalized = statusLabel.toLowerCase();
    if (normalized.includes("confirm")) return { label: statusLabel, tone: "success" };
    if (normalized.includes("pending") || normalized.includes("wait")) return { label: statusLabel, tone: "pending" };
    if (normalized.includes("cancel")) return { label: statusLabel, tone: "danger" };
    if (normalized.includes("reserved")) return { label: statusLabel, tone: "neutral" };
    if (normalized.includes("book")) return { label: statusLabel, tone: "success" };
    return { label: statusLabel, tone: "neutral" };
  }

  const lessonRecord = lesson as Record<string, unknown>;
  const fallbackUserId = (() => {
    if (currentUserId != null) return currentUserId;
    if (typeof window === "undefined") return undefined;
    try {
      const loginRaw = localStorage.getItem("authLoginResponse");
      const profileRaw = localStorage.getItem("playerPersonalDetails");
      const login = loginRaw ? JSON.parse(loginRaw) : null;
      const profile = profileRaw ? JSON.parse(profileRaw) : null;
      return (
        login?.user_id ??
        login?.profile?.user_id ??
        profile?.user_id ??
        profile?.id ??
        undefined
      );
    } catch {
      return undefined;
    }
  })();
  const playerId =
    fallbackUserId ??
    lessonRecord.player_id ??
    lessonRecord.playerId ??
    lessonRecord.playerID;
  const lessonTypeName = String(lessonRecord.lesson_type_name ?? "").toLowerCase();
  const typeId = Number(lessonRecord.lessontype_id ?? lessonRecord.lesson_type_id ?? lessonRecord.lessonTypeId);
  const isGroupLesson = typeId === 2 || typeId === 3 || typeId === 4 || lessonTypeName.includes("group");
  const groupPlayers = Array.isArray(lessonRecord.group_players) ? lessonRecord.group_players : [];
  const playerRecord =
    playerId != null
      ? groupPlayers.find((player) => {
          const playerData = player as Record<string, unknown>;
          const candidateId = playerData.player_id ?? playerData.id ?? playerData.user_id;
          return candidateId != null && String(candidateId) === String(playerId);
        })
      : undefined;
  const derivedStatus = playerRecord
    ? (playerRecord as Record<string, unknown>).payment_status ?? (playerRecord as Record<string, unknown>).status
    : lessonRecord.status;
  const numericStatus =
    typeof derivedStatus === "number" ? derivedStatus : Number(derivedStatus);
  if (typeof numericStatus === "number") {
    if (numericStatus === 0) return { label: "Pending", tone: "pending" };
    if (numericStatus === 1) return { label: "Confirmed", tone: "success" };
    if (numericStatus === 2) return { label: "Cancelled", tone: "danger" };
  }
  if (isGroupLesson && lessonTypeName.includes("open group")) {
    return { label: "Pending", tone: "pending" };
  }

  return { label: "Lesson", tone: "neutral" };
};

const LessonDetailCard = ({
  lesson,
  statusLabel,
  onShare,
  currentUserId,
  footerActionLabel,
  onFooterAction,
  footerActionTone = "neutral",
  footerActionDisabled = false,
}: LessonDetailCardProps) => {
  console.log("Rendering LessonDetailCard for lesson ID:", lesson.id,currentUserId);
  // Align time handling with mobile: treat API timestamps as UTC and provide a 1h fallback if end is missing
  const start = moment.utc(lesson.start_date_time);
  const end = lesson.end_date_time
    ? moment.utc(lesson.end_date_time)
    : start.clone().add(1, "hour");
  const startTimeLabel = start.format("hh:mm a");
  const endTimeLabel = end.isValid() ? end.format("hh:mm a") : "";
  const durationMinutes = end.isValid() ? Math.max(end.diff(start, "minutes"), 0) : 0;
  const durationLabel = end.isValid() ? `${durationMinutes} mins` : "";
  const record = lesson as Record<string, unknown>;
  const level = lesson.metadata?.level || lesson.metadata_level;
  const lessonTypeName =
    lesson.lesson_type_name ??
    (typeof record.lesson_type_name === "string" ? record.lesson_type_name : undefined);
  const typeId = Number(record.lessontype_id ?? record.lesson_type_id ?? record.lessonTypeId);
  const normalizedTypeLabel = (lessonTypeName ?? "").toLowerCase();
  const isPrivateLesson = typeId === 1 || normalizedTypeLabel === "private";
  const isGroupLesson =
    typeId === 2 ||
    typeId === 3 ||
    typeId === 4 ||
    normalizedTypeLabel.includes("group") ||
    normalizedTypeLabel.includes("semi");
  const groupPlayers = Array.isArray(lesson?.group_players)
    ? lesson.group_players
    : Array.isArray(record.group_players)
      ? record.group_players
      : [];
  const [playersOpen, setPlayersOpen] = useState(false);
  const confirmedCount = groupPlayers.filter((player) => (player as Record<string, unknown>).status === 1).length;
  const pendingCount = groupPlayers.filter((player) => (player as Record<string, unknown>).status === 0).length;
  const cancelledCount = groupPlayers.filter((player) => (player as Record<string, unknown>).status === 2).length;
  const showStatusCounts = isGroupLesson && groupPlayers.length > 0;
  const privateName =
    (typeof record.full_name === "string" ? record.full_name : undefined) || lesson.coach_name;
  const title = isPrivateLesson
    ? privateName || lessonTypeName || "Private lesson"
    : lesson.metadata?.title || lesson.metadata_title || lessonTypeName || "Lesson";
  const locationName =
    lesson.location_name ||
    (typeof record.location === "string" ? record.location : undefined) ||
    (typeof record.location_name === "string" ? record.location_name : undefined);
  const court = record.court ?? record.court_id ?? record.courtId;
  const hasCourt =
    court !== null &&
    court !== undefined &&
    String(court).trim() !== "" &&
    Number(court) !== 0;
  const locationLabel = locationName && hasCourt ? `${locationName}, Court#${court}` : locationName;
  const cancelledByCoach =
    (record.status ?? lesson.status) === 2 &&
    record.created_by != null &&
    record.updated_by != null &&
    record.created_by === record.updated_by;
  const availabilityPill = (() => {
    const isExternal = Boolean((lesson.metadata as Record<string, unknown> | undefined)?.externalUrl);
    if (isExternal) {
      return { label: "External", tone: "external" as const };
    }
    if (typeId === 3) {
      const limitRaw = record.player_limit ?? lesson.player_limit;
      const limit = typeof limitRaw === "number" ? limitRaw : Number(limitRaw);
      if (!Number.isFinite(limit) || limit <= 0) return null;
      const confirmed = groupPlayers.filter((player) => {
        const playerRecord = player as Record<string, unknown>;
        return playerRecord.status === 1 || playerRecord.payment_status === 1;
      }).length;
      const available = Math.max(limit - confirmed, 0);
      return {
        label: `Avail. spots: ${available}/${limit}`,
        tone: available > 0 ? ("available" as const) : ("full" as const),
      };
    }
    if (typeId === 2) return { label: "Semi-Private Lesson", tone: "neutral" as const };
    if (typeId === 1) return { label: "Private Lesson", tone: "neutral" as const };
    return null;
  })();
  const parseMoney = (value: unknown) => {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "string" && value.trim()) {
      const parsed = Number.parseFloat(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
    return null;
  };
  const groupPriceValue =
    parseMoney(lesson.price_per_person) ??
    parseMoney(record.price_per_person) ??
    parseMoney(record.group_price_per_person) ??
    parseMoney(record.groupPricePerPerson);
  const hourlyRateValue =
    parseMoney(record.hourly_rate) ??
    parseMoney(record.hourlyRate);
  const discountPercentage =
    parseMoney(record.discount_percentage) ??
    parseMoney(record.discountPercentage) ??
    parseMoney((lesson as Record<string, unknown>).discount_percentage) ??
    0;
  const resolvedPrimary = groupPriceValue ?? hourlyRateValue ?? null;
  const priceLabel = resolvedPrimary != null ? `$${resolvedPrimary.toFixed(2)}` : null;
  const priceSuffix = groupPriceValue != null ? "per player" : "per hour";
  const secondaryPrice =
    groupPriceValue != null && hourlyRateValue != null && groupPriceValue !== hourlyRateValue
      ? {
          label: `Hourly: $${hourlyRateValue.toFixed(2)}`,
        }
      : groupPriceValue == null && hourlyRateValue != null && lesson.price_per_person != null
        ? {
            label: `Per player: $${parseMoney(lesson.price_per_person)?.toFixed(2) ?? ""}`,
          }
        : null;
  const SERVICE_FEE = 1;
  const CREDIT_FEE_PERCENTAGE = 3;
  const isGroupPricing = groupPriceValue != null;
  const baseRate = isGroupPricing ? groupPriceValue : hourlyRateValue;
  const discountedRate = baseRate != null ? discountCalc(baseRate, discountPercentage) : null;
  const creditFee = discountedRate != null ? percentageCalc(CREDIT_FEE_PERCENTAGE, discountedRate) : null;
  const totalFee =
    discountedRate != null && creditFee != null ? discountedRate + creditFee + SERVICE_FEE : null;
  const resolvePlayerStatus = (player: Record<string, unknown>) => {
    const raw = player.payment_status ?? player.status;
    const parsed = typeof raw === "number" ? raw : Number(raw);
    if (parsed === 1) return { label: "Confirmed", tone: "success" as const };
    if (parsed === 2) return { label: "Cancelled", tone: "danger" as const };
    return { label: "Pending", tone: "pending" as const };
  };

  const status = resolveStatus(lesson, statusLabel, currentUserId);

  return (
    <article className="lesson-detail-card">
      <div className="lesson-detail-card__date">
        <span className="lesson-detail-card__day">{start.format("DD")}</span>
        <span className="lesson-detail-card__month">{start.format("MMM")}</span>
      </div>

      <div className="lesson-detail-card__body">
        <header className="lesson-detail-card__header">
          <div>
            <h3 className="lesson-detail-card__title">{title}</h3>
            {locationLabel ? (
              <p className="lesson-detail-card__meta">
                <MapPin size={16} /> {locationLabel}
              </p>
            ) : null}
            <p className="lesson-detail-card__meta">
              <Clock size={16} /> {startTimeLabel}
              {endTimeLabel ? ` - ${endTimeLabel}` : ""}{durationLabel ? ` • ${durationLabel}` : ""}
            </p>
            <div className="lesson-detail-card__chips">
              {lesson.lesson_type_name ? (
                <span className="lesson-detail-card__chip">
                  <Layers size={14} /> {lesson.lesson_type_name}
                </span>
              ) : null}
              {level ? (
                <span className="lesson-detail-card__chip lesson-detail-card__chip--muted">
                  Level {level}
                </span>
              ) : null}
              {typeof lesson.player_limit === "number" ? (
                <span className="lesson-detail-card__chip lesson-detail-card__chip--muted">
                  <Users size={14} /> {lesson.current_player_count ?? 0}/{lesson.player_limit} spots
                </span>
              ) : null}
            </div>
            <div className="lesson-detail-card__pill-row">
              {showStatusCounts && confirmedCount > 0 ? (
                <span className="lesson-detail-card__pill lesson-detail-card__pill--confirm">
                  {confirmedCount} Confirmed
                </span>
              ) : null}
              {showStatusCounts && pendingCount > 0 ? (
                <span className="lesson-detail-card__pill lesson-detail-card__pill--pending">
                  {pendingCount} Pending
                </span>
              ) : null}
              {showStatusCounts && cancelledCount > 0 ? (
                <span className="lesson-detail-card__pill lesson-detail-card__pill--cancel">
                  {cancelledCount} Cancelled
                </span>
              ) : null}
              {availabilityPill ? (
                <span className={`lesson-detail-card__pill lesson-detail-card__pill--${availabilityPill.tone}`}>
                  {availabilityPill.label}
                </span>
              ) : null}
              {/* {lessonTypeName ? (
                <span className="lesson-detail-card__pill lesson-detail-card__pill--type">
                  {lessonTypeName.toUpperCase()}
                </span>
              ) : null} */}
              {cancelledByCoach ? (
                <span className="lesson-detail-card__pill lesson-detail-card__pill--coach-cancel">
                  CANCELLED BY COACH
                </span>
              ) : null}
            </div>
          </div>

          <div className={`lesson-detail-card__status lesson-detail-card__status--${status.tone}`}>
            {status.tone === "success" && <CheckCircle2 size={16} />}
            {status.tone === "pending" && <Hourglass size={16} />}
            {status.tone === "danger" && <AlertTriangle size={16} />}
            {status.tone === "neutral" && <Circle size={14} />}
            <span>{status.label}</span>
          </div>
        </header>

        {lesson.metadata?.description ? (
          <p className="lesson-detail-card__description">{lesson.metadata.description}</p>
        ) : null}

        {showStatusCounts ? (
          <div className="lesson-detail-card__players">
            <button
              type="button"
              className="lesson-detail-card__players-toggle"
              onClick={() => setPlayersOpen((prev) => !prev)}
            >
              <span>Players</span>
              <span className="lesson-detail-card__players-count">
                {confirmedCount} confirmed
                {typeof lesson.player_limit === "number" ? ` / ${lesson.player_limit}` : ""}
              </span>
              {playersOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            {playersOpen ? (
              <ul className="lesson-detail-card__players-list">
                {groupPlayers.map((player) => {
                  const playerRecord = player as Record<string, unknown>;
                  const name = String(playerRecord.full_name ?? "Player");
                  const status = resolvePlayerStatus(playerRecord);
                  return (
                    <li key={`${playerRecord.player_id ?? name}`} className="lesson-detail-card__players-item">
                      <span>{name}</span>
                      <span className={`lesson-detail-card__players-status lesson-detail-card__players-status--${status.tone}`}>
                        {status.label}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
        ) : null}

        <footer className="lesson-detail-card__footer">
          {priceLabel ? (
            <div className="lesson-detail-card__price">
              {priceLabel}
              <span>{priceSuffix}</span>
              {secondaryPrice ? <span className="lesson-detail-card__price-sub">{secondaryPrice.label}</span> : null}
              {totalFee != null ? (
                <div className="lesson-detail-card__price-breakdown">
                  <span>Total: ${totalFee.toFixed(2)}</span>
                  {creditFee != null ? <span>Credit 3%: ${creditFee.toFixed(2)}</span> : null}
                  <span>Service fee: $1.00</span>
                  {discountPercentage > 0 ? (
                    <span>Discount: {discountPercentage}%</span>
                  ) : null}
                  {discountedRate != null ? (
                    <span>Coach fee: ${discountedRate.toFixed(2)}</span>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
          {onShare ? (
            <button
              type="button"
              className="lesson-detail-card__share"
              onClick={() => onShare(lesson)}
            >
              <Share2 size={16} />
              Share lesson
            </button>
          ) : null}
          {footerActionLabel && onFooterAction ? (
            <button
              type="button"
              className={`lesson-detail-card__action lesson-detail-card__action--${footerActionTone}`}
              onClick={() => onFooterAction(lesson)}
              disabled={footerActionDisabled}
            >
              {footerActionLabel}
            </button>
          ) : null}
        </footer>
      </div>
    </article>
  );
};

export default LessonDetailCard;
