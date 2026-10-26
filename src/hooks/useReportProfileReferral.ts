import { useEffect } from "react";

import { reportReferral } from "../api/publicProfile";
import { forgetProfileRef, readProfileRef } from "../utils/publicProfileLink";

/**
 * Credits the player whose /p/:slug link a signed-out visitor arrived from, once they
 * have an account. Mounted once at the top of the app (App.jsx), so it runs wherever a
 * new account lands, and sign-up code stays untouched. The API decides eligibility (new accounts only, once, never yourself),
 * so any answer clears the saved slug; only a failed request leaves it for next time.
 */
export default function useReportProfileReferral(isAuthenticated: boolean) {
  useEffect(() => {
    if (!isAuthenticated) return;
    const ref = readProfileRef();
    if (!ref) return;
    reportReferral(ref)
      .then(() => forgetProfileRef())
      .catch((error: { status?: number }) => {
        if (error?.status && error.status < 500) forgetProfileRef();
      });
  }, [isAuthenticated]);
}
