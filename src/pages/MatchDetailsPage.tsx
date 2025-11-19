import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Calendar, MapPin, MessageCircle, Star, Users } from "lucide-react";

import { getMatchById, normalizeMatchDetail, type NormalizedMatch } from "../api/matches";
import MainLayout from "../components/MainLayout";
import { getStoredAuthToken } from "../services/authToken";

import "./MatchDetailsPage.css";

const MatchDetailsPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [match, setMatch] = useState<NormalizedMatch | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshIndex, setRefreshIndex] = useState(0);

  const loadMatch = useMemo(() => {
    return async (signal: AbortSignal) => {
      if (!id) return;
      setIsLoading(true);
      setError(null);

      try {
        const token = getStoredAuthToken({ preferScheme: "Token" });
        const response = await getMatchById(id, {
          token: token ?? undefined,
          signal,
          includeHidden: true,
        });
        const normalized = normalizeMatchDetail(response);
        setMatch(normalized);
      } catch (loadError) {
        if (signal.aborted) return;
        console.error("Failed to load match details", loadError);
        setError(loadError instanceof Error ? loadError.message : "Unable to load match details.");
      } finally {
        if (!signal.aborted) {
          setIsLoading(false);
        }
      }
    };
  }, [id]);

  useEffect(() => {
    const controller = new AbortController();
    loadMatch(controller.signal);
    return () => controller.abort();
  }, [loadMatch, refreshIndex]);

  const playersJoined = match?.playersJoined ?? 0;
  const totalSpots = match?.totalSpots ?? playersJoined;
  const spotsAvailable = Math.max((match?.playersNeeded ?? 0) || totalSpots - playersJoined, 0);
  const playersLabel = totalSpots ? `${playersJoined}/${totalSpots} players` : `${playersJoined} players`;
  const availabilityLabel =
    totalSpots > 0
      ? spotsAvailable === 0
        ? "Match is full"
        : `${spotsAvailable} spot${spotsAvailable === 1 ? "" : "s"} available`
      : "Spots available";

  const handleRetry = () => setRefreshIndex((value) => value + 1);

  const pills = useMemo(() => {
    if (!match) return [] as Array<{ label: string; tone: "success" | "warning" | "info" }>;
    const values: Array<{ label: string; tone: "success" | "warning" | "info" }> = [];
    values.push({ label: match.access, tone: "success" });
    if (match.visibilityLabel && match.visibilityLabel !== "Open") {
      values.push({ label: match.visibilityLabel, tone: "warning" });
    }
    if (match.relationship) {
      values.push({ label: match.relationship === "host" ? "Hosting" : "Joined", tone: "info" });
    }
    return values;
  }, [match]);

  const handlePrimaryAction = () => {
    if (!match) return;
    navigate(`/matches/${match.id}`);
  };

  const detailItems = [
    {
      icon: <Calendar size={18} aria-hidden="true" />,
      title: match?.startDisplay,
      subtitle: match?.startDateTimeIso,
    },
    {
      icon: <MapPin size={18} aria-hidden="true" />,
      title: match?.location,
      subtitle: [match?.locationDetail, match?.distance].filter(Boolean).join(" · ") || undefined,
    },
    {
      icon: <Users size={18} aria-hidden="true" />,
      title: playersLabel,
      subtitle: availabilityLabel,
    },
    match?.level
      ? {
          icon: <Star size={18} aria-hidden="true" />,
          title: `Skill level: ${match.level.summary}`,
          subtitle: match.level.detail,
        }
      : null,
  ].filter(Boolean) as Array<{ icon: JSX.Element; title?: string; subtitle?: string }>;

  return (
    <MainLayout>
      <div className="match-details-page match-details-page--compact">
        {isLoading ? (
          <div className="match-details-state" role="status">
            Loading match details…
          </div>
        ) : error ? (
          <div className="match-details-state match-details-state--error" role="alert">
            <p className="match-details-state__title">We couldn't load this match.</p>
            <p className="match-details-state__detail">{error}</p>
            <button type="button" className="match-details-state__button" onClick={handleRetry}>
              Try again
            </button>
          </div>
        ) : match ? (
          <article className="match-details-card">
            <header className="match-details-card__header">
              <div className="match-details-card__pills" aria-live="polite">
                {pills.map((pill) => (
                  <span
                    key={`${pill.label}-${pill.tone}`}
                    className={`match-details-pill match-details-pill--${pill.tone}`}
                  >
                    {pill.label}
                  </span>
                ))}
              </div>
              <h1 className="match-details-card__title">{match.location || "Match"}</h1>
              {match.hostName ? (
                <p className="match-details-card__meta">Hosted by {match.hostName}</p>
              ) : null}
            </header>

            <div className="match-details-card__body">
              <ul className="match-details-card__list">
                {detailItems.map((item) => (
                  <li key={item.title} className="match-details-card__item">
                    <div className="match-details-card__icon">{item.icon}</div>
                    <div className="match-details-card__text">
                      <p className="match-details-card__primary">{item.title}</p>
                      {item.subtitle ? <p className="match-details-card__secondary">{item.subtitle}</p> : null}
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <footer className="match-details-card__footer">
              <div className="match-details-card__actions" aria-label="Actions">
                <button type="button" className="match-details-card__button" onClick={handlePrimaryAction}>
                  View &amp; manage
                </button>
                <button type="button" className="match-details-card__button match-details-card__button--secondary">
                  <MessageCircle size={16} aria-hidden="true" />
                  Message group
                </button>
              </div>
            </footer>
          </article>
        ) : (
          <div className="match-details-state" role="status">
            No details available for this match.
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default MatchDetailsPage;
