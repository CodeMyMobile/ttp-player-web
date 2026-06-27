import { User, Users, MapPin, Lock } from "lucide-react";

import { getAvatarInitials } from "../../utils/avatar";
import { uniqueActiveParticipants } from "../../utils/participants";

// The "✓ you've played" host-trust signal needs the /player/played-with
// endpoint, which isn't live yet. Render the row but keep the checkmark dark
// (always "new to you") until the data lands — flip this flag then.
const HAS_PLAYED_WITH_ENABLED = false;

const normalizeNtrp = (value) =>
  value === null || value === undefined ? "" : String(value).replace(/[^\d.]/g, "");

const MatchCard = ({ match, handleViewDetails, userNtrp, formatMatchTimeLabel, formatDistanceLabel }) => {
  const isHosted = match.type === "hosted";
  const isJoined = match.type === "joined";
  const isMine = isHosted || isJoined;
  const isPrivate = match.privacy === "private";
  const statusValue =
    typeof match.status === "string" ? match.status.toLowerCase() : match.status;
  const isArchived = statusValue === "archived";

  const formatLabel = match.format || "Match";
  const isDoubles = /doubles|dingles|round\s*robin|mixed/i.test(formatLabel);

  const levelLabel = match.skillLevel || "All levels";
  const matchNtrp = normalizeNtrp(match.skillLevel);
  const fitsYou = Boolean(matchNtrp && normalizeNtrp(userNtrp) && normalizeNtrp(userNtrp) === matchNtrp);
  const levelChipText = fitsYou ? `${levelLabel} · fits you` : levelLabel;

  const timeLabel = formatMatchTimeLabel(match);
  const distanceLabel = formatDistanceLabel(match.distanceMiles);

  const hostName =
    match.hostName ||
    match.hostProfile?.full_name ||
    match.hostProfile?.fullName ||
    match.hostProfile?.name ||
    "Host";
  const hostNtrp = match.hostNtrp || match.hostProfile?.usta_rating || "";
  // Per-match "played with this host" data isn't available yet (see flag above).
  const hasPlayedWithHost = HAS_PLAYED_WITH_ENABLED && false;

  const filledAvatars = uniqueActiveParticipants(match.participants || [])
    .slice(0, 4)
    .map((participant, index) => {
      const profile = participant?.profile || {};
      const name =
        profile.full_name ||
        profile.fullName ||
        participant.full_name ||
        participant.fullName ||
        profile.name ||
        participant.name ||
        `Player ${index + 1}`;
      return {
        key:
          participant.id ||
          participant.player_id ||
          participant.user_id ||
          `${match.id}-participant-${index}`,
        name,
      };
    });

  const spotsAvailable = Number.isFinite(match.spotsAvailable) ? Math.max(match.spotsAvailable, 0) : null;
  const isFull = spotsAvailable === 0;
  const emptySlots = spotsAvailable == null ? 0 : Math.min(spotsAvailable, Math.max(0, 4 - filledAvatars.length));
  const spotsLabel =
    spotsAvailable == null
      ? Number.isFinite(match.playerLimit)
        ? `${match.occupied}/${match.playerLimit}`
        : `${match.occupied} in`
      : isFull
      ? "Full"
      : `${spotsAvailable} left`;
  const spotsTone =
    spotsAvailable == null || isFull
      ? "text-slate-400"
      : spotsAvailable <= 2
      ? "text-amber-700"
      : "text-emerald-700";

  const confirmedLabel = Number.isFinite(match.playerLimit)
    ? `${match.occupied} of ${match.playerLimit} confirmed`
    : `${match.occupied} confirmed`;

  return (
    <button
      type="button"
      onClick={() => handleViewDetails(match.id)}
      className={`flex w-full flex-col rounded-[16px] border border-slate-200 bg-white p-[14px] text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
        isMine ? "border-l-[3px] border-l-violet-500" : ""
      } ${isArchived ? "opacity-80" : ""}`}
    >
      <div className="flex items-start gap-[11px]">
        <div className="flex h-[42px] w-[42px] flex-none items-center justify-center rounded-[12px] bg-violet-100 text-violet-700">
          {isDoubles ? <Users className="h-[21px] w-[21px]" /> : <User className="h-[21px] w-[21px]" />}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[16px] font-extrabold text-slate-900">{formatLabel}</span>
            <span
              className={`rounded-[8px] px-[9px] py-[3px] text-[12px] font-extrabold ${
                fitsYou ? "bg-emerald-50 text-emerald-700" : "bg-violet-100 text-violet-700"
              }`}
            >
              {levelChipText}
            </span>
            {isPrivate ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-[7px] py-[2px] text-[9.5px] font-extrabold uppercase tracking-wide text-violet-700">
                <Lock className="h-2.5 w-2.5" />
                Private
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-[7px] py-[2px] text-[9.5px] font-extrabold uppercase tracking-wide text-emerald-700">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
                Open
              </span>
            )}
            {isHosted ? (
              <span className="rounded-full bg-amber-100 px-[7px] py-[2px] text-[9.5px] font-extrabold uppercase tracking-wide text-amber-700">
                Hosting
              </span>
            ) : isJoined ? (
              <span className="rounded-full bg-amber-100 px-[7px] py-[2px] text-[9.5px] font-extrabold uppercase tracking-wide text-amber-700">
                Joined
              </span>
            ) : null}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[12.5px] font-semibold text-slate-500">
            <MapPin className="h-3.5 w-3.5 text-slate-400" />
            <span className="truncate">{match.location || "Location TBA"}</span>
            {distanceLabel && <span>· {distanceLabel}</span>}
          </div>
        </div>

        {timeLabel && (
          <div className="flex-none text-right">
            <div className="text-[15px] font-extrabold text-slate-900">{timeLabel}</div>
          </div>
        )}
      </div>

      <div className="mt-[13px] flex items-center justify-between gap-3 border-t border-slate-100 pt-[12px]">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-violet-600 text-[11px] font-extrabold text-white">
            {getAvatarInitials(hostName).slice(0, 2)}
          </span>
          <div className="min-w-0">
            <div className="truncate text-[12.5px] font-extrabold text-slate-900">
              {isHosted ? "You're hosting" : hostName}
            </div>
            <div className="truncate text-[10.5px] font-bold text-slate-400">
              {isHosted ? (
                confirmedLabel
              ) : (
                <>
                  {hostNtrp ? `${hostNtrp} · ` : ""}
                  {hasPlayedWithHost ? (
                    <span className="text-emerald-700">✓ you&apos;ve played</span>
                  ) : (
                    "new to you"
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-[9px]">
          <div className="flex">
            {filledAvatars.map((player) => (
              <span
                key={player.key}
                title={player.name}
                className="-ml-2 flex h-[27px] w-[27px] items-center justify-center rounded-full border-2 border-white bg-gradient-to-br from-violet-500 to-violet-600 text-[9.5px] font-extrabold text-white first:ml-0"
              >
                {getAvatarInitials(player.name).slice(0, 2)}
              </span>
            ))}
            {Array.from({ length: emptySlots }).map((_, index) => (
              <span
                key={`empty-${index}`}
                className="-ml-2 h-[27px] w-[27px] rounded-full border-2 border-dashed border-slate-300 bg-white first:ml-0"
                aria-hidden="true"
              />
            ))}
          </div>
          <span className={`text-[12px] font-extrabold ${spotsTone}`}>{spotsLabel}</span>
        </div>
      </div>
    </button>
  );
};

export default MatchCard;
