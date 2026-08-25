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
