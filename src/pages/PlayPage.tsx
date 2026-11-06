import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronRight, ClipboardList, ListOrdered, Swords, Trophy } from "lucide-react";

import MainLayout from "../components/MainLayout";
import { listMyLeagues } from "../api/leagues";
import { useAuth } from "../context/AuthContext";
import { getStoredAuthToken } from "../services/authToken";
import { leaguesDestination } from "../utils/navTabs";

import "./PlayPage.css";

type MyLeague = { id: number | string; name?: string | null };

/**
 * The Play tab (My Week on): match play, leagues and the ladder in one place, plus logging a
 * score, which the + sheet no longer offers. Leagues opens the player's one league directly,
 * the way the old Leagues tab did.
 */
const PlayPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const token = useMemo(
    () =>
      user?.session?.access_token ??
      user?.access_token ??
      user?.token ??
      getStoredAuthToken({ preferScheme: "token" }) ??
      undefined,
    [user],
  );
  // null until loaded; a failed load reads as none, and the card opens the list.
  const [leagues, setLeagues] = useState<MyLeague[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    listMyLeagues({ token })
      .then((res) => {
        if (!cancelled) setLeagues((res.leagues ?? []) as MyLeague[]);
      })
      .catch(() => {
        if (!cancelled) setLeagues([]);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const leaguesLine =
    leagues === null
      ? "Your leagues"
      : leagues.length === 1
        ? leagues[0].name || "Your league"
        : leagues.length > 1
          ? `${leagues.length} leagues`
          : "Find a league to join";

  const cards = [
    {
      key: "matches",
      title: "Match play",
      line: "Find a match or start one",
      icon: Swords,
      onOpen: () => navigate("/matches"),
    },
    {
      key: "leagues",
      title: "Leagues",
      line: leaguesLine,
      icon: Trophy,
      onOpen: () => navigate(leaguesDestination(leagues)),
    },
    {
      key: "ladder",
      title: "Ladder",
      line: "Rankings and recent results",
      icon: ListOrdered,
      onOpen: () => navigate("/ladder"),
    },
  ];

  return (
    <MainLayout mobileChrome="home">
      <main className="play-page">
        <h1 className="play-page__title">Play</h1>
        <ul className="play-page__cards">
          {cards.map(({ key, title, line, icon: Icon, onOpen }) => (
            <li key={key}>
              <button type="button" className="play-page__card" onClick={onOpen}>
                <span className="play-page__icon" aria-hidden="true">
                  <Icon size={22} />
                </span>
                <span className="play-page__copy">
                  <span className="play-page__card-title">{title}</span>
                  <span className="play-page__card-line">{line}</span>
                </span>
                <ChevronRight size={18} className="play-page__chevron" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
        <Link to="/log-result" className="play-page__row">
          <ClipboardList size={18} aria-hidden="true" />
          <span>Log a score</span>
          <ChevronRight size={16} className="play-page__chevron" aria-hidden="true" />
        </Link>
      </main>
    </MainLayout>
  );
};

export default PlayPage;
