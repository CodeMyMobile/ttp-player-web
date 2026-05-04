export const ARCHIVE_FILTER_VALUE = "archieve";
export const MATCH_ARCHIVED_ERROR = "match_archived";

const extractErrorCode = (error) => {
  if (!error) return "";
  return (
    error?.data?.error ||
    error?.response?.data?.error ||
    error?.message ||
    ""
  );
};

export const isMatchArchivedError = (error) => {
  if (!error) return false;
  const status = error.status ?? error?.response?.status;
  if (Number(status) !== 410) return false;
  return extractErrorCode(error) === MATCH_ARCHIVED_ERROR;
};

export const getMatchArchivedErrorCode = extractErrorCode;
