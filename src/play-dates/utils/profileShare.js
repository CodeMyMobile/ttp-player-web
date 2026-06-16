export const getProfileShareUserId = (user) => {
  if (!user || typeof user !== "object") return null;
  return (
    user.user_id ??
    user.userId ??
    user.profile?.user_id ??
    user.profile?.userId ??
    user.personalDetails?.user_id ??
    user.personalDetails?.userId ??
    user.player_id ??
    user.playerId ??
    user.profile?.player_id ??
    user.profile?.playerId ??
    user.id ??
    user.profile?.id ??
    null
  );
};

export const buildPlayerProfileShareUrl = (playerId, origin) => {
  if (playerId === undefined || playerId === null) return "";
  const normalizedId = String(playerId).trim();
  if (!normalizedId || !origin) return "";
  return `${String(origin).replace(/\/+$/, "")}/#/player/profile/${encodeURIComponent(normalizedId)}`;
};
