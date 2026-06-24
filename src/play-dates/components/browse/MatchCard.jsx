import { Lock, Globe2, Check, MapPin } from "lucide-react";

import { getAvatarInitials } from "../../utils/avatar";
import { uniqueActiveParticipants } from "../../utils/participants";

// Extracted verbatim from TennisMatchApp.jsx (Step 0 — pure move, no behavior
// or style changes). All state/handlers/helpers are passed in as props from the
// parent so this stays a presentational component.
const MatchCard = ({ match, handleViewDetails, formatMatchTimeLabel, formatDistanceLabel }) => {
    const isHosted = match.type === "hosted";
    const isJoined = match.type === "joined";
    const statusValue =
      typeof match.status === "string" ? match.status.toLowerCase() : match.status;
    const isArchived = statusValue === "archived";
    const isPrivate = match.privacy === "private";
    const isMine = isHosted || isJoined;
    const skillRangeLabel = match.skillLevel || "All levels";
    const genderLabel = match.gender || "Any";
    const playerCapacityLabel = Number.isFinite(match.playerLimit)
      ? `${match.occupied}/${match.playerLimit} players`
      : `${match.occupied} players`;
    const rosterStatusLabel = (() => {
      if (Number.isFinite(match.spotsAvailable)) {
        if (match.spotsAvailable <= 0) return "Full";
        return `${match.spotsAvailable} ${match.spotsAvailable === 1 ? "spot" : "spots"}`;
      }
      return playerCapacityLabel;
    })();
    const timeLabel = formatMatchTimeLabel(match);
    const distanceLabel = formatDistanceLabel(match.distanceMiles);
    const hostName =
      match.hostName ||
      match.hostProfile?.full_name ||
      match.hostProfile?.fullName ||
      match.hostProfile?.name ||
      "Host";
    const hostNtrp = match.hostNtrp || match.hostProfile?.usta_rating || "";
    const participantStack = uniqueActiveParticipants(match.participants || [])
      .slice(0, 5)
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
    const extraParticipantCount = Math.max((Number(match.occupied) || 0) - participantStack.length, 0);
    const genderSymbol =
      genderLabel === "Men's"
        ? "♂"
        : genderLabel === "Women's"
        ? "♀"
        : genderLabel === "Mixed"
        ? "⚥"
        : "";
    const rosterTone =
      rosterStatusLabel === "Full"
        ? "bg-emerald-100 text-emerald-700"
        : rosterStatusLabel.startsWith("1 ") || rosterStatusLabel.startsWith("2 ")
        ? "bg-amber-100 text-amber-600"
        : "bg-slate-100 text-slate-500";

    return (
      <button
        type="button"
        onClick={() => handleViewDetails(match.id)}
        className={`relative flex min-h-[214px] flex-col overflow-hidden rounded-[18px] border border-slate-200 bg-white p-[22px] text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg ${
          isArchived ? "opacity-80" : ""
        }`}
      >
        <span
          className={`absolute inset-y-0 left-0 w-[3px] ${
            isPrivate ? "bg-violet-500" : "bg-emerald-500"
          }`}
          aria-hidden="true"
        />
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex h-5 items-center gap-1 rounded-full px-2.5 text-[10px] font-black uppercase tracking-wide ${
                isPrivate
                  ? "bg-violet-100 text-violet-700"
                  : "bg-emerald-100 text-emerald-700"
              }`}
            >
              {isPrivate ? <Lock className="h-3 w-3" /> : <Globe2 className="h-3 w-3" />}
              {isPrivate ? "Private" : "Open"}
            </span>
            {isHosted && (
              <span className="inline-flex h-5 items-center rounded-full bg-violet-100 px-2.5 text-[10px] font-black uppercase tracking-wide text-violet-700">
                Hosting
              </span>
            )}
            {isJoined && !isHosted && (
              <span className="inline-flex h-5 items-center rounded-full bg-slate-100 px-2.5 text-[10px] font-black uppercase tracking-wide text-slate-700">
                Joined
              </span>
            )}
            {match.verifiedOnly && (
              <span className="inline-flex h-5 items-center gap-1 rounded-full bg-blue-100 px-2.5 text-[10px] font-black uppercase tracking-wide text-blue-700">
                <Check className="h-3 w-3" />
                Verified
              </span>
            )}
          </div>
          {timeLabel && (
            <span className="shrink-0 text-[13px] font-black text-slate-500">{timeLabel}</span>
          )}
        </div>

        <div>
          <p className="text-[19px] font-black leading-tight tracking-[-0.02em] text-slate-950">
            {match.format || "Match"}
            <span className="font-semibold text-slate-500"> · {skillRangeLabel}</span>
            {genderLabel !== "Any" && (
              <span className="ml-2 inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 align-middle text-[11px] font-black text-slate-700">
                {genderSymbol && `${genderSymbol} `}
                {genderLabel}
              </span>
            )}
          </p>
          <p className="mt-2.5 flex items-center gap-1.5 text-[13px] font-semibold text-slate-500">
            <MapPin className="h-3.5 w-3.5" />
            <span className="truncate">{match.location || "Location TBA"}</span>
            {distanceLabel && <span>· {distanceLabel}</span>}
          </p>
        </div>

        {!isMine && (
          <div className="mt-3.5 flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-white bg-gradient-to-br from-violet-500 to-violet-700 text-[10px] font-black text-white">
              {getAvatarInitials(hostName).slice(0, 2)}
            </span>
            <span className="min-w-0 flex-1 truncate text-[11px] font-bold text-slate-700">
              Hosted by {hostName}
            </span>
            {hostNtrp && (
              <span className="shrink-0 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-black text-violet-700">
                NTRP {hostNtrp}
              </span>
            )}
          </div>
        )}

        <div className="mt-auto flex items-center justify-between gap-4 pt-5">
          <div className="flex items-center gap-4">
            <div className="flex -space-x-2">
              {participantStack.map((player) => (
                <span
                  key={player.key}
                  className="flex h-[34px] w-[34px] items-center justify-center rounded-full border-2 border-white bg-gradient-to-br from-violet-500 to-violet-700 text-[11px] font-black text-white"
                  title={player.name}
                >
                  {getAvatarInitials(player.name).slice(0, 2)}
                </span>
              ))}
              {extraParticipantCount > 0 && (
                <span className="flex h-[34px] min-w-[34px] items-center justify-center rounded-full border-2 border-white bg-slate-100 px-1 text-[11px] font-black text-slate-700">
                  +{extraParticipantCount}
                </span>
              )}
            </div>
            <span className="text-[14px] font-semibold text-slate-500">
              {playerCapacityLabel}
            </span>
          </div>
          <span
            className={`rounded-full px-4 py-1.5 text-[12px] font-black uppercase tracking-[0.12em] ${rosterTone}`}
          >
            {rosterStatusLabel}
          </span>
        </div>
      </button>
    );
};

export default MatchCard;
