// Stub data so the page renders before the backend exists.
// EVERYTHING HERE IS FAKE. TODO(Sahil): replace each list with a real endpoint.
import type { CurrentUser, Player, Court } from "./scoring";

// TODO(Sahil): replace with the signed-in player. `useAuth()` already exposes
// id + name client-side; NTRP needs /player/personal_details.
export const CURRENT_USER: CurrentUser = { id: "me", name: "Paul", ntrp: "4.5" };

// TODO(Sahil): replace with the real registered-players endpoint.
// only players already on The Tennis Plan are selectable
export const PLAYERS: Player[] = [
  { id: "p1", name: "Marcus Webb", ntrp: "4.0", color: "bg-rose-100 text-rose-700" },
  { id: "p2", name: "Dani Rosen", ntrp: "4.5", color: "bg-sky-100 text-sky-700" },
  { id: "p3", name: "Tom Halloway", ntrp: "4.5", color: "bg-amber-100 text-amber-700" },
  { id: "p4", name: "Priya Nair", ntrp: "4.0", color: "bg-emerald-100 text-emerald-700" },
  { id: "p5", name: "Carlos Mendez", ntrp: "3.5", color: "bg-indigo-100 text-indigo-700" },
];

// TODO(Sahil): replace with the real courts/venues endpoint.
export const COURTS: Court[] = [
  { id: "c1", name: "Penmar Recreation Center", area: "Venice" },
  { id: "c2", name: "Mar Vista Recreation Center", area: "Mar Vista" },
  { id: "c3", name: "Cheviot Hills Tennis Center", area: "Cheviot Hills" },
  { id: "c4", name: "Stoner Recreation Center", area: "West LA" },
  { id: "c5", name: "Culver City HS Courts", area: "Culver City" },
  { id: "c6", name: "Westwood Recreation Center", area: "Westwood" },
];
