// Direct-challenge seam for the "Your next move" Rung 3b action.
//
// FLAG / TODO: This is a STUB. The real direct-challenge flow is a backend
// dependency that Rung 3b needs — sending a challenge to a specific opponent
// (create challenge → notify opponent → land in their "respond" queue). It is
// intentionally hidden behind this typed interface so the dashboard can render
// and wire the CTA today; swap this implementation for a real API call
// (e.g. POST /leagues/:id/challenges) without touching any component.

export interface ChallengeService {
  /** Challenge a specific opponent to a league match. Resolves when accepted by
   *  the backend for delivery (NOT when the opponent responds). */
  challenge(opponentId: string): Promise<void>;
}

export const challengeService: ChallengeService = {
  async challenge(opponentId: string): Promise<void> {
    // TODO: replace with real API call. See FLAG above.
    // eslint-disable-next-line no-console
    console.info(`[challengeService] stub: would challenge opponent ${opponentId}`);
  },
};
