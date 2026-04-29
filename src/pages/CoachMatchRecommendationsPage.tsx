import { Search, Sparkles, Star } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import MainLayout from "../components/MainLayout";
import { useAuth } from "../context/AuthContext";
import { getStoredAuthToken } from "../services/authToken";
import {
  getCoachMatchRecommendations,
  type CoachMatchRecommendationItem,
} from "../api/playerHome";
import "./CoachMatchRecommendationsPage.css";

const PER_PAGE = 10;

const toList = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
};

const formatMoney = (value: unknown) => {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? `$${numeric.toFixed(0)}` : null;
};

const formatExperience = (value: unknown) => {
  if (typeof value !== "string" || !value.trim()) return "Experience not listed";
  return `${value.trim()} years`;
};

const CoachMatchRecommendationsPage = () => {
  const { user } = useAuth();
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "questionnaire-required">("loading");
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<CoachMatchRecommendationItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const storedToken = useMemo(
    () => getStoredAuthToken({ defaultScheme: "token", preferScheme: "token" }) ?? undefined,
    [],
  );
  const token = user?.session?.access_token ?? user?.access_token ?? user?.token ?? storedToken ?? null;

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!token) {
        setStatus("error");
        setError("Please sign in to view your coach matches.");
        setItems([]);
        return;
      }

      setStatus("loading");
      setError(null);

      try {
        const response = await getCoachMatchRecommendations({
          token,
          perPage: PER_PAGE,
          page,
          search,
        });

        if (cancelled) return;

        setItems(Array.isArray(response?.recommendations) ? response.recommendations : []);
        setTotal(Number(response?.total ?? 0));
        setTotalPages(Math.max(Number(response?.totalPages ?? 1), 1));
        setStatus("ready");
      } catch (requestError) {
        if (cancelled) return;
        const errorData = (requestError as Error & { status?: number; data?: { detail?: string } })?.data;
        const errorStatus = (requestError as Error & { status?: number })?.status;
        const detail = errorData?.detail;

        if (errorStatus === 400 && detail === "coach_match_answers_required") {
          setStatus("questionnaire-required");
          setError(null);
          setItems([]);
          setTotal(0);
          setTotalPages(1);
          return;
        }

        setStatus("error");
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load coach recommendations right now.",
        );
        setItems([]);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [page, search, token]);

  return (
    <MainLayout>
      <div className="coach-match-page">
        <div className="coach-match-page__inner">
          <header className="coach-match-page__header">
            <div>
              <p className="coach-match-page__eyebrow">Coach Matchmaking</p>
              <h1>Recommended Coaches</h1>
              <p className="coach-match-page__subtitle">
                Personalized coach matches ranked from your player coach-match questionnaire.
              </p>
            </div>
            <div className="coach-match-page__header-actions">
              <Link to="/find-coaches" className="coach-match-page__secondary-link">
                Back to coach search
              </Link>
            </div>
          </header>

          <section className="coach-match-page__filter">
            <div className="coach-match-page__search">
              <Search size={18} strokeWidth={2} />
              <input
                value={searchDraft}
                onChange={(event) => setSearchDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    setPage(1);
                    setSearch(searchDraft.trim());
                  }
                }}
                placeholder="Search recommended coaches"
                aria-label="Search recommended coaches"
              />
              <button
                type="button"
                onClick={() => {
                  setPage(1);
                  setSearch(searchDraft.trim());
                }}
              >
                Search
              </button>
            </div>
            <p className="coach-match-page__results">
              {status === "loading"
                ? "Loading recommendations..."
                : status === "questionnaire-required"
                  ? "Questionnaire required"
                  : `${total} recommended coach${total === 1 ? "" : "es"}`}
            </p>
          </section>

          {status === "questionnaire-required" ? (
            <section className="coach-match-page__state">
              <h2>Complete your questionnaire first</h2>
              <p>
                We need your coach-match answers before we can recommend coaches. Start with the
                <strong> Find my coach </strong>
                questionnaire on Find Coaches.
              </p>
              <div className="coach-match-page__state-actions">
                <Link
                  to="/find-coaches"
                  className="coach-match-page__primary-link"
                  state={{ openCoachMatchSurvey: true }}
                >
                  Go to Find my coach
                </Link>
                <Link to="/find-coaches" className="coach-match-page__secondary-link">
                  Back to coach search
                </Link>
              </div>
            </section>
          ) : null}

          {status === "error" ? (
            <section className="coach-match-page__state">
              <h2>Unable to load coach matches</h2>
              <p>{error ?? "Please try again in a moment."}</p>
            </section>
          ) : null}

          {status === "ready" && items.length === 0 ? (
            <section className="coach-match-page__state">
              <h2>No recommendations yet</h2>
              <p>
                Complete your coach-match questionnaire first, then we&apos;ll rank coaches for you.
              </p>
              <Link to="/find-coaches" className="coach-match-page__primary-link">
                Go to Find Coaches
              </Link>
            </section>
          ) : null}

          {status === "loading" ? (
            <section className="coach-match-page__grid">
              {Array.from({ length: 4 }).map((_, index) => (
                <article key={index} className="coach-match-card coach-match-card--skeleton" aria-hidden="true" />
              ))}
            </section>
          ) : null}

          {status === "ready" && items.length > 0 ? (
            <>
              <section className="coach-match-page__grid">
                {items.map((coach) => {
                  const levels = toList(coach.levels);
                  const specialties = toList(coach.specialties);
                  const formats = toList(coach.formats);
                  const languages = toList(coach.languages);
                  const reasons = toList(coach.reasons);
                  const homeCourts = toList(coach.home_courts);
                  const score = Number(coach.score ?? 0);

                  return (
                    <article key={coach.coach_id} className="coach-match-card">
                      <div className="coach-match-card__top">
                        <div className="coach-match-card__profile">
                          {coach.profileImage ? (
                            <img src={coach.profileImage} alt={coach.name || "Coach"} />
                          ) : (
                            <div className="coach-match-card__avatar-fallback">
                              {(coach.name || "Coach")
                                .split(/\s+/)
                                .filter(Boolean)
                                .slice(0, 2)
                                .map((part) => part[0]?.toUpperCase())
                                .join("")}
                            </div>
                          )}
                          <div>
                            <h2>{coach.name || "Coach"}</h2>
                            <p>{formatExperience(coach.experience_years)}</p>
                          </div>
                        </div>

                        <div className="coach-match-card__score">
                          <Sparkles size={16} />
                          <strong>{score}</strong>
                          <span>match score</span>
                        </div>
                      </div>

                      <p className="coach-match-card__bio">{coach.bio || "Coach bio coming soon."}</p>

                      <div className="coach-match-card__chips">
                        {levels.slice(0, 2).map((level) => (
                          <span key={`level-${level}`}>{level}</span>
                        ))}
                        {formats.slice(0, 2).map((format) => (
                          <span key={`format-${format}`}>{format}</span>
                        ))}
                        {specialties.slice(0, 2).map((specialty) => (
                          <span key={`specialty-${specialty}`}>{specialty}</span>
                        ))}
                      </div>

                      <div className="coach-match-card__meta-grid">
                        <div>
                          <span>Private</span>
                          <strong>{formatMoney(coach.prices?.private) || "N/A"}</strong>
                        </div>
                        <div>
                          <span>Semi</span>
                          <strong>{formatMoney(coach.prices?.semi) || "N/A"}</strong>
                        </div>
                        <div>
                          <span>Group</span>
                          <strong>{formatMoney(coach.prices?.group) || "N/A"}</strong>
                        </div>
                        <div>
                          <span>Languages</span>
                          <strong>{languages.slice(0, 2).join(", ") || "N/A"}</strong>
                        </div>
                      </div>

                      <div className="coach-match-card__breakdown">
                        <div className="coach-match-card__breakdown-title">
                          <Star size={14} />
                          <span>Why this coach matches</span>
                        </div>
                        <ul>
                          {reasons.length > 0 ? reasons.map((reason) => <li key={reason}>{reason}</li>) : <li>No reasons provided</li>}
                        </ul>
                      </div>

                      <div className="coach-match-card__footer">
                        <div className="coach-match-card__courts">
                          {homeCourts[0] || "Home courts not listed"}
                        </div>
                        <Link to={`/coaches/${coach.coach_id}`} className="coach-match-card__action">
                          View profile
                        </Link>
                      </div>
                    </article>
                  );
                })}
              </section>

              {totalPages > 1 ? (
                <nav className="coach-match-page__pagination" aria-label="Recommendations pagination">
                  <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1}>
                    Previous
                  </button>
                  <span>
                    Page {page} of {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                    disabled={page >= totalPages}
                  >
                    Next
                  </button>
                </nav>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </MainLayout>
  );
};

export default CoachMatchRecommendationsPage;
