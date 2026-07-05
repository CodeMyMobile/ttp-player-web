# PR Brief: Terms & Privacy agreement line on signup / login

## Goal

Add a standard agreement line to the signup page: "By signing up, you agree to our
Privacy Policy and Terms of Use," with both as clickable links to the existing live pages.

## Behaviour

- Add a small line directly beneath the "Create account" button on the signup page:
  **"By signing up, you agree to our Privacy Policy and Terms of Use."**
- "Privacy Policy" and "Terms of Use" are clickable links pointing to the existing live
  pages (built for the earlier compliance work — already live; this is wiring links to
  existing routes, not creating content).
- This is a passive agreement — NO checkbox. The act of signing up is the agreement; the
  links are there so the user can read what they're agreeing to.
- Apply to both signup entry points:
  - Email path (the main create-account form)
  - Google path (the "one more thing" step after OAuth) — same line beneath its button
- Login page: optional small footer link to Terms/Privacy for consistency, but no
  agreement gate (the user already agreed at signup). Confirm if wanted.

## Note: keep separate from SMS consent

This Terms/Privacy line is DISTINCT from the SMS/TCPA consent checkbox (the separate
unchecked "I agree to receive match-related texts" control). Do not merge them — the
SMS consent stays its own explicit checkbox; this is just the general Terms/Privacy
agreement line. They sit separately on the page.

## Investigate before building (report first, no code)

1. Find the existing Terms of Use and Privacy Policy routes/URLs so the links point
   correctly.
2. Find the signup page component(s) — email path and the Google "one more thing" step.
3. Confirm whether any terms/privacy text already exists today (adding vs. correcting).

Report findings + short plan, then build after approval.

## Acceptance

- Agreement line appears under the Create account button on both signup paths.
- Both links open the correct existing Terms / Privacy pages.
- No checkbox for this line (passive agreement).
- SMS consent checkbox (separate) remains untouched.
- eslint clean, build passes.

## Scope & commit

- Scope: signup page component(s) (+ optional login footer link if confirmed).
- Small isolated PR on a branch off `main` (e.g. `feat/signup-terms-privacy-line`).
