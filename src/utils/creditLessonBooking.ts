export const ensureCreditLessonId = async ({
  existingLessonId,
  isPlayerRequestedPrivateLesson,
  createPrivateLesson,
}: {
  existingLessonId?: number;
  isPlayerRequestedPrivateLesson: boolean;
  createPrivateLesson: () => Promise<number>;
}) => {
  if (existingLessonId) {
    return existingLessonId;
  }

  if (!isPlayerRequestedPrivateLesson) {
    return undefined;
  }

  return createPrivateLesson();
};

export const createSingleFlightRequest = <T>(request: () => Promise<T>) => {
  let inFlight: Promise<T> | undefined;

  return () => {
    if (!inFlight) {
      inFlight = request().catch((error) => {
        inFlight = undefined;
        throw error;
      });
    }
    return inFlight;
  };
};

/**
 * A credits booking creates the lesson first and attaches the credit after. When the
 * credit never lands (a declined card, a cancelled Apple Pay, an expired package),
 * cancel the lesson this attempt created, so it isn't left pending for the coach with
 * nothing to charge. Never touches a lesson that existed before (a coach's own lesson,
 * or one from an earlier attempt), and never throws: the player's error is the one
 * that matters.
 */
export const abandonCreditLesson = async ({
  lessonId,
  createdThisAttempt,
  cancelLesson,
}: {
  lessonId?: number;
  createdThisAttempt: boolean;
  cancelLesson: (lessonId: number) => Promise<unknown>;
}) => {
  if (!lessonId || !createdThisAttempt) return false;
  try {
    await cancelLesson(lessonId);
    return true;
  } catch (error) {
    console.error("Couldn't cancel the unpaid lesson request", error);
    return false;
  }
};
