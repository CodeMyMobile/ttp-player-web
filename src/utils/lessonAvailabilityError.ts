export const LESSON_UNAVAILABLE_TO_BOOK_MESSAGE = "This class isn't available to book.";

export const isCoachBlockedPlayerError = (error: unknown) => {
  const data = (error as { data?: Record<string, unknown> } | null)?.data;
  const code = data?.code ?? data?.error;
  return code === "coach_blocked_player";
};

export const getLessonAvailabilityErrorMessage = (error: unknown, fallback: string) => {
  if (isCoachBlockedPlayerError(error)) {
    return LESSON_UNAVAILABLE_TO_BOOK_MESSAGE;
  }

  if (error && typeof error === "object") {
    const data = (error as { data?: Record<string, unknown> }).data;
    const detail = data?.detail;
    const message = data?.message;
    if (typeof detail === "string" && detail.trim()) {
      return detail;
    }
    if (typeof message === "string" && message.trim()) {
      return message;
    }
  }
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return fallback;
};
