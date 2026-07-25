import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useAuthDrawer } from "../context/AuthDrawerContext";
import { canChallenge } from "../utils/challengeEntitlement";

export type ChallengeOpponent = {
  id: number | string;
  name: string;
  ntrp?: string;
};

// One place the ladder, profile, and (later) suggested strip all route challenge
// initiation through: entitlement gate → sign-in gate → hand off to the match flow
// with the opponent pre-passed. Keeping this as a hook (not a shared component)
// matches the repo's inline-over-shared preference for drift-prone logic.
export function useChallenge() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { openAuth } = useAuthDrawer();

  return (opponent: ChallengeOpponent) => {
    if (opponent?.id == null || !canChallenge({ isAuthenticated })) return;
    const challengeOpponent = { id: opponent.id, name: opponent.name, ntrp: opponent.ntrp };
    const launch = () =>
      navigate("/matches", { state: { openNewMatch: true, challengeOpponent } });
    if (!isAuthenticated) {
      openAuth({
        mode: "signup",
        reason: `Sign in or create an account to challenge ${opponent.name}.`,
        onSuccess: launch,
      });
      return;
    }
    launch();
  };
}
