import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Activity, Calendar, MapPin, MessageCircle, Star, Users } from "lucide-react";

import {
  getMatchById,
  normalizeMatchDetail,
  normalizeMatchRecord,
  type NormalizedMatch,
} from "../api/matches";
import { useAuth } from "../context/AuthContext";
import MainLayout from "../components/MainLayout";
import { getStoredAuthToken } from "../services/authToken";

import "./MatchDetailsPage.css";

const MatchDetailsPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const { user } = useAuth() as { user?: unknown };
  const [match, setMatch] = useState<NormalizedMatch | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshIndex, setRefreshIndex] = useState(0);

  const hydratedMatch = useMemo(() => {
    const state = location.state as { match?: NormalizedMatch } | undefined;
    return state?.match ? normalizeMatchDetail(state.match, { currentUser: user }) : null;
  }, [location.state, user]);

  useEffect(() => {
    if (hydratedMatch) {
      setMatch(hydratedMatch);
      setIsLoading(false);
    }
  }, [hydratedMatch]);

  const loadMatch = useCallback(
    async (signal: AbortSignal) => {
      if (!id) return;

      setIsLoading(true);
      setError(null);

      const token = getStoredAuthToken({ preferScheme: "Token" });

      try {
        const matchRecord = await getMatchById(id, { token: token ?? undefined, signal });
        const normalized = normalizeMatchRecord(matchRecord, { currentUser: user });
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
    },
    [id, user],
  );

  useEffect(() => {
    if (!id) return undefined;

    const shouldFetch = refreshIndex > 0 || (!hydratedMatch && !match);
    if (!shouldFetch) return undefined;

    const controller = new AbortController();
    loadMatch(controller.signal);
    return () => controller.abort();
  }, [hydratedMatch, id, loadMatch, match, refreshIndex]);

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
    const isInviteOnlyVisibility =
      match.visibility === "private" || match.visibilityLabel?.toLowerCase() === "invite only";
    if (match.visibilityLabel && match.visibilityLabel !== "Open" && !isInviteOnlyVisibility) {
      values.push({ label: match.visibilityLabel, tone: "warning" });
    }
    if (match.relationship === "host") values.push({ label: "Hosting", tone: "info" });
    if (match.relationship === "participant") values.push({ label: "Joined", tone: "info" });
    return values;
  }, [match]);

  const handlePrimaryAction = () => {
    if (!match) return;
    navigate(`/matches/${match.id}`);
  };

  const buildInitials = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return "";
    return trimmed
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("");
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
    match?.type
      ? {
          icon: <Activity size={18} aria-hidden="true" />,
          title: `Match type: ${match.type}`,
        }
      : null,
    match?.level
      ? {
          icon: <Star size={18} aria-hidden="true" />,
          title: `Suggested level: ${match.level.summary}`,
          subtitle: match.level.detail,
        }
      : null,
    match?.format
      ? {
          icon: <Activity size={18} aria-hidden="true" />,
          title: `Match format: ${match.format}`,
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
              <section className="match-details-card__panel" aria-label="Match information">
                <h2 className="match-details-card__section-title">Match details</h2>
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
              </section>

              <section className="match-details-card__panel" aria-label="Participants">
                <div className="match-details-card__section-heading">
                  <h2 className="match-details-card__section-title">Participating players</h2>
                  <span className="match-details-card__section-pill">{playersLabel}</span>
                </div>
                {match?.participants && match.participants.length > 0 ? (
                  <ul className="match-details-participants">
                    {match.participants.map((participant) => {
                      const initials = participant.name ? buildInitials(participant.name) : "";
                      const contactItems = [] as React.ReactNode[];

                      if (participant.contactEmail) {
                        contactItems.push(
                          <a
                            key="email"
                            className="match-details-participants__contact-link"
                            href={`mailto:${participant.contactEmail}`}
                          >
                            {participant.contactEmail}
                          </a>,
                        );
                      }

                      if (participant.contactPhone) {
                        const phoneHref = `tel:${participant.contactPhone.replace(/[^+\d]/g, "") || participant.contactPhone}`;

                        contactItems.push(
                          <a
                            key="phone"
                            className="match-details-participants__contact-link"
                            href={phoneHref}
                          >
                            {participant.contactPhone}
                          </a>,
                        );
                      }

                      const contactContent = contactItems.length ? (
                        <span className="match-details-participants__contact">
                          {contactItems.map((item, index) =>
                            index === 0 ? (
                              item
                            ) : (
                              <Fragment key={`${(item as { key?: string }).key ?? index}`}>
                                <span className="match-details-participants__contact-separator">·</span>
                                {item}
                              </Fragment>
                            ),
                          )}
                        </span>
                      ) : (
                        <span className="match-details-participants__contact">Contact info not provided</span>
                      );

                      return (
                        <li key={participant.id ?? participant.name} className="match-details-participants__item">
                          <span className="match-details-participants__avatar" aria-hidden>
                            {participant.avatarUrl ? (
                              <img src={participant.avatarUrl} alt="" />
                            ) : (
                              initials
                            )}
                          </span>
                          <div className="match-details-participants__body">
                            <div className="match-details-participants__row">
                              <span className="match-details-participants__name">{participant.name ?? "Player"}</span>
                              {participant.hosting ? (
                                <span className="match-details-participants__tag">Host</span>
                              ) : participant.isCurrentUser ? (
                                <span className="match-details-participants__tag match-details-participants__tag--muted">You</span>
                              ) : null}
                            </div>
                            {contactContent}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <div className="match-details-participants__empty">
                    Invite players to join you — participant names and contact details will appear here.
                  </div>
                )}
              </section>
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
