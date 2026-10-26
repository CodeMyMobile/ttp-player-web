import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Lock, MapPin, MessageCircle, Send } from "lucide-react";

import MainLayout from "../components/MainLayout";
import { useAuth } from "../context/AuthContext";
import { useAuthDrawer } from "../context/AuthDrawerContext";
import { getPublicProfileCard, type PublicProfileCard } from "../api/publicProfile";
import useHitRequest, { hitRequestErrorMessage } from "../hooks/useHitRequest";
import { getStoredAuthToken } from "../services/authToken";
import { getAvatarInitials } from "../play-dates/utils/avatar";
import { joinCourts, normalizeProfileSlug, rememberProfileRef } from "../utils/publicProfileLink";
import "../components/profileShare/profileShare.css";
import "./PublicProfilePage.css";

// Same resolution as PlayerProfilePage: the player id (user_id) from the session user,
// falling back to the stored login response.
const signedInPlayerId = (user: Record<string, unknown> | null | undefined): string | null => {
  const session = user?.session as Record<string, unknown> | undefined;
  const fromUser = user?.user_id ?? user?.userId ?? session?.user_id ?? user?.id;
  if (typeof fromUser === "string" || typeof fromUser === "number") return String(fromUser);
  try {
    const parsed = JSON.parse(window.localStorage.getItem("authLoginResponse") || "null") as Record<string, unknown> | null;
    const profile = parsed?.profile as Record<string, unknown> | undefined;
    const stored = parsed?.user_id ?? profile?.user_id ?? (parsed?.user as Record<string, unknown> | undefined)?.user_id;
    return typeof stored === "string" || typeof stored === "number" ? String(stored) : null;
  } catch {
    return null;
  }
};

type LoadState =
  | { kind: "loading" }
  | { kind: "missing" }
  | { kind: "error" }
  | { kind: "ready"; card: PublicProfileCard };

/**
 * /p/:slug, the link players share. Shows only the public card (name and last
 * initial, photo, rating, home courts), never contact details. Signed-out visitors
 * get a sign-up prompt, and the slug is saved so the sharer is credited if they join.
 */
const PublicProfilePage = () => {
  const { slug: rawSlug } = useParams();
  const slug = normalizeProfileSlug(rawSlug);
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const { openAuth } = useAuthDrawer();
  const hitRequest = useHitRequest();
  const [state, setState] = useState<LoadState>({ kind: "loading" });

  useEffect(() => {
    if (!slug) {
      setState({ kind: "missing" });
      return undefined;
    }
    let cancelled = false;
    setState({ kind: "loading" });
    getPublicProfileCard(slug)
      .then((card) => {
        if (!cancelled) setState({ kind: "ready", card });
      })
      .catch((error: { status?: number }) => {
        if (!cancelled) setState({ kind: error?.status === 404 ? "missing" : "error" });
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  // Saved on arrival, not only on the button: they may sign up later from elsewhere.
  useEffect(() => {
    if (slug && !isAuthenticated) rememberProfileRef(slug);
  }, [slug, isAuthenticated]);

  const card = state.kind === "ready" && !state.card.private ? state.card : null;
  const firstName = card ? card.display_name.split(" ")[0] : "";
  const ownUserId = signedInPlayerId(user);
  const isOwnProfile = Boolean(card && ownUserId !== null && String(card.user_id) === ownUserId);

  const inviteToHit = () => {
    if (!card) return;
    const token = getStoredAuthToken({ defaultScheme: "token", preferScheme: "token" });
    if (!token) return;
    void hitRequest.send({ token, playerId: String(card.user_id), playerName: firstName });
  };

  const joinToPlay = () => {
    if (slug) rememberProfileRef(slug);
    openAuth({ mode: "signup", reason: `Join The Tennis Plan to play with ${firstName}.` });
  };

  const hitLabel =
    hitRequest.status === "sending"
      ? "Sending…"
      : hitRequest.status === "sent"
        ? "Request sent"
        : hitRequest.status === "connected"
          ? "Connected"
          : "Invite to hit";

  return (
    <MainLayout>
      <main className="pprofile">
        {state.kind === "loading" ? <p className="pprofile__status">Loading profile…</p> : null}
        {state.kind === "missing" ? (
          <section className="pprofile__panel">
            <h1>Profile not found</h1>
            <p>This link doesn&apos;t match a player. Check it with whoever sent it.</p>
            <Link className="pshare-secondary pprofile__link" to="/find-players">
              Find players near you
            </Link>
          </section>
        ) : null}
        {state.kind === "error" ? (
          <section className="pprofile__panel">
            <h1>Couldn&apos;t load this profile</h1>
            <p>Please try again in a moment.</p>
          </section>
        ) : null}
        {state.kind === "ready" && state.card.private ? (
          <section className="pprofile__panel">
            <Lock size={28} aria-hidden="true" className="pprofile__lock" />
            <h1>This profile is private</h1>
            <p>The player has turned off their public profile link.</p>
          </section>
        ) : null}

        {card ? (
          <section className="pprofile__panel" aria-labelledby="pprofile-name">
            <span className="pshare-avatar pprofile__avatar" aria-hidden="true">
              {card.profile_picture ? <img src={card.profile_picture} alt="" /> : getAvatarInitials(card.display_name)}
            </span>
            <h1 id="pprofile-name">{card.display_name}</h1>
            {card.rating ? <span className="pshare-rating">NTRP {card.rating}</span> : null}
            {card.home_courts.length ? (
              <p className="pshare-card__courts pprofile__courts">
                <MapPin size={14} aria-hidden="true" />
                Usually plays at {joinCourts(card.home_courts)}
              </p>
            ) : null}

            {isOwnProfile ? (
              <p className="pprofile__note">This is how other players see your profile link.</p>
            ) : isAuthenticated ? (
              <div className="pprofile__actions">
                <button
                  type="button"
                  className="pshare-primary"
                  onClick={inviteToHit}
                  disabled={hitRequest.status !== "idle" && hitRequest.status !== "error"}
                >
                  <Send size={18} aria-hidden="true" />
                  {hitLabel}
                </button>
                <button
                  type="button"
                  className="pshare-secondary"
                  onClick={() => navigate(`/players/${card.user_id}`)}
                >
                  <MessageCircle size={18} aria-hidden="true" />
                  Connect
                </button>
                {hitRequest.status === "sent" ? (
                  <p className="pprofile__note" role="status">
                    We&apos;ve texted {firstName}. If they accept, we&apos;ll text you each other&apos;s number.
                  </p>
                ) : null}
                {hitRequest.status === "error" ? (
                  <p className="pprofile__error" role="alert">
                    {hitRequest.error || hitRequestErrorMessage(null, firstName)}
                  </p>
                ) : null}
              </div>
            ) : (
              <div className="pprofile__actions">
                <button type="button" className="pshare-primary" onClick={joinToPlay}>
                  Join to play with {firstName}
                </button>
                <p className="pprofile__note">Free to join. Your contact details stay private.</p>
              </div>
            )}
          </section>
        ) : null}
      </main>
    </MainLayout>
  );
};

export default PublicProfilePage;
