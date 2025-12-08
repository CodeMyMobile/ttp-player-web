export const ARCHIVE_FILTER_VALUE = "archieve";
export const MATCH_ARCHIVED_ERROR = "match_archived";

const extractErrorCode = (error: unknown): string => {
  if (!error || typeof error !== "object") return "";
  const candidate =
    (error as { data?: { error?: string } })?.data?.error ??
    (error as { response?: { data?: { error?: string } } })?.response?.data?.error ??
    (error as { message?: string }).message ??
    "";
  return typeof candidate === "string" ? candidate : "";
};

export const isMatchArchivedError = (error: unknown): boolean => {
  if (!error || typeof error !== "object") return false;
  const status =
    (error as { status?: number }).status ??
    (error as { response?: { status?: number } }).response?.status;
  if (Number(status) !== 410) return false;
  return extractErrorCode(error) === MATCH_ARCHIVED_ERROR;
};
