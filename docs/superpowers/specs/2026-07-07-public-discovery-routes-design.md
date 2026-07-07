# Public Discovery Routes Design

## Goal

Allow unauthenticated users to inspect discovery pages and shared detail pages before sign-in. Viewing public data should work from promoted links and shared links. Taking any action that mutates data, contacts another user, books a lesson, joins a match, creates a match, or manages account state still requires sign-in or sign-up.

## Public Routes

These frontend routes should be reachable without `ProtectedRoute`:

- `/find-players`
- `/group-lessons`
- `/matches`
- `/matches/:id`
- Existing public routes stay public: `/players/:id`, `/find-coaches`, `/coaches/:id`, `/group-lessons/:id`, `/lessons/:id`

## Frontend Behavior

Anonymous users can browse lists, use filters, and open public detail pages. Authenticated users keep the current richer experience where available.

Action gates:

- `/find-players`: viewing/searching player cards is public. Connecting, sharing an intro, creating a match invite, and editing match profile require auth.
- `/group-lessons`: viewing/searching lessons is public. Booking, payment methods, package purchase, and recording external click attribution require auth.
- `/matches`: viewing open/public matches is public. Joining, creating, editing, leaving, cancelling, inviting, or seeing private host/contact data requires auth.
- `/matches/:id`: details remain public. Join/manage actions require auth.

Unauthenticated action attempts should redirect to login with the original route preserved where the existing pattern already does this, or open the existing auth affordance if the page already uses one.

## Backend Behavior

The backend must expose read-only public data for list routes:

- Public matches feed: unauthenticated `GET /api/matches` should return only public/open, non-hidden, non-archived records with sensitive participant/contact fields redacted. Authenticated requests keep current behavior.
- Public player discovery: expose or relax a read-only endpoint that returns limited player discovery records. It must not require the viewer's survey answers or expose phone/email/private profile fields.
- Public group lessons list: expose or relax a read-only list endpoint for upcoming group lessons and external lessons. It should mirror current public lesson detail privacy boundaries.

Write/action routes remain authenticated.

## Data Flow

Frontend services should support optional auth tokens. When no token exists, read requests should call the public-safe backend path or pass no `Authorization` header. When a token exists, pages may keep using current authenticated endpoints to preserve personalized data.

## Error Handling

Anonymous list pages should not show "missing auth token" errors. If a public endpoint fails, show the existing empty/error state with a neutral retry message. If a user attempts a protected action, route them to login instead of failing the API call.

## Testing

Frontend tests should cover route accessibility and action gating for unauthenticated users. Backend tests should cover anonymous read access and verify sensitive fields are redacted, while write/action endpoints still reject unauthenticated requests.
