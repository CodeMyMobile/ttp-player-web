export const normalizeProfileRating = (value) => {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  return String(value);
};

export const formatCalculatedRating = (value) => (
  value ? value : "Not available"
);
