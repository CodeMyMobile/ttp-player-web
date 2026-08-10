export type LeagueAuthUser = {
  session?: { access_token?: string | null } | null;
  access_token?: string | null;
  token?: string | null;
} | null | undefined;

const hasValue = (value: unknown): value is string =>
  typeof value === "string" && value.trim() !== "";

export const resolveLeagueAuthToken = ({
  storedToken,
  user,
}: {
  storedToken?: string | null;
  user?: LeagueAuthUser;
}) =>
  hasValue(storedToken)
    ? storedToken
    : user?.session && hasValue(user.session.access_token)
      ? user.session.access_token
      : hasValue(user?.access_token)
        ? user.access_token
        : hasValue(user?.token)
          ? user.token
          : undefined;
