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

const foldForSearch = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

// Every word typed has to appear somewhere in the name, so "paul coch" and
// "coch paul" both find Paul Cochrane, and "jose" finds José.
export const filterPlayersByName = (players = [], query = "") => {
  const terms = foldForSearch(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return players;
  return players.filter((player) => {
    const name = foldForSearch(getPlayerSearchName(player));
    return terms.every((term) => name.includes(term));
  });
};
