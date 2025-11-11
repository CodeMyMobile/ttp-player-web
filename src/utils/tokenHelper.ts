const ACCESS_TOKEN_KEY = "authToken";
const REFRESH_TOKEN_KEY = "refreshToken";

const readStorage = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const writeStorage = (key: string, value: string | null) => {
  try {
    if (value === null || value === undefined || value === "") {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, value);
    }
  } catch {
    // ignore storage write failures
  }
};

export const storeTokens = async (accessToken?: string | null, refreshToken?: string | null) => {
  if (accessToken !== undefined) {
    writeStorage(ACCESS_TOKEN_KEY, accessToken ?? null);
  }
  if (refreshToken !== undefined) {
    writeStorage(REFRESH_TOKEN_KEY, refreshToken ?? null);
  }
};

export const getAccessToken = async () => readStorage(ACCESS_TOKEN_KEY);

export const getRefreshToken = async () => readStorage(REFRESH_TOKEN_KEY);

export const removeTokens = async () => {
  writeStorage(ACCESS_TOKEN_KEY, null);
  writeStorage(REFRESH_TOKEN_KEY, null);
};
