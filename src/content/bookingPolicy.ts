/**
 * Cancellation and agreement copy for class booking, in one place.
 *
 * Four different wordings had grown across the details page, the booking page
 * and the post-booking modal, and two of them were false in the player's
 * disfavour: "Cancellations within 24 hours are non-refundable" and "may be
 * subject to a fee" both imply you can cancel inside the window and lose money.
 *
 * You cannot cancel at all. Validators/player_lessons.js:206 rejects the
 * request outright:
 *
 *   if (hoursDifference !== null && hoursDifference < 24) {
 *     return { error: "Lesson cannot be canceled within 24h of the start time.", code: 400 };
 *   }
 *
 * So the copy says what the code does: free until 24 hours out, locked after.
 * Shared as strings rather than a component so the two pages keep their own
 * layout but cannot drift on the promise itself.
 */

/** Card and credit bookings. */
export const CANCELLATION_POLICY =
  "Free cancellation up to 24 hours before your class. After that the class can't be cancelled.";

/** Pay on the day: the same window, and no card is charged either way. */
export const CANCELLATION_POLICY_PAY_ON_COURT =
  "Free cancellation up to 24 hours before your class. After that the class can't be cancelled. No card charge is created for pay on court.";

/** Shown after booking, where it reads as a reminder rather than a term. */
export const CANCELLATION_POLICY_CONFIRMED =
  "Cancellation policy: free cancellation up to 24 hours before your class. After that the class can't be cancelled.";

/** Precedes the Player Code of Conduct control, which opens the modal. */
export const CONDUCT_AGREEMENT_PREFIX = "By booking, you agree to our ";

export const cancellationPolicyFor = (payOnCourt: boolean) =>
  payOnCourt ? CANCELLATION_POLICY_PAY_ON_COURT : CANCELLATION_POLICY;
