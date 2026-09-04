# Backend brief - endpoint to cancel/delete a posted match-need

**For:** Sahil / backend
**From:** Frontend (Paul)
**Status:** Request - not started

## What we're building

A **Cancel** button on each card in the "My posted availability" section of the Match Browser (`/leagues/:id/match-browser`). On confirm, the frontend calls a new DELETE endpoint and removes the need from both lists locally (no refetch), so the row must also disappear server-side.

## What we need

A new route:

```
DELETE /leagues/{leagueId}/match-needs/{matchId}   ->   { "deleted": true }
```

### Behavior

- **Ownership check**: only the player who posted the need may cancel it - anyone else gets `403`. Unknown id, or a need that does not belong to this league, gets `404`.
- **Soft-cancel preferred over hard delete**: flip the row's status (e.g. `cancelled`) instead of removing it, so history is preserved and any accepted match referencing the need is not orphaned.
- **Cancelled rows must disappear from reads**: both `GET /leagues/{id}/match-needs` (default) and `?scope=all` stop returning the row once cancelled - otherwise it reappears on the next refetch. Same for `suggestions`.
- **Already-filled guard**: if the need has already been accepted/confirmed into a match, return `409` with a message like "This availability was already filled" instead of cancelling (the frontend shows that error text as-is).

### Response shapes

| Case | Status | Body |
|---|---|---|
| Cancelled | 200 | `{ "deleted": true }` |
| Not the owner | 403 | `{ "message": "..." }` |
| Not found in league | 404 | `{ "message": "..." }` |
| Already filled/confirmed | 409 | `{ "message": "This availability was already filled" }` |

(204 No Content also works - the frontend only reads the body on success, and surfaces any non-OK status's `message` as the error text.)

## TL;DR

- Add `DELETE /leagues/{leagueId}/match-needs/{matchId}` with an ownership check.
- Soft-cancel (status flip) preferred over hard delete.
- Cancelled rows must disappear from both match-needs GET responses and suggestions.
