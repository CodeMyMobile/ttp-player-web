import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Calendar,
  Loader2,
  MapPin,
  Trophy,
  User,
  Users,
} from "lucide-react";

import PlayerAvatar from "../components/PlayerAvatar.jsx";
import { listMatches } from "../services/matches";
import { getOtherPlayerDetails } from "../services/player";

const pickFirst = (...values) => {
  for (const value of values) {
    if (value === undefined || value === null) continue;
    const str = String(value).trim();
    if (str) return str;
  }
  return "";
};

const normalizeProfile = (rawProfile = {}, playerId) => {
  const profile =
    rawProfile?.profile && typeof rawProfile.profile === "object"
      ? rawProfile.profile
      : rawProfile;

  const name = pickFirst(
    profile.full_name,
    profile.fullName,
    profile.display_name,
    profile.displayName,
    profile.name,
    [profile.first_name, profile.last_name].filter(Boolean).join(" "),
    rawProfile.full_name,
    rawProfile.fullName,
    rawProfile.name,
    `Player ${playerId}`,
  );

  return {
    id:
      profile.user_id ??
      profile.userId ??
      profile.player_id ??
      profile.playerId ??
      profile.id ??
      playerId,
    name,
    avatarUrl: pickFirst(
      profile.profile_picture,
      profile.profilePicture,
      profile.profile_picture_url,
      profile.profilePictureUrl,
      profile.avatar_url,
      profile.avatarUrl,
      profile.image_url,
      profile.imageUrl,
    ),
    skillLevel: pickFirst(
      profile.usta_rating,
      profile.skill_level,
      profile.skillLevel,
      profile.ntrp,
      profile.rating,
    ),
    homeCourt: pickFirst(
      profile.home_court,
      profile.homeCourt,
      profile.home_facility,
      profile.homeFacility,
      profile.home_club,
      profile.homeClub,
    ),
    bio: pickFirst(profile.about_me, profile.aboutMe, profile.bio),
  };
};

const getMatchTitle = (match = {}) =>
  pickFirst(
    match.title,
    match.name,
    match.match_name,
    match.matchName,
    match.match_format,
    match.matchFormat,
    "Open match",
  );

const getMatchOpenSpots = (match = {}) => {
  const open = Number(match.capacity?.open);
  if (Number.isFinite(open)) return open;

  const limit = Number(match.player_limit ?? match.playerLimit);
  if (!Number.isFinite(limit)) return null;
  const participants = Array.isArray(match.participants)
    ? match.participants.filter((participant) =>
        ["hosting", "confirmed"].includes(
          String(participant?.status || "").toLowerCase(),
        ),
      ).length
    : 0;
  return Math.max(limit - participants, 0);
};

const PlayerProfilePage = ({
  currentUser,
  playerId,
  onOpenMatch,
  formatDateTime,
}) => {
  const [profile, setProfile] = useState(null);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const normalizedPlayerId = useMemo(() => {
    const raw =
      playerId === undefined || playerId === null ? "" : String(playerId).trim();
    return raw || "";
  }, [playerId]);

  useEffect(() => {
    let isMounted = true;

    const loadProfile = async () => {
      if (!currentUser || !normalizedPlayerId) {
        if (isMounted) {
          setProfile(null);
          setMatches([]);
          setLoading(false);
          setError("");
        }
        return;
      }

      setLoading(true);
      setError("");

      try {
        const [profileResponse, matchesResponse] = await Promise.all([
          getOtherPlayerDetails(normalizedPlayerId),
          listMatches(null, {
            createdBy: normalizedPlayerId,
            status: "open",
            when: "upcoming",
            includeHidden: true,
            include_hidden: true,
            page: 1,
            perPage: 25,
          }),
        ]);

        if (!isMounted) return;
        setProfile(normalizeProfile(profileResponse, normalizedPlayerId));
        setMatches(
          Array.isArray(matchesResponse?.matches)
            ? matchesResponse.matches
            : Array.isArray(matchesResponse)
              ? matchesResponse
              : [],
        );
      } catch (err) {
        console.error("Failed to load player profile", err);
        if (isMounted) {
          setProfile(null);
          setMatches([]);
          setError(
            err?.response?.data?.message ||
              err?.response?.data?.error ||
              err?.message ||
              "We couldn't load this player's profile.",
          );
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadProfile();

    return () => {
      isMounted = false;
    };
  }, [currentUser, normalizedPlayerId]);

  if (!currentUser) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16">
        <div className="rounded-3xl border border-gray-100 bg-white p-10 text-center shadow-xl">
          <User className="mx-auto h-12 w-12 text-emerald-500" />
          <h1 className="mt-6 text-2xl font-black text-gray-900">
            Sign in to view this profile
          </h1>
          <p className="mt-3 text-base text-gray-600">
            Player profiles and open matches are available to signed-in players.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center px-4 py-24">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <div className="flex gap-3 rounded-3xl border border-red-200 bg-red-50 p-6 text-red-700">
          <AlertCircle className="mt-0.5 h-5 w-5 flex-none" />
          <p className="font-semibold">{error}</p>
        </div>
      </div>
    );
  }

  const displayProfile = profile || normalizeProfile({}, normalizedPlayerId);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <section className="rounded-3xl border border-gray-100 bg-white p-6 shadow-xl sm:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
          <PlayerAvatar
            name={displayProfile.name}
            imageUrl={displayProfile.avatarUrl}
            variant="emerald"
            size="xl"
            className="shadow-lg"
          />
          <div className="min-w-0 flex-1">
            <h1 className="text-3xl font-black text-gray-900">
              {displayProfile.name}
            </h1>
            <div className="mt-3 flex flex-wrap gap-2">
              {displayProfile.skillLevel && (
                <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-sm font-bold text-emerald-700">
                  <Trophy className="h-4 w-4" />
                  NTRP {displayProfile.skillLevel}
                </span>
              )}
              {displayProfile.homeCourt && (
                <span className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1 text-sm font-semibold text-gray-700">
                  <MapPin className="h-4 w-4" />
                  {displayProfile.homeCourt}
                </span>
              )}
            </div>
            {displayProfile.bio && (
              <p className="mt-4 max-w-3xl text-sm leading-6 text-gray-600">
                {displayProfile.bio}
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="mt-8">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-black uppercase tracking-wider text-emerald-600">
              Open match play
            </p>
            <h2 className="text-2xl font-black text-gray-900">
              Matches {displayProfile.name.split(" ")[0]} is trying to fill
            </h2>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-sm font-bold text-gray-700 shadow-sm ring-1 ring-gray-200">
            <Users className="h-4 w-4 text-emerald-500" />
            {matches.length}
          </span>
        </div>

        {matches.length === 0 ? (
          <div className="rounded-3xl border border-gray-200 bg-white p-8 text-center shadow-lg">
            <h3 className="text-lg font-black text-gray-900">
              No open matches right now
            </h3>
            <p className="mt-2 text-sm text-gray-600">
              Check back when this player shares new match openings.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {matches.map((match) => {
              const openSpots = getMatchOpenSpots(match);
              return (
                <article
                  key={match.id}
                  className="rounded-3xl border border-gray-100 bg-white p-5 shadow-lg transition-all hover:border-emerald-200 hover:shadow-xl"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-black text-gray-900">
                        {getMatchTitle(match)}
                      </h3>
                      {match.match_format && (
                        <p className="mt-1 text-sm font-semibold text-emerald-700">
                          {match.match_format}
                        </p>
                      )}
                    </div>
                    {openSpots !== null && (
                      <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">
                        {openSpots} spot{openSpots === 1 ? "" : "s"}
                      </span>
                    )}
                  </div>
                  <div className="mt-4 space-y-2 text-sm text-gray-600">
                    {match.start_date_time && (
                      <p className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-emerald-500" />
                        {formatDateTime?.(match.start_date_time) ||
                          new Date(match.start_date_time).toLocaleString()}
                      </p>
                    )}
                    {match.location_text && (
                      <p className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-emerald-500" />
                        {match.location_text}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => onOpenMatch?.(match.id)}
                    className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-gray-900 px-4 py-3 text-sm font-black text-white shadow-lg transition-colors hover:bg-gray-700"
                  >
                    View and join
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};

export default PlayerProfilePage;
