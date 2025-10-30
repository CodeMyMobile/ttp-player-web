export const getDisplayName = (user) => {
  if (!user) {
    return "Player";
  }

  const name = user.name || user.full_name || user.first_name;
  if (name) {
    return name;
  }

  if (user.email) {
    return user.email.split("@")[0];
  }

  return "Player";
};

export const getInitials = (displayName, email) => {
  if (displayName) {
    const parts = String(displayName).trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  }

  if (email) {
    return email.slice(0, 2).toUpperCase();
  }

  return "MP";
};
