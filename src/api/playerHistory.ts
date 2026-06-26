import { request } from "./http";
import {
  normalizePlayedWithResponse,
  type PlayedWithResponse,
} from "../utils/playedWith";

export const getPlayedWith = async (
  playerId: string | number,
  { signal, token }: { signal?: AbortSignal; token?: string | null } = {},
): Promise<PlayedWithResponse> => {
  const response = await request<unknown>(`/players/${playerId}/played-with`, {
    signal,
    token: token ?? undefined,
  });
  return normalizePlayedWithResponse(response);
};
