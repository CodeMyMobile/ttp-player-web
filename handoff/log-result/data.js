// Stub data hooks. Same shape the real hooks should take, so swapping to live
// endpoints later is a one-file change.
// TODO(Sahil): replace bodies with real fetching, matching the app's data layer
// (React Query / SWR / etc). Keep the return shapes identical.
import { CURRENT_USER, PLAYERS, COURTS } from "./fixtures";

export function useCurrentUser() {
  return CURRENT_USER;
}

export function usePlayers() {
  return PLAYERS;
}

export function useCourts() {
  return COURTS;
}
