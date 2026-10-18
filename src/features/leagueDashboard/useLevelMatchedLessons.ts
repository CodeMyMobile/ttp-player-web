// Loads, once, what the league dashboard's coaching prompts share: the player's level
// and the group lessons that fit it, ours and outside providers'. Fetches the same
// lessons, window and area as the Group Lessons page (today through today+9, the stored
// location and radius) so the card and the page agree on what is on offer.

import { useEffect, useMemo, useState } from "react";
import moment from "moment";

import { fetchUpcomingGroupLessons, mapUpcomingGroupLessonsResponse, type GroupLesson } from "../../api/groupLessons";
import { getPlayerExternalLessons } from "../../api/playerHome";
import { getPlayerPersonalDetails } from "../../api/playerProfile";
import { getStoredAuthToken } from "../../services/authToken";
import {
  extractExternalLessons,
  getExternalLessonMetadata,
  mapExternalLessonToGroupLesson,
} from "../../utils/externalGroupLessons";
import { playerLevelOf } from "../../utils/groupLessonLevelFit";
import {
  DEFAULT_POSITION,
  DEFAULT_RADIUS_MILES,
  getStoredLocation,
  getStoredLocationRadius,
} from "../../utils/userLocation";
import {
  leagueLevelOf,
  lessonsLinkState,
  levelBandLabel,
  levelLabel,
  matchLessonsToLevel,
  matchLevel,
  type LevelMatchedLesson,
} from "./levelMatchedLessons";

const DAY_WINDOW_LENGTH = 10;

export interface LevelMatchedLessons {
  /** "4.0", or null when neither the player nor the league has a level. */
  level: string | null;
  /** "4.0–4.5". */
  band: string | null;
  lessons: LevelMatchedLesson[];
  /** Router state for "Browse all" links: the lessons page, filtered to this level. */
  linkState: ReturnType<typeof lessonsLinkState>;
  loaded: boolean;
}

export const useLevelMatchedLessons = ({
  enabled,
  leagueLabel,
}: {
  enabled: boolean;
  leagueLabel: string | null | undefined;
}): LevelMatchedLessons => {
  const [playerLevel, setPlayerLevel] = useState<number | null | undefined>(undefined);
  const [lessons, setLessons] = useState<GroupLesson[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!enabled) return undefined;
    const controller = new AbortController();
    const token = getStoredAuthToken({ preferScheme: "token" }) ?? undefined;
    const position = getStoredLocation() ?? DEFAULT_POSITION;
    const radius = getStoredLocationRadius() ?? DEFAULT_RADIUS_MILES;

    const levelRequest = token
      ? getPlayerPersonalDetails({ token, signal: controller.signal })
          .then((details) => playerLevelOf(details))
          .catch(() => null)
      : Promise.resolve(null);

    const request = {
      ...(token ? { token } : {}),
      perPage: 50,
      page: 1,
      position,
      filters: {
        radius,
        dateStart: moment().format("YYYY-MM-DD"),
        dateEnd: moment().add(DAY_WINDOW_LENGTH - 1, "days").format("YYYY-MM-DD"),
      },
      signal: controller.signal,
    };
    // Each source fails on its own: a prompt that can't load just doesn't show.
    const ownLessons = fetchUpcomingGroupLessons(request)
      .then((response) => mapUpcomingGroupLessonsResponse(response).lessons)
      .catch(() => [] as GroupLesson[]);
    // As on the lessons page: only outside lessons with a link to book them.
    const externalLessons = getPlayerExternalLessons(request)
      .then((response) =>
        extractExternalLessons(response)
          .filter((lesson) => Boolean(getExternalLessonMetadata(lesson).externalUrl))
          .map(mapExternalLessonToGroupLesson),
      )
      .catch(() => [] as GroupLesson[]);

    Promise.all([levelRequest, ownLessons, externalLessons]).then(([level, own, external]) => {
      if (controller.signal.aborted) return;
      setPlayerLevel(level);
      setLessons([...own, ...external]);
      setLoaded(true);
    });
    return () => controller.abort();
  }, [enabled]);

  return useMemo(() => {
    const ownLevel = playerLevel ?? null;
    const level = matchLevel(ownLevel, leagueLevelOf(leagueLabel));
    return {
      level: level === null ? null : levelLabel(level),
      band: level === null ? null : levelBandLabel(level),
      lessons: loaded ? matchLessonsToLevel(lessons, level) : [],
      linkState: lessonsLinkState(ownLevel, level),
      loaded,
    };
  }, [leagueLabel, lessons, loaded, playerLevel]);
};
