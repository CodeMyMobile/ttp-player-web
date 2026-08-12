import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowRight, CheckCircle2, LogIn, RefreshCw } from "lucide-react";
import AppNav from "../components/AppNav.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useAuthDrawer } from "../context/AuthDrawerContext.jsx";
import { claimTokenFromSearch } from "./claimRoute.js";
import { claimRestringingOrder, getClaimPreview } from "./restringingService.js";

const ordersPath = "/restring?screen=orders";

const firstItemText = (item) => {
  if (!item) return "Your restring";
  return [
    item.racket_make_model,
    item.string_description,
    item.tension_label,
  ].filter(Boolean).join(" • ") || "Your restring";
};

export default function RestringingClaimPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { openAuth } = useAuthDrawer();
  const token = useMemo(() => claimTokenFromSearch(location.search), [location.search]);
  const [loading, setLoading] = useState(Boolean(token));
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState(token ? "" : "This claim link is missing a token.");
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    if (!token) return;
    let mounted = true;
    setLoading(true);
    setError("");
    getClaimPreview(token)
      .then((data) => {
        if (!mounted) return;
        setPreview(data);
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err?.data?.detail || err?.message || "This claim link is no longer available.");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [token]);

  const order = preview?.order || {};
  const vendor = preview?.vendor || {};
  const items = Array.isArray(order.items) ? order.items : [];
  const primaryItem = firstItemText(items[0]);

  const claim = async () => {
    if (!token || claiming) return;
    setClaiming(true);
    setError("");
    try {
      await claimRestringingOrder(token);
      navigate(ordersPath);
    } catch (err) {
      setError(err?.data?.detail || err?.message || "We could not claim this restring for this account.");
    } finally {
      setClaiming(false);
    }
  };

  const signIn = () => {
    openAuth({
      mode: "signin",
      reason: "Sign in or create an account to claim this restring and save it to your string history.",
      onSuccess: () => void claim(),
    });
  };

  useEffect(() => {
    if (isAuthenticated && preview && !claiming) void claim();
  }, [isAuthenticated, preview]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <AppNav />
      <main className="rsg-shell">
        <Link className="rsg-back" to="/restring">
          Back to restringing
        </Link>

        <section className="rsg-hero compact">
          <h1>Claim your restring</h1>
          <p>Save this order to your string history.</p>
        </section>

        {loading || authLoading ? (
          <section className="rsg-card">
            <RefreshCw size={22} />
            <p>Loading claim link...</p>
          </section>
        ) : null}

        {!loading && error ? (
          <section className="rsg-card">
            <h1>Link unavailable</h1>
            <p>{error}</p>
            <Link className="rsg-primary" to="/restring">
              Start a restring order <ArrowRight size={18} />
            </Link>
          </section>
        ) : null}

        {!loading && !error && preview ? (
          <section className="rsg-card rsg-done">
            <CheckCircle2 size={36} />
            <span className="rsg-pill">{vendor.name || "The Tennis Plan"}</span>
            <h1>Order #{order.id}</h1>
            <p>{primaryItem}</p>
            {items.length > 1 ? <p>{items.length} rackets on this order.</p> : null}
            {order.masked_phone ? <p>Linked phone: {order.masked_phone}</p> : null}
            {isAuthenticated ? (
              <button type="button" className="rsg-primary" onClick={claim} disabled={claiming}>
                {claiming ? "Claiming..." : "Claim restring"} <ArrowRight size={18} />
              </button>
            ) : (
              <button type="button" className="rsg-primary" onClick={signIn} disabled={claiming}>
                <LogIn size={18} /> {claiming ? "Claiming..." : "Sign in to claim"}
              </button>
            )}
          </section>
        ) : null}
      </main>
    </>
  );
}
