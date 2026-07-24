# Backend brief — finished leagues linger under "active" instead of "Past seasons"

**Area:** Leagues list / categorization
**Endpoints:** `GET /leagues`, `GET /leagues?segment=archived`
**Reported:** a league the player joined, whose season is over ("finished") and end date is in the past, still shows in the **active** leagues list on `/leagues` and does **not** appear under **Past seasons**.

## What happens today

The `/leagues` browse page renders the API's sections verbatim — it does not reclassify:

- `GET /leagues` → `sections.mine` (the player's active leagues) + `sections.available`.
- `GET /leagues?segment=archived` → past seasons (rendered under "Past seasons").

A finished/past league where the player's `membership_status` is still **active** is returned by the backend in **`sections.mine`**, and it is **not** included in the `segment=archived` response. So it falls into the gap: shown as active, never shown as past.

## Expected

A league whose **season has ended** should be categorized as past/archived for its members:

- It should be **removed from `sections.mine`** (it's not a current/active season), and
- **included in the `segment=archived`** response for that member (so it shows under "Past seasons" with the member's final standing).

## Suggested backend fix (any one of these)

1. **Categorize by season state, not just membership.** When building `sections.mine`, exclude leagues whose season has ended (status finished/completed, or `end_date` in the past) and include them in the `archived` segment for that member — even if `membership_status` is still `active`.
2. **Expose a clear signal** the client can categorize on consistently, e.g. a league `season_status` (`upcoming` | `active` | `finished`) and/or a membership status that flips to `completed`/`archived` when the season ends. Today the client only has `league.status`, `end_date`, `deadline`, and `membership_status`, with no documented "finished" value.

Either way, a finished season should be reachable under Past seasons for the members who played in it, and should not remain in the active list.

## FE stopgap in place (remove when backend is fixed)

`src/pages/LeaguesPage.tsx` now reclassifies client-side as a temporary workaround: `isPastLeague()` treats a league as past when `league.status` is a finished-ish value (`finished`/`completed`/`ended`/`closed`/`archived`/…) **or** `end_date`/`deadline` is before today. Such leagues are pulled out of `mine` at load time and merged into the "Past seasons" list (de-duped against the backend's `archived` segment). Their final standing is fetched the same way as archived leagues.

This is a heuristic and duplicates categorization that belongs on the backend — please remove `isPastLeague` and the `finishedMine`/`pastSeasonLeagues` handling once `/leagues` categorizes finished seasons correctly.
