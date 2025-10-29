import api, { unwrap } from "./api";
import { normalizeAuthToken } from "./authToken";

export const updatePlayerPersonalDetails = async ({
  player = null,
  id = null,
  date_of_birth = null,
  usta_rating = null,
  uta_rating = null,
  fullName = null,
  mobile = null,
  about_me = null,
  profile_picture,
}) => {
  const authHeader = normalizeAuthToken(player, {
    defaultScheme: "token",
    preferScheme: "token",
  });
  if (!authHeader) {
    throw new Error("Missing player token");
  }
  if (!id) {
    throw new Error("Missing player id");
  }

  const params = Object.entries({
    id,
    date_of_birth,
    usta_rating,
    uta_rating,
    full_name: fullName,
    phone: mobile,
    about_me,
    profile_picture,
  }).reduce((acc, [key, value]) => {
    if (value !== undefined) {
      acc[key] = value;
    }
    return acc;
  }, {});

  return unwrap(
    api(`/player/personal_details/${id}`, {
      method: "PATCH",
      authToken: authHeader,
      authSchemePreference: "token",
      json: params,
    }),
  );
};
