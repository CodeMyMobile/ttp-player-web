export const getAuthNavState = ({ isAuthenticated, displayName, initials, avatarUrl }) => {
  if (!isAuthenticated) {
    return {
      isAuthenticated: false,
      displayName: "Player",
      initials: "PL",
      avatarUrl: null,
    };
  }

  return {
    isAuthenticated: true,
    displayName,
    initials,
    avatarUrl,
  };
};
