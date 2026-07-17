const extractProfile = (session) =>
  session?.profile || session?.user || session?.player || session?.personal_details || {};

export const buildCompletedSignupSession = ({
  session,
  updatedProfile,
  phone,
  fullName,
}) => {
  const baseProfile = extractProfile(session);
  const nextProfile = {
    ...baseProfile,
    ...(updatedProfile && typeof updatedProfile === "object" ? updatedProfile : {}),
    phone,
    full_name: fullName || updatedProfile?.full_name || baseProfile?.full_name,
  };

  return {
    ...session,
    phone,
    full_name: fullName || session?.full_name,
    profile: nextProfile,
  };
};
