import React, { useEffect, useMemo, useState } from "react";
import {
  Users,
  Phone,
  Mail,
  MapPin,
  Calendar,
  History,
  Loader2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import PlayerAvatar from "../components/PlayerAvatar";
import { listMatches } from "../services/matches";
import { formatPhoneDisplay } from "../services/phone";
import {
  getParticipantPhone,
  uniqueActiveParticipants,
} from "../utils/participants";
import { memberMatchesParticipant } from "../utils/memberIdentity";
import { getAvatarUrlFromPlayer } from "../utils/avatar";
import { ARCHIVE_FILTER_VALUE } from "../utils/archive";

const PARTICIPANT_ID_KEYS = [
  "match_participant_id",
  "matchParticipantId",
  "participant_id",
  "participantId",
  "player_id",
  "playerId",
  "invitee_id",
  "inviteeId",
  "user_id",
  "userId",
  "id",
  ["profile", "player_id"],
  ["profile", "playerId"],
  ["profile", "id"],
  ["player", "id"],
  ["player", "player_id"],
  ["player", "playerId"],
  ["user", "id"],
  ["user", "user_id"],
  ["user", "userId"],
];

const MATCH_ID_KEYS = [
  "id",
  "match_id",
  "matchId",
  ["match", "id"],
  ["match", "match_id"],
  ["match", "matchId"],
];

const EMAIL_KEYS = [
  "email",
  "contact_email",
  "contactEmail",
  "inviteeEmail",
  "player_email",
  "playerEmail",
];

const PROFILE_EMAIL_KEYS = [
  ["profile", "email"],
  ["profile", "contact_email"],
  ["profile", "contactEmail"],
  ["player", "email"],
  ["player", "contact_email"],
  ["player", "contactEmail"],
  ["user", "email"],
  ["user", "contact_email"],
  ["user", "contactEmail"],
];

const PROFILE_NAME_KEYS = [
  "full_name",
  "fullName",
  "display_name",
  "displayName",
  "name",
  ["profile", "full_name"],
  ["profile", "fullName"],
  ["profile", "display_name"],
  ["profile", "displayName"],
  ["profile", "name"],
  ["player", "full_name"],
  ["player", "fullName"],
  ["player", "display_name"],
  ["player", "displayName"],
  ["player", "name"],
  ["user", "full_name"],
  ["user", "fullName"],
  ["user", "display_name"],
  ["user", "displayName"],
  ["user", "name"],
];

const PROFILE_SKILL_KEYS = [
  "skill_level",
  "skillLevel",
  "usta_rating",
  "ustaRating",
  "ntrp",
  "rating",
  ["profile", "skill_level"],
  ["profile", "skillLevel"],
  ["profile", "usta_rating"],
  ["profile", "ustaRating"],
  ["profile", "ntrp"],
  ["profile", "rating"],
  ["player", "skill_level"],
  ["player", "skillLevel"],
  ["player", "usta_rating"],
  ["player", "ustaRating"],
  ["player", "ntrp"],
  ["player", "rating"],
];

const PROFILE_HOME_KEYS = [
  "home_court",
  "homeCourt",
  "home_facility",
  "homeFacility",
  "home_club",
  "homeClub",
  ["profile", "home_court"],
  ["profile", "homeCourt"],
  ["profile", "home_facility"],
  ["profile", "homeFacility"],
  ["profile", "home_club"],
  ["profile", "homeClub"],
  ["player", "home_court"],
  ["player", "homeCourt"],
  ["player", "home_facility"],
  ["player", "homeFacility"],
  ["player", "home_club"],
  ["player", "homeClub"],
];

const PROFILE_BIO_KEYS = [
  "about_me",
  "aboutMe",
  "bio",
  ["profile", "about_me"],
  ["profile", "aboutMe"],
  ["profile", "bio"],
  ["player", "about_me"],
  ["player", "aboutMe"],
  ["player", "bio"],
];

const MATCH_NAME_KEYS = [
  "title",
  "name",
  "match_title",
  "matchTitle",
  ["match", "title"],
  ["match", "name"],
];

const MATCH_LOCATION_KEYS = [
  "location_text",
  "locationText",
  "location",
  "venue",
  "court_name",
  "courtName",
  ["match", "location_text"],
  ["match", "locationText"],
  ["match", "location"],
  ["match", "venue"],
  ["match", "court_name"],
  ["match", "courtName"],
  ["location", "name"],
  ["court", "name"],
  ["facility", "name"],
];

const MATCH_FORMAT_KEYS = [
  "match_format",
  "matchFormat",
  "format",
  ["match", "match_format"],
  ["match", "matchFormat"],
  ["match", "format"],
];

const MATCH_DATE_KEYS = [
  "start_date_time",
  "startDateTime",
  "start_time",
  "startTime",
  "date",
  "date_time",
  "dateTime",
  ["match", "start_date_time"],
  ["match", "startDateTime"],
  ["match", "start_time"],
  ["match", "startTime"],
  ["match", "date"],
  ["match", "date_time"],
  ["match", "dateTime"],
];

const pickArrayLike = (...candidates) => {
  for (const candidate of candidates) {
    if (!candidate) continue;
    if (Array.isArray(candidate)) {
      return candidate;
    }
    if (
      candidate &&
      typeof candidate === "object" &&
      !Array.isArray(candidate)
    ) {
      if (Array.isArray(candidate.data)) {
        return candidate.data;
      }
      if (Array.isArray(candidate.items)) {
        return candidate.items;
      }
      if (Array.isArray(candidate.results)) {
        return candidate.results;
      }
    }
  }
  return [];
};

const readValue = (subject, key) => {
  if (!subject || typeof subject !== "object") return undefined;
  if (Array.isArray(key)) {
    return key.reduce((acc, segment) => {
      if (!acc || typeof acc !== "object") return undefined;
      return acc[segment];
    }, subject);
  }
  return subject[key];
};

const pickValueByKeys = (subject, keys) => {
  for (const key of keys) {
    const value = readValue(subject, key);
    if (value === undefined || value === null) continue;
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) return trimmed;
    } else if (typeof value === "number") {
      if (!Number.isNaN(value)) return String(value);
    }
  }
  return "";
};

const normalizeIdentifier = (value) => {
  if (value === null || value === undefined) return null;

  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  if (typeof value === "object" && typeof value.toString === "function") {
    const stringValue = value.toString();
    if (typeof stringValue === "string") {
      const trimmed = stringValue.trim();
      return trimmed.length > 0 ? trimmed : null;
    }
  }

  const numeric = Number(value);
  return Number.isFinite(numeric) ? String(numeric) : null;
};

const extractParticipantId = (participant) => {
  for (const key of PARTICIPANT_ID_KEYS) {
    const candidate = readValue(participant, key);
    const parsed = normalizeIdentifier(candidate);
    if (parsed !== null) {
      return parsed;
    }
  }
  return null;
};

const extractMatchId = (match) => {
  for (const key of MATCH_ID_KEYS) {
    const candidate = readValue(match, key);
    const parsed = normalizeIdentifier(candidate);
    if (parsed !== null) return parsed;
  }
  return null;
};

const extractEmail = (participant) => {
  for (const key of EMAIL_KEYS) {
    const direct = participant?.[key];
    if (typeof direct === "string" && direct.trim()) {
      return direct.trim();
    }
  }
  for (const key of PROFILE_EMAIL_KEYS) {
    const candidate = readValue(participant, key);
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }
  return "";
};

const extractName = (participant, fallbackId) => {
  const name = pickValueByKeys(participant, PROFILE_NAME_KEYS);
  if (name) return name;
  if (fallbackId) return `Player ${fallbackId}`;
  return "Unknown player";
};

const extractSkillLevel = (participant) => pickValueByKeys(participant, PROFILE_SKILL_KEYS);

const extractHomeCourt = (participant) => pickValueByKeys(participant, PROFILE_HOME_KEYS);

const extractBio = (participant) => pickValueByKeys(participant, PROFILE_BIO_KEYS);

const extractAvatarUrl = (participant) =>
  getAvatarUrlFromPlayer({
    player: participant?.player || participant,
    profile: participant?.profile || participant,
    user: participant?.user || participant,
  }) || "";

const extractMatchName = (match, matchId) =>
  pickValueByKeys(match, MATCH_NAME_KEYS) ||
  (matchId ? `Match ${matchId}` : "Match");

const extractMatchLocation = (match) =>
  pickValueByKeys(match, MATCH_LOCATION_KEYS) || "Location TBD";

const extractMatchFormat = (match) => pickValueByKeys(match, MATCH_FORMAT_KEYS);

const extractMatchDate = (match) => {
  for (const key of MATCH_DATE_KEYS) {
    const candidate = readValue(match, key);
    if (!candidate) continue;
    const date = candidate instanceof Date ? candidate : new Date(candidate);
    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  }
  return null;
};

const normalizeMatchRecord = (raw) => {
  if (!raw || typeof raw !== "object") return {};

  if (raw.match && typeof raw.match === "object") {
    const matchData = raw.match;
    const participants = pickArrayLike(
      raw.participants,
      matchData.participants,
      raw.match_participants,
      raw.matchParticipants,
      matchData.match_participants,
      matchData.matchParticipants,
      raw.players,
      matchData.players,
      raw.player_participants,
      raw.playerParticipants,
      matchData.player_participants,
      matchData.playerParticipants,
    );
    const invitees = pickArrayLike(
      raw.invitees,
      matchData.invitees,
      raw.match_invites,
      raw.matchInvites,
      matchData.match_invites,
      matchData.matchInvites,
      raw.invites,
      matchData.invites,
    );

    return {
      ...matchData,
      participants,
      invitees,
    };
  }

  const participants = pickArrayLike(
    raw.participants,
    raw.match_participants,
    raw.matchParticipants,
    raw.players,
    raw.player_participants,
    raw.playerParticipants,
  );
  const invitees = pickArrayLike(
    raw.invitees,
    raw.match_invites,
    raw.matchInvites,
    raw.invites,
  );

  return {
    ...raw,
    participants,
    invitees,
  };
};

const buildPlayerSummaries = (matches, currentUser, memberIdentityIds) => {
  if (!Array.isArray(matches) || matches.length === 0) {
    return [];
  }

  const identityIds = Array.isArray(memberIdentityIds)
    ? memberIdentityIds
    : Array.from(memberIdentityIds || []);

  const playerMap = new Map();

  matches.forEach((rawMatch) => {
    const match = normalizeMatchRecord(rawMatch);
    const matchId = extractMatchId(match);
    const matchDate = extractMatchDate(match);
    const matchName = extractMatchName(match, matchId);
    const matchLocation = extractMatchLocation(match);
    const matchFormat = extractMatchFormat(match);
    const participants = uniqueActiveParticipants(match.participants || []);
    if (participants.length === 0) return;

    const includesCurrentUser = currentUser
      ? participants.some((participant) =>
          memberMatchesParticipant(currentUser, participant, identityIds),
        )
      : true;

    if (!includesCurrentUser) return;

    participants.forEach((participant) => {
      const participantId = extractParticipantId(participant);
      if (!participantId) return;
      if (
        currentUser &&
        memberMatchesParticipant(currentUser, participant, identityIds)
      ) {
        return;
      }

      const existing = playerMap.get(participantId) || {
        id: participantId,
        name: extractName(participant, participantId),
        avatarUrl: extractAvatarUrl(participant),
        skillLevel: extractSkillLevel(participant),
        homeCourt: extractHomeCourt(participant),
        bio: extractBio(participant),
        phone: "",
        phoneRaw: "",
        email: "",
        matches: [],
        lastPlayedAt: null,
      };

      if (!existing.avatarUrl) {
        existing.avatarUrl = extractAvatarUrl(participant);
      }
      if (!existing.skillLevel) {
        existing.skillLevel = extractSkillLevel(participant);
      }
      if (!existing.homeCourt) {
        existing.homeCourt = extractHomeCourt(participant);
      }
      if (!existing.bio) {
        existing.bio = extractBio(participant);
      }

      if (!existing.phoneRaw) {
        const phoneRaw = getParticipantPhone(participant);
        if (phoneRaw) {
          existing.phoneRaw = phoneRaw;
          existing.phone = formatPhoneDisplay(phoneRaw);
        }
      }

      if (!existing.email) {
        existing.email = extractEmail(participant);
      }

      const matchEntry = {
        id: matchId,
        name: matchName,
        location: matchLocation,
        format: matchFormat,
        date: matchDate ? matchDate.toISOString() : null,
      };

      const hasExistingMatch = existing.matches.some(
        (item) => item.id === matchEntry.id && item.date === matchEntry.date,
      );
      if (!hasExistingMatch) {
        existing.matches.push(matchEntry);
      }

      if (matchDate) {
        const timestamp = matchDate.getTime();
        if (!existing.lastPlayedAt || timestamp > existing.lastPlayedAt) {
          existing.lastPlayedAt = timestamp;
        }
      }

      playerMap.set(participantId, existing);
    });
  });

  return Array.from(playerMap.values())
    .map((player) => ({
      ...player,
      matches: player.matches
        .slice()
        .sort((a, b) => {
          const aTime = a.date ? new Date(a.date).getTime() : 0;
          const bTime = b.date ? new Date(b.date).getTime() : 0;
          return bTime - aTime;
        }),
    }))
    .sort((a, b) => {
      const aTime = a.lastPlayedAt || 0;
      const bTime = b.lastPlayedAt || 0;
      return bTime - aTime;
    });
};

const PlayerConnectionsPage = ({
  currentUser,
  memberIdentityIds,
  onOpenMatch,
  formatDateTime,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [matches, setMatches] = useState([]);
  const [expandedPlayerId, setExpandedPlayerId] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const fetchMatchesForFilter = async (filterValue) => {
      const aggregated = [];
      let page = 1;
      const perPage = 25;
      let keepFetching = true;

      while (keepFetching) {
        // eslint-disable-next-line no-await-in-loop
        const includeHidden =
          filterValue === "my" || filterValue === ARCHIVE_FILTER_VALUE;
        const response = await listMatches(filterValue, {
          page,
          perPage,
          includeHidden,
        });
        const batch = Array.isArray(response?.matches)
          ? response.matches
          : Array.isArray(response)
            ? response
            : [];
        aggregated.push(...batch);

        const pagination = response?.pagination || {};
        const received = batch.length;
        const per = Number(
          pagination.perPage ??
            pagination.per_page ??
            pagination.page_size ??
            perPage,
        );
        const total = Number(pagination.total);
        const pageCount = Number(
          pagination.pageCount ?? pagination.total_pages ?? pagination.pages,
        );
        const currentPage = Number(pagination.page ?? page);

        const reachedTotal = Number.isFinite(total)
          ? aggregated.length >= total
          : false;
        const reachedPageCount = Number.isFinite(pageCount)
          ? currentPage >= pageCount
          : false;
        const exhaustedBatch =
          !Number.isFinite(per) || per <= 0 ? received === 0 : received < per;

        if (reachedTotal || reachedPageCount || exhaustedBatch) {
          keepFetching = false;
        } else {
          page += 1;
          if (page > 20) {
            keepFetching = false;
          }
        }
      }

      return aggregated;
    };

    const fetchMatches = async () => {
      if (!currentUser) {
        if (isMounted) {
          setMatches([]);
          setError("");
          setLoading(false);
        }
        return;
      }

      if (isMounted) {
        setLoading(true);
        setError("");
      }

      const filtersToFetch = Array.from(
        new Set(["my", ARCHIVE_FILTER_VALUE].filter(Boolean)),
      );

      const aggregated = [];
      let firstError = null;
      let successfulFetches = 0;

      try {
        for (const filterValue of filtersToFetch) {
          try {
            // eslint-disable-next-line no-await-in-loop
            const results = await fetchMatchesForFilter(filterValue);
            aggregated.push(...results);
            successfulFetches += 1;
          } catch (filterError) {
            console.error(
              `Failed to load match history for filter "${filterValue}"`,
              filterError,
            );
            if (!firstError) {
              firstError = filterError;
            }
          }
        }

        const dedupedMatches = (() => {
          if (aggregated.length <= 1) return aggregated;
          const seenIds = new Set();
          const deduped = [];
          aggregated.forEach((match) => {
            const normalized = normalizeMatchRecord(match);
            const matchId = extractMatchId(normalized);
            if (matchId) {
              if (seenIds.has(matchId)) {
                return;
              }
              seenIds.add(matchId);
            }
            deduped.push(match);
          });
          return deduped;
        })();

        if (isMounted) {
          setMatches(dedupedMatches);
          if (
            dedupedMatches.length === 0 &&
            successfulFetches === 0 &&
            firstError
          ) {
            setError(
              firstError?.response?.data?.message ||
                firstError?.message ||
                "We couldn't load your match history.",
            );
          } else {
            setError("");
          }
        }
      } catch (err) {
        console.error("Failed to load match history", err);
        if (isMounted) {
          setMatches([]);
          setError(
            err?.response?.data?.message ||
              err?.message ||
              "We couldn't load your match history.",
          );
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchMatches();

    return () => {
      isMounted = false;
    };
  }, [currentUser]);

  const players = useMemo(
    () => buildPlayerSummaries(matches, currentUser, memberIdentityIds),
    [matches, currentUser, memberIdentityIds],
  );

  const handleTogglePlayer = (playerId) => {
    setExpandedPlayerId((previous) => (previous === playerId ? null : playerId));
  };

  if (!currentUser) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16">
        <div className="bg-white border border-gray-100 rounded-3xl p-10 text-center shadow-xl">
          <Users className="mx-auto h-12 w-12 text-emerald-500" />
          <h2 className="mt-6 text-2xl font-black text-gray-900">
            Sign in to view your match partners
          </h2>
          <p className="mt-3 text-base text-gray-600">
            Keep track of everyone you've played with once you're signed in.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <div className="mb-8 text-center">
        <div className="inline-flex items-center gap-3 rounded-full bg-emerald-50 px-4 py-2 text-emerald-700 font-semibold">
          <Users className="h-5 w-5" />
          Your match partners
        </div>
        <h1 className="mt-6 text-3xl font-black text-gray-900 sm:text-4xl">
          Players you've shared the court with
        </h1>
        <p className="mt-4 text-base text-gray-600">
          Review contact info, skill levels, and revisit the matches you've played together.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
        </div>
      ) : error ? (
        <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-red-700">
          {error}
        </div>
      ) : players.length === 0 ? (
        <div className="rounded-3xl border border-gray-200 bg-white p-10 text-center shadow-lg">
          <h2 className="text-xl font-black text-gray-900">
            No partners found yet
          </h2>
          <p className="mt-3 text-base text-gray-600">
            Once you host or join a match, you'll see the players appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {players.map((player) => {
            const isExpanded = expandedPlayerId === player.id;
            return (
              <div
                key={player.id}
                className="rounded-3xl border border-gray-100 bg-white p-6 shadow-xl transition-all hover:shadow-2xl"
              >
                <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                  <div className="flex flex-1 items-start gap-4">
                    <PlayerAvatar
                      name={player.name}
                      imageUrl={player.avatarUrl}
                      variant="emerald"
                      size="lg"
                      className="shadow-lg"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-3">
                        <h2 className="text-xl font-black text-gray-900">
                          {player.name}
                        </h2>
                        {player.skillLevel && (
                          <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700">
                            NTRP {player.skillLevel}
                          </span>
                        )}
                        <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-sm font-semibold text-gray-600">
                          {player.matches.length} match{player.matches.length === 1 ? "" : "es"}
                        </span>
                      </div>
                      {player.lastPlayedAt && (
                        <p className="mt-2 text-sm font-semibold text-gray-600">
                          Last played {formatDateTime(player.lastPlayedAt)}
                        </p>
                      )}
                      {player.homeCourt && (
                        <p className="mt-2 flex items-center gap-2 text-sm text-gray-600">
                          <MapPin className="h-4 w-4 text-emerald-500" />
                          {player.homeCourt}
                        </p>
                      )}
                      {player.bio && (
                        <p className="mt-3 text-sm text-gray-600 line-clamp-3">
                          {player.bio}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex w-full flex-col gap-2 md:w-auto md:items-end">
                    {player.phone && (
                      <a
                        href={`tel:${player.phoneRaw || player.phone}`}
                        className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 transition-colors hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
                      >
                        <Phone className="h-4 w-4" />
                        {player.phone}
                      </a>
                    )}
                    {player.email && (
                      <a
                        href={`mailto:${player.email}`}
                        className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 transition-colors hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
                      >
                        <Mail className="h-4 w-4" />
                        {player.email}
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => handleTogglePlayer(player.id)}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 py-2 text-sm font-bold text-white shadow-lg transition-all hover:bg-gray-700"
                    >
                      <History className="h-4 w-4" />
                      {isExpanded ? "Hide match history" : "See match history"}
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="mt-6 space-y-4 rounded-2xl bg-gray-50 p-4">
                    {player.matches.map((match) => (
                      <div
                        key={`${match.id || "unknown"}-${match.date || "na"}`}
                        className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition-all hover:border-emerald-200"
                      >
                        <div className="flex flex-wrap items-center gap-3">
                          <h3 className="text-lg font-bold text-gray-900">
                            {match.name}
                          </h3>
                          {match.format && (
                            <span className="inline-flex items-center rounded-full bg-white px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
                              {match.format}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                          {match.date && (
                            <span className="inline-flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-emerald-500" />
                              {formatDateTime(match.date)}
                            </span>
                          )}
                          {match.location && (
                            <span className="inline-flex items-center gap-2">
                              <MapPin className="h-4 w-4 text-emerald-500" />
                              {match.location}
                            </span>
                          )}
                        </div>
                        {match.id && (
                          <div>
                            <button
                              type="button"
                              onClick={() => onOpenMatch?.(match.id)}
                              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 transition-colors hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
                            >
                              View match details
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PlayerConnectionsPage;
