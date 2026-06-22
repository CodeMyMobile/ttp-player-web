# Backend: `GET /matches` ignores `created_by` (visitor profile feed)

**Owner:** backend (Sahil) — the client guard below mitigates the UI, but the
endpoint must filter server-side.

## Symptom
On the visitor player profile ("Open match play"), the **same match appears on
every player's profile** — including matches **not hosted by the profile owner**.
Because the card derives `isHost` from the match's own host id, a match the
*viewer* hosts then renders **"View Details"** on a stranger's profile.

## Root cause
`PlayerProfilePage` requests the owner's matches with `created_by=<owner id>`:

```
GET /matches?page=1&perPage=10&when=upcoming&created_by=<OWNER_ID>
            &includeHidden=true&include_hidden=true&ignoreLocation=true
            &latitude=<lat>&longitude=<lng>&distance=5
```

(`src/pages/PlayerProfilePage.tsx` → `listMatches(undefined, { created_by: id, … })`;
the leading `undefined` is the `filter` positional arg — `created_by` is sent
correctly, confirmed in `src/play-dates/services/matches.js:202,285`.)

The endpoint **returns all upcoming matches regardless of `created_by`**. Note
also `ignoreLocation=true` is sent (intentionally, so distance doesn't hide the
owner's matches) — combined with the ignored `created_by`, the response is
effectively *all upcoming matches everywhere*.

## Evidence (from live capture) — PENDING paste
- **Request query string sent:** `created_by=` … _(paste)_
- **Response — offending match (`Penmar doubles`):** `created_by=` … / `host_id=` … _(paste)_
- **Viewer id** (`JSON.parse(localStorage.authLoginResponse).user_id`): … _(paste)_
- Expectation: request sends the **owner's** id, but the response match's
  `host_id` is **not** the owner (it's the viewer's / a third party) → confirms
  the server ignored `created_by`.

## Required server fix
- `GET /matches?created_by=<id>` must return **only matches hosted by `<id>`**.
- Confirm the param name the API expects (`created_by` vs `host_id`/`creator_id`)
  and that it composes with `when=upcoming` and `ignoreLocation=true`.

## Client mitigation (shipped)
`PlayerProfilePage` filters the feed to matches actually hosted by the profile
owner, folded into the single `visibleMatches` memo (drives count + list):

```
openMatches.filter(m => isOpenStatus(m) && idsMatch(getMatchHostId(m), id))
```

`getMatchHostId` / `idsMatch` are shared from
`src/play-dates/utils/matchHost.ts` (same logic the card uses for `isHost`, so
they can't drift). Matches with no resolvable host are dropped. This is a UI
guard only — it does not reduce over-fetching; the endpoint fix is still needed.
