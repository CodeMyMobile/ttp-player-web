import { request } from "./http";
import { getStoredAuthToken } from "../services/authToken";

/** The signed-in player's own shareable link. */
export interface PublicProfileLink {
  slug: string;
  enabled: boolean;
  display_name: string;
}

/** What anyone with the link sees. A player who turned the link off is `{ private: true }`. */
export type PublicProfileCard =
  | { slug: string; private: true }
  | {
      slug: string;
      private: false;
      user_id: number;
      display_name: string;
      profile_picture: string | null;
      rating: string | null;
      home_courts: string[];
    };

const ownToken = () => getStoredAuthToken({ preferScheme: "token" }) ?? undefined;

export const getMyPublicLink = () =>
  request<PublicProfileLink>("/player/public-link", { token: ownToken() });

export const setPublicLinkEnabled = (enabled: boolean) =>
  request<PublicProfileLink, { enabled: boolean }>("/player/public-link", {
    method: "PATCH",
    token: ownToken(),
    body: { enabled },
  });

export const getPublicProfileCard = (slug: string) =>
  request<PublicProfileCard>(`/public/players/by-slug/${encodeURIComponent(slug)}`);

export const reportReferral = (ref: string) =>
  request<{ recorded: boolean; reason?: string }, { ref: string }>("/player/referral", {
    method: "POST",
    token: ownToken(),
    body: { ref },
  });
