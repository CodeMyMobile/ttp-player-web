import { useEffect, useMemo, useState } from "react";

import { getSuggestedPlayerCheckLocation } from "../api/playerHome";
import {
  DEFAULT_HOME_RADIUS_MILES,
  homePlayerSuggestions,
  searchRadiusMiles,
  toCourtList,
  type HomePlayersResult,
} from "../utils/homePlayerSuggestions";
import type { StoredMatchProfile } from "../utils/matchProfile";
import { extractSuggestedPlayers, mapSuggestedPlayer, type DirectoryPlayer } from "../utils/suggestedPlayer";
import {
  getStoredLocation,
  getStoredLocationRadius,
  USER_LOCATION_CHANGED_EVENT,
  type Coordinates,
} from "../utils/userLocation";

export type HomePlayersState =
  /** Flag off, signed out, or no location set: neither piece shows. */
  | { status: "off" }
  | { status: "loading" }
  | ({ status: "ready" } & HomePlayersResult);

const readLocation = (): { position: Coordinates | null; radiusMiles: number } => ({
  position: getStoredLocation(),
  radiusMiles: getStoredLocationRadius() ?? DEFAULT_HOME_RADIUS_MILES,
});

/**
 * The data behind the home page's "Players to hit with" carousel and the compact
 * "Find players" tile, loaded once for both.
 *
 * One call to the endpoint Find Players uses, at 15 mi (or the viewer's radius if
 * larger): each row's distance_miles lets homePlayerSuggestions apply the viewer's
 * radius, widen to 15 mi, and break ties by distance without a second call. The
 * viewer's level, availability and courts come from their match profile, which
 * usePlayerConnect loads; pass it in once `viewerLoaded`.
 */
export default function useHomePlayers({
  enabled,
  token,
  viewer,
  viewerLoaded,
}: {
  enabled: boolean;
  token: string | undefined;
  viewer: StoredMatchProfile | null;
  viewerLoaded: boolean;
}): HomePlayersState {
  const [location, setLocation] = useState(readLocation);
  const [players, setPlayers] = useState<DirectoryPlayer[] | null>(null);
  // One shuffle per visit: a different mix each time home opens, but it holds
  // still while the viewer is on the page.
  const [seed] = useState(() => Math.floor(Math.random() * 2 ** 32));
  const searchedMiles = searchRadiusMiles(location.radiusMiles);

  // The header's location picker writes here; follow it.
  useEffect(() => {
    const sync = () => setLocation(readLocation());
    window.addEventListener(USER_LOCATION_CHANGED_EVENT, sync);
    return () => window.removeEventListener(USER_LOCATION_CHANGED_EVENT, sync);
  }, []);

  const active = enabled && Boolean(token) && Boolean(location.position);
  const positionKey = location.position
    ? `${location.position.latitude.toFixed(4)}:${location.position.longitude.toFixed(4)}`
    : "none";

  useEffect(() => {
    if (!active || !token || !location.position) return undefined;
    let cancelled = false;
    setPlayers(null);

    getSuggestedPlayerCheckLocation({
      token,
      perPage: 100,
      page: 1,
      radius: searchedMiles,
      position: { latitude: location.position.latitude, longitude: location.position.longitude },
    })
      .then((response) => {
        if (!cancelled) setPlayers(extractSuggestedPlayers(response).map(mapSuggestedPlayer));
      })
      .catch(() => {
        // The API answers 404 when nobody is nearby. Either way there is nothing to
        // suggest, and the home page must not show an error for an optional block.
        if (!cancelled) setPlayers([]);
      });

    return () => {
      cancelled = true;
    };
    // positionKey stands in for location.position, which is a new object each read.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, token, positionKey, searchedMiles]);

  return useMemo(() => {
    if (!active) return { status: "off" };
    if (!viewerLoaded || players === null) return { status: "loading" };
    return {
      status: "ready",
      ...homePlayerSuggestions({
        players,
        viewer: {
          level: viewer?.level ?? null,
          availability: viewer?.availability ?? [],
          courts: toCourtList(viewer?.localCourts),
        },
        radiusMiles: location.radiusMiles,
        searchedMiles,
        seed,
      }),
    };
  }, [active, viewerLoaded, players, viewer, location.radiusMiles, searchedMiles, seed]);
}
