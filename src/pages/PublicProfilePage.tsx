import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { Lock } from "lucide-react";

import MainLayout from "../components/MainLayout";
import { useAuth } from "../context/AuthContext";
import { getPublicProfileCard, type PublicProfileCard } from "../api/publicProfile";
import { normalizeProfileSlug, rememberProfileRef } from "../utils/publicProfileLink";
import "../components/profileShare/profileShare.css";
import "./PublicProfilePage.css";

type LoadState =
  | { kind: "loading" }
  | { kind: "missing" }
  | { kind: "error" }
  | { kind: "ready"; card: PublicProfileCard };

/**
 * /p/:slug, the link players share. It resolves the slug and opens the player's
 * full profile (/players/:id), which already handles signed-out visitors. The slug
 * is saved first so the sharer is credited if a signed-out visitor joins. A link
 * the player has turned off, or one that matches nobody, says so here instead.
 */
const PublicProfilePage = () => {
  const { slug: rawSlug } = useParams();
  const slug = normalizeProfileSlug(rawSlug);
  const { isAuthenticated } = useAuth();
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

  // Saved on arrival: they may sign up later, after leaving the profile.
  useEffect(() => {
    if (slug && !isAuthenticated) rememberProfileRef(slug);
  }, [slug, isAuthenticated]);

  // Replace, so Back doesn't land on /p/:slug and bounce forward again.
  if (state.kind === "ready" && !state.card.private) {
    return <Navigate to={`/players/${state.card.user_id}`} replace />;
  }

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
      </main>
    </MainLayout>
  );
};

export default PublicProfilePage;
