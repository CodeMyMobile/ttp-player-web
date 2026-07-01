type EstimateBadgeInput = {
  is_estimate?: boolean;
  is_provisional?: boolean;
};

export const shouldShowEstimateBadge = (ranking: EstimateBadgeInput) => {
  return Boolean(ranking.is_estimate);
};
