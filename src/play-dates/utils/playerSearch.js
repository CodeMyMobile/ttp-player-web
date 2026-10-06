const firstNonEmptyValue = (values) =>
  values.find((value) => value !== undefined && value !== null && String(value).trim() !== "");

export const getPlayerSearchId = (player = {}) =>
  firstNonEmptyValue([player.user_id, player.id]);

export const getPlayerSearchName = (player = {}) => {
  const name = firstNonEmptyValue([player.full_name, player.name]);
  if (name) return String(name).trim();

  const id = firstNonEmptyValue([player.user_id, player.id]);
  return id ? `Player ${id}` : "Player";
};

export const getPlayerSearchRating = (player = {}) =>
  firstNonEmptyValue([
    player.usta_rating,
    player.uta_rating,
    player.skill_level,
    player.ntrp,
  ]) || "";
