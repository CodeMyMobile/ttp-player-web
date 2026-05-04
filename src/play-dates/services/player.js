import api, { unwrap } from "./api";
import { normalizeAuthToken } from "./authToken";

const quantizeRating = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return undefined;
  }

  const quantized = Math.round(numeric * 2) / 2;
  if (!Number.isFinite(quantized) || quantized < 0) {
    return undefined;
  }

  return quantized;
};

export const normalizeRatingForApi = (value) => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  const trimmed = String(value).trim();
  if (!trimmed) {
    return undefined;
  }

  const quantized = quantizeRating(trimmed);
  if (quantized === undefined) {
    return undefined;
  }

  return quantized.toFixed(1);
};

const personalDetailsEndpoint = "/player/personal_details/";

export const updatePlayerPersonalDetails = async ({
  player = null,
  id: rawId = null,
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

  const normalizedUstaRating = normalizeRatingForApi(usta_rating);
  const normalizedUtaRating = normalizeRatingForApi(uta_rating);

  const coerceRatingForTransport = (value) => {
    if (value === undefined || value === null) {
      return value;
    }

    const quantized = quantizeRating(value);
    if (quantized === undefined) {
      return undefined;
    }

    return quantized;
  };

  const ustaRatingForApi = coerceRatingForTransport(normalizedUstaRating);
  const utaRatingForApi = coerceRatingForTransport(normalizedUtaRating);

  const resourceId =
    rawId === null || rawId === undefined ? null : String(rawId).trim();

  const params = Object.entries({
    date_of_birth,
    usta_rating: ustaRatingForApi,
    uta_rating: utaRatingForApi,
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

  const method = resourceId ? "PATCH" : "POST";
  const path = resourceId
    ? `${personalDetailsEndpoint}${resourceId.replace(/\/+$/, "")}/`
    : personalDetailsEndpoint;

  return unwrap(
    api(path, {
      method,
      authToken: authHeader,
      authSchemePreference: "token",
      json: params,
    }),
  );
};
