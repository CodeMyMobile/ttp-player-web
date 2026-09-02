// Feature gate for the league player contact sheet.
//
// OFF until the backend ships a per-membership `share_contact` field.
//
// This is not a rollout flag, it is a correctness gate. Two things are untrue
// while the field is missing, and both get worse if the sheet is switched on:
//
//   1. `GET /leagues/:id/players` returns every member's phone number to every
//      signed-in viewer with no opt-in (ttp-api routes/leagues.js:481). Surfacing
//      those numbers in the UI would publish them, not merely display them.
//   2. The join-flow consent checkbox has nowhere to persist to, so it would
//      promise a choice the system cannot honour.
//
// Turn this on only once `share_contact` is returned per membership AND the join
// flow can save it. Set VITE_LEAGUE_CONTACT_SHEET=1 to enable.

const readFlag = (): boolean => {
  const raw = import.meta.env?.VITE_LEAGUE_CONTACT_SHEET;
  return raw === "1" || raw === "true";
};

export const isContactSheetEnabled = (): boolean => readFlag();
