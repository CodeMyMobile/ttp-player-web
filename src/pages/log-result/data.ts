// Stub data hooks. Same shape the real hooks should take, so swapping to live
// endpoints later is a one-file change.
//
// TODO(Sahil): replace these bodies with real fetching, matching the app's data
// layer (the custom `useApiRequest` hook in src/hooks/useApiRequest.ts). Keep the
// return shapes identical so the page doesn't change:
//   useCurrentUser() -> CurrentUser   (useAuth() gives id+name; NTRP via personal_details)
//   usePlayers()     -> Player[]      (registered-players endpoint)
//   useCourts()      -> Court[]       (courts/venues endpoint)
import type { CurrentUser, Player, Court } from "./scoring";
import { CURRENT_USER, PLAYERS, COURTS } from "./fixtures";

export function useCurrentUser(): CurrentUser {
  return CURRENT_USER;
}

export function usePlayers(): Player[] {
  return PLAYERS;
}

export function useCourts(): Court[] {
  return COURTS;
}
