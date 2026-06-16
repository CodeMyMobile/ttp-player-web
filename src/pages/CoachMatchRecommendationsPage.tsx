import { ArrowLeft, Check, MapPin, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import MainLayout from "../components/MainLayout";
import { useAuth } from "../context/AuthContext";
import { getStoredAuthToken } from "../services/authToken";
import {
  getCoachMatchRecommendations,
  type CoachMatchRecommendationItem,
  type Coordinates,
} from "../api/playerHome";
import { getStoredLocation, USER_LOCATION_CHANGED_EVENT } from "../utils/userLocation";
import { normalizeDisplayArray } from "../utils/displayLabels";
import "./CoachMatchRecommendationsPage.css";
import "./CoachMatchRecommendationsPage.redesign.css";

const PER_PAGE = 10;

const toList = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === "string") return item.trim();
      if (!item || typeof item !== "object") return "";
      const record = item as Record<string, unknown>;
      const label = record.label ?? record.location ?? record.name ?? record.address;
      return typeof label === "string" ? label.trim() : "";
    })
    .filter(Boolean);
};

const formatMoney = (value: unknown) => {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? `$${numeric.toFixed(0)}` : null;
};

const formatExperience = (value: unknown): string | null => {
  if (typeof value !== "string" || !value.trim()) return null;
  return `${value.trim()} years`;
};

const formatDistance = (value: unknown) => {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return null;
  if (numeric < 0.1) return "<0.1 mi";
  return `${numeric.toFixed(numeric < 10 ? 1 : 0)} mi`;
};

const getInitials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

type PriceEntry = { key: string; label: string; amount: string; suffix?: string };

const getPriceEntries = (prices: CoachMatchRecommendationItem["prices"]): PriceEntry[] =>
  (
    [
      { key: "private", label: "Private", value: prices?.private, suffix: "/hr" },
      { key: "semi", label: "Semi", value: prices?.semi },
      { key: "group", label: "Group", value: prices?.group },
    ] as const
  )
    .map((entry) => {
      const numeric = typeof entry.value === "number" ? entry.value : Number(entry.value);
      if (!Number.isFinite(numeric) || numeric <= 0) return null;
      return {
        key: entry.key,
        label: entry.label,
        amount: `$${numeric.toFixed(0)}`,
        suffix: entry.suffix,
      };
    })
    .filter((entry): entry is PriceEntry => entry !== null);

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
  const [navbarPosition, setNavbarPosition] = useState<Coordinates | null>(() => getStoredLocation());
  const [failedAvatars, setFailedAvatars] = useState<Set<number>>(() => new Set());

  const storedToken = useMemo(
    () => getStoredAuthToken({ defaultScheme: "token", preferScheme: "token" }) ?? undefined,
    [],
  );
  const token = user?.session?.access_token ?? user?.access_token ?? user?.token ?? storedToken ?? null;

  const markAvatarFailed = (coachId: number) =>
    setFailedAvatars((prev) => {
      if (prev.has(coachId)) return prev;
      const next = new Set(prev);
      next.add(coachId);
      return next;
    });

  useEffect(() => {
    const syncNavbarLocation = () => {
      setNavbarPosition(getStoredLocation());
      setPage(1);
    };

    window.addEventListener("storage", syncNavbarLocation);
    window.addEventListener(USER_LOCATION_CHANGED_EVENT, syncNavbarLocation);

    return () => {
      window.removeEventListener("storage", syncNavbarLocation);
      window.removeEventListener(USER_LOCATION_CHANGED_EVENT, syncNavbarLocation);
    };
  }, []);

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
          latitude: navbarPosition?.latitude,
          longitude: navbarPosition?.longitude,
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
  }, [navbarPosition?.latitude, navbarPosition?.longitude, page, search, token]);

  const runSearch = () => {
    setPage(1);
    setSearch(searchDraft.trim());
  };

  return (
    <MainLayout>
      <div className="cmr-page">
        <div className="cmr-page__inner">
          <Link to="/find-coaches" className="cmr-page__back">
            <ArrowLeft size={15} strokeWidth={2.4} aria-hidden="true" />
            Back to coach search
          </Link>

          <div className="cmr-page__title-row">
            <h1 className="cmr-page__title">Recommended for you</h1>
            <span className="cmr-page__count">
              {status === "loading"
                ? "Loading…"
                : status === "questionnaire-required"
                  ? "Questionnaire required"
                  : `${total} coach${total === 1 ? "" : "es"}`}
            </span>
          </div>

          <div className="cmr-search">
            <Search size={16} strokeWidth={2.2} aria-hidden="true" />
            <input
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") runSearch();
              }}
              placeholder="Search recommended coaches"
              aria-label="Search recommended coaches"
            />
          </div>

          {status === "questionnaire-required" ? (
            <section className="cmr-state">
              <h2>Complete your questionnaire first</h2>
              <p>
                We need your coach-match answers before we can recommend coaches. Start with the
                <strong> Find my coach </strong>
                questionnaire on Find Coaches.
              </p>
              <div className="cmr-state__actions">
                <Link to="/find-coaches" className="cmr-state__primary" state={{ openCoachMatchSurvey: true }}>
                  Go to Find my coach
                </Link>
                <Link to="/find-coaches" className="cmr-state__secondary">
                  Back to coach search
                </Link>
              </div>
            </section>
          ) : null}

          {status === "error" ? (
            <section className="cmr-state">
              <h2>Unable to load coach matches</h2>
              <p>{error ?? "Please try again in a moment."}</p>
            </section>
          ) : null}

          {status === "ready" && items.length === 0 ? (
            <section className="cmr-state">
              <h2>No recommendations yet</h2>
              <p>Complete your coach-match questionnaire first, then we&apos;ll rank coaches for you.</p>
              <Link to="/find-coaches" className="cmr-state__primary">
                Go to Find Coaches
              </Link>
            </section>
          ) : null}

          {status === "loading" ? (
            <section className="cmr-grid">
              {Array.from({ length: 4 }).map((_, index) => (
                <article key={index} className="cmr-card cmr-card--skeleton" aria-hidden="true" />
              ))}
            </section>
          ) : null}

          {status === "ready" && items.length > 0 ? (
            <>
              <section className="cmr-grid">
                {items.map((coach) => {
                  const name = coach.name || "Coach";
                  const specialties = normalizeDisplayArray(toList(coach.specialties)).slice(0, 6);
                  const languages = normalizeDisplayArray(toList(coach.languages));
                  const reasons = normalizeDisplayArray(toList(coach.reasons));
                  const score = Number(coach.score ?? 0);
                  const experienceText = formatExperience(coach.experience_years);
                  const distanceText = formatDistance(coach.distance?.miles);
                  const priceEntries = getPriceEntries(coach.prices);
                  const showImage = Boolean(coach.profileImage) && !failedAvatars.has(coach.coach_id);

                  return (
                    <article key={coach.coach_id} className="cmr-card">
                      <div className="cmr-card__head">
                        {showImage ? (
                          <img
                            className="cmr-card__photo"
                            src={coach.profileImage}
                            alt={name}
                            onError={() => markAvatarFailed(coach.coach_id)}
                          />
                        ) : (
                          <div className="cmr-card__photo cmr-card__photo--fallback">{getInitials(name)}</div>
                        )}

                        <div className="cmr-card__mid">
                          <h2 className="cmr-card__name">{name}</h2>
                          {experienceText || distanceText ? (
                            <p className="cmr-card__meta">
                              {experienceText ? <span>{experienceText}</span> : null}
                              {experienceText && distanceText ? (
                                <span className="cmr-card__meta-dot" aria-hidden="true">
                                  ·
                                </span>
                              ) : null}
                              {distanceText ? (
                                <span className="cmr-card__distance">
                                  <MapPin size={12} strokeWidth={2.2} aria-hidden="true" />
                                  {distanceText} away
                                </span>
                              ) : null}
                            </p>
                          ) : null}
                        </div>

                        <div className="cmr-card__match">
                          <span className="cmr-card__match-pct">{score}%</span>
                          <span className="cmr-card__match-label">Match</span>
                        </div>
                      </div>

                      <p className="cmr-card__bio">{coach.bio || "Coach bio coming soon."}</p>

                      {specialties.length > 0 ? (
                        <div className="cmr-card__tags">
                          {specialties.map((specialty) => (
                            <span key={specialty} className="cmr-card__tag">
                              {specialty}
                            </span>
                          ))}
                        </div>
                      ) : null}

                      {priceEntries.length > 0 ? (
                        <div className="cmr-card__prices">
                          {priceEntries.map((entry) => (
                            <div key={entry.key} className="cmr-card__price">
                              <span className="cmr-card__price-label">{entry.label}</span>
                              <span className="cmr-card__price-value">
                                {entry.amount}
                                {entry.suffix ? <small>{entry.suffix}</small> : null}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : null}

                      {reasons.length > 0 ? (
                        <div className="cmr-card__why">
                          <p className="cmr-card__why-label">Why this coach matches</p>
                          {reasons.map((reason) => (
                            <p key={reason} className="cmr-card__why-row">
                              <Check size={14} strokeWidth={3} aria-hidden="true" />
                              {reason}
                            </p>
                          ))}
                        </div>
                      ) : null}

                      {languages.length > 0 ? (
                        <p className="cmr-card__langs">
                          Speaks <b>{languages.join(", ")}</b>
                        </p>
                      ) : null}

                      <Link to={`/coaches/${coach.coach_id}`} className="cmr-card__profile-btn">
                        View profile
                      </Link>
                    </article>
                  );
                })}
              </section>

              {totalPages > 1 ? (
                <nav className="cmr-pagination" aria-label="Recommendations pagination">
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
