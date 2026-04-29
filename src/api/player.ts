import { request } from "./http";

export interface PlayerLesson {
  id: number;
  status?: string;
  startTime?: string;
  endTime?: string;
  coachId?: number;
  [key: string]: unknown;
}

export interface PlayerCoachLessonHistoryParams {
  token: string;
  coachId: number | string;
  date?: string;
  perPage?: number;
  page?: number;
  signal?: AbortSignal;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta?: {
    pagination?: {
      total?: number;
      per_page?: number;
      current_page?: number;
      total_pages?: number;
    };
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface UploadUrlResponse {
  uploadURL: string;
  fileURL?: string;
  [key: string]: unknown;
}

export const getPlayerUpcomingLessons = async (token: string) =>
  request<PaginatedResponse<PlayerLesson>>("/player/upcoming_lessons", {
    token,
  });

export const getDynamicFilters = async (token: string) =>
  request<Record<string, unknown>>("/player/filters", {
    token,
  });

export const getPlayerUpcomingLessonsById = async (token: string, lessonId: number | string) =>
  request<PlayerLesson>(`/player/upcoming_lessons/${lessonId}`, {
    token,
  });

export const getPlayerCoachLessonHistory = async ({
  token,
  coachId,
  date,
  perPage,
  page,
  signal,
}: PlayerCoachLessonHistoryParams) =>
  request<PaginatedResponse<PlayerLesson> | PlayerLesson[] | { lessons?: PlayerLesson[]; data?: PlayerLesson[] }>(
    `/player/coach/lessons/history/${coachId}`,
    {
      token,
      signal,
      query: {
        ...(date ? { date } : {}),
        ...(typeof perPage === "number" ? { perPage } : {}),
        ...(typeof page === "number" ? { page } : {}),
      },
    },
  );

export interface UpdatePlayerLessonParams {
  token: string;
  status: string;
  paymentMethodId?: number | string | null;
  lessonId: number | string;
}

export const updatePlayerLesson = async ({
  token,
  status,
  paymentMethodId,
  lessonId,
}: UpdatePlayerLessonParams) =>
  request<PlayerLesson>(`/player/upcoming_lessons/${lessonId}`, {
    method: "PATCH",
    token,
    body: {
      status,
      ...(paymentMethodId ? { payment_method_id: paymentMethodId } : {}),
    },
  });

export const getPlayerAWSUrl = async (token: string, fileType: string) =>
  request<UploadUrlResponse>("/player/profile_picture/upload_url", {
    method: "POST",
    token,
    body: {
      file_extension: fileType,
    },
  });

const toBlob = async (input: string | Blob | ArrayBuffer | ArrayBufferView) => {
  if (typeof input === "string") {
    const response = await fetch(input);
    if (!response.ok) {
      throw new Error("Unable to load image from URI");
    }
    return await response.blob();
  }
  if (input instanceof Blob) {
    return input;
  }
  if (input instanceof ArrayBuffer || ArrayBuffer.isView(input)) {
    const buffer = input instanceof ArrayBuffer ? input : input.buffer;
    return new Blob([buffer]);
  }
  throw new Error("Unsupported image source type");
};

export const putPlayerAWSUrl = async (
  url: string,
  localImageUri: string | Blob | ArrayBuffer | ArrayBufferView,
  imageMimeSuffix: string,
) => {
  const blob = await toBlob(localImageUri);
  const response = await fetch(url, {
    method: "PUT",
    headers: {
      "Content-Type": `image/${imageMimeSuffix}`,
    },
    body: blob,
  });

  if (!response.ok) {
    throw new Error("Failed to upload image to signed URL");
  }

  if (response.status === 204) return undefined;
  try {
    return await response.json();
  } catch {
    return undefined;
  }
};
