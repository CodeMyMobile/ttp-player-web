import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarClock, CheckCircle2, Loader2, MapPin, Package, Search, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

import { getPlayerCoaches, type PlayerCoach } from "../api/playerCalendar";
import {
  fetchCoachPackages,
  fetchPackageCreditsBalance,
  fetchPackageCredits,
  type CoachPackage,
  type PackageCreditsBalanceResponse,
  type PackagePurchase,
} from "../api/playerPackages";
import MainLayout from "../components/MainLayout";
import StateBanner from "../components/coaches/StateBanner";
import { summarizeCredits } from "../utils/packageCredits";
import useDebouncedValue from "../hooks/useDebouncedValue";
import { useAuth } from "../context/AuthContext";
import { getStoredAuthToken } from "../services/authToken";

import "./CreditsPage.css";

const pickCoachId = (coach: PlayerCoach) =>
  (coach as Record<string, unknown>).coach_id ??
  coach.id ??
  (coach as Record<string, unknown>).user_id ??
  (coach as Record<string, unknown>).player_coach_id;

const resolveName = (coach: PlayerCoach) => {
  const record = coach as Record<string, unknown>;
  const parts = [
    record.full_name,
    record.fullName,
    record.coach_name,
    record.name,
    [record.first_name, record.last_name].filter(Boolean).join(" ").trim(),
    [record.firstName, record.lastName].filter(Boolean).join(" ").trim(),
  ]
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean);
  return parts[0] || "Coach";
};

const resolveAvatar = (coach: PlayerCoach) => {
  const record = coach as Record<string, unknown>;
  const candidates = [
    record.avatar_url,
    record.avatar,
    record.profile_image,
    record.profile_picture,
    record.photo,
    record.image,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate;
    }
  }
  return "https://images.unsplash.com/photo-1521412644187-c49fa049e84d?auto=format&fit=crop&w=256&q=80";
};

const resolveLocation = (coach: PlayerCoach) => {
  const record = coach as Record<string, unknown>;
  const primary =
    record.location ??
    record.location_name ??
    record.city ??
    record.state ??
    record.country ??
    record.address ??
    "";

  if (primary) return primary;

  const coachLocations = record.coach_locations;
  if (Array.isArray(coachLocations) && coachLocations.length > 0) {
    const first = coachLocations[0];
    if (typeof first === "string" && first.trim()) return first;
    if (first !== null && first !== undefined) return String(first);
  }

  return "";
};

const formatCurrency = (value?: number | string | null) => {
  const numeric = typeof value === "string" ? Number.parseFloat(value) : value;
  if (!Number.isFinite(numeric)) {
    if (typeof value === "string" && value.trim()) return value;
    return undefined;
  }

  try {
    return numeric.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 2,
    });
  } catch {
    return `$${numeric}`;
  }
};

const buildValidityLabel = (months?: number | null) => {
  if (months === null || months === undefined) return "Flexible expiry";
  if (months <= 0) return "No expiry";
  return `${months} month${months === 1 ? "" : "s"} validity`;
};

const buildPerLessonLabel = (total: number | string, count?: number | null) => {
  if (!count || count <= 0) return undefined;
  const numericTotal = typeof total === "string" ? Number.parseFloat(total) : total;
  if (!Number.isFinite(numericTotal)) {
    const formatted = formatCurrency(total);
    return formatted ? `${formatted} total` : undefined;
  }
  const per = numericTotal / count;
  const perLabel = formatCurrency(per) ?? per.toFixed(2);
  return `${perLabel} per lesson`;
};

const isFiniteNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

const CreditsPage = () => {
  const { user } = useAuth();
  const authToken = useMemo(
    () =>
      user?.session?.access_token ??
      user?.access_token ??
      user?.token ??
      getStoredAuthToken({ preferScheme: "token" }) ??
      undefined,
    [user],
  );

  const [coaches, setCoaches] = useState<PlayerCoach[]>([]);
  const [coachesLoading, setCoachesLoading] = useState(false);
  const [coachesError, setCoachesError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedCoachId, setSelectedCoachId] = useState<number | string | null>(null);

  const [packages, setPackages] = useState<CoachPackage[]>([]);
  const [packagesLoading, setPackagesLoading] = useState(false);
  const [packagesError, setPackagesError] = useState<string | null>(null);

  const [credits, setCredits] = useState<PackagePurchase[]>([]);
  const [creditsLoading, setCreditsLoading] = useState(false);
  const [creditsError, setCreditsError] = useState<string | null>(null);
  const [creditsBalance, setCreditsBalance] = useState<PackageCreditsBalanceResponse | null>(null);

  const debouncedSearch = useDebouncedValue(search, 250);

  const fetchCoaches = useCallback(async () => {
    setCoachesLoading(true);
    setCoachesError(null);
    try {
      const data = await getPlayerCoaches({
        perPage: 25,
        page: 1,
        search: debouncedSearch,
      });
      setCoaches(data);
      if (data.length && !selectedCoachId) {
        setSelectedCoachId(pickCoachId(data[0]) ?? null);
      }
      if (!data.length) {
        setSelectedCoachId(null);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load coaches";
      setCoachesError(message);
      setCoaches([]);
      setSelectedCoachId(null);
    } finally {
      setCoachesLoading(false);
    }
  }, [debouncedSearch, selectedCoachId]);

  useEffect(() => {
    void fetchCoaches();
  }, [fetchCoaches]);

  useEffect(() => {
    const controller = new AbortController();

    if (!selectedCoachId) {
      setPackages([]);
      setPackagesError(null);
      setPackagesLoading(false);
      return () => controller.abort();
    }

    if (!authToken) {
      setPackages([]);
      setPackagesError("Sign in to view packages.");
      setPackagesLoading(false);
      return () => controller.abort();
    }

    setPackagesLoading(true);
    setPackagesError(null);

    fetchCoachPackages({
      token: authToken,
      coachId: selectedCoachId,
      signal: controller.signal,
    })
      .then((data) => {
        const active = (data?.packages ?? []).filter((pkg) => pkg.is_active !== false);
        setPackages(active);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        const message = err instanceof Error ? err.message : "Unable to load packages.";
        setPackagesError(message);
        setPackages([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setPackagesLoading(false);
        }
      });

    return () => controller.abort();
  }, [authToken, selectedCoachId]);

  useEffect(() => {
    const controller = new AbortController();

    if (!selectedCoachId) {
      setCredits([]);
      setCreditsError(null);
      setCreditsLoading(false);
      setCreditsBalance(null);
      return () => controller.abort();
    }

    if (!authToken) {
      setCredits([]);
      setCreditsError("Sign in to view credits.");
      setCreditsLoading(false);
      setCreditsBalance(null);
      return () => controller.abort();
    }

    setCreditsLoading(true);
    setCreditsError(null);

    fetchPackageCredits({
      token: authToken,
      coachId: selectedCoachId,
      includeExpired: false,
      signal: controller.signal,
    })
      .then((data) => {
        setCredits(data?.purchases ?? []);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        const message = err instanceof Error ? err.message : "Unable to load credits.";
        setCreditsError(message);
        setCredits([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setCreditsLoading(false);
        }
      });

    return () => controller.abort();
  }, [authToken, selectedCoachId]);

  useEffect(() => {
    const controller = new AbortController();

    if (!selectedCoachId || !authToken) {
      setCreditsBalance(null);
      return () => controller.abort();
    }

    setCreditsBalance(null);

    fetchPackageCreditsBalance({
      token: authToken,
      coachId: selectedCoachId,
      signal: controller.signal,
    })
      .then((data) => {
        setCreditsBalance(data ?? null);
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setCreditsBalance(null);
      });

    return () => controller.abort();
  }, [authToken, selectedCoachId]);

  useEffect(() => {
    if (!coaches.length || !selectedCoachId) return;
    const exists = coaches.some((coach) => pickCoachId(coach) === selectedCoachId);
    if (!exists) {
      setSelectedCoachId(pickCoachId(coaches[0]) ?? null);
    }
  }, [coaches, selectedCoachId]);

  const selectedCoach = useMemo(
    () => coaches.find((coach) => pickCoachId(coach) === selectedCoachId) ?? null,
    [coaches, selectedCoachId],
  );

  const hasCredits =
    credits.length > 0 || (isFiniteNumber(creditsBalance?.total) ? creditsBalance.total > 0 : false);
  const creditSummary = summarizeCredits(credits);
  const availableCredits = isFiniteNumber(creditsBalance?.available)
    ? creditsBalance.available
    : creditSummary.remaining;
  const balanceSubtitleParts: string[] = [];
  if (isFiniteNumber(creditsBalance?.held)) {
    balanceSubtitleParts.push(`${creditsBalance.held} held`);
  }
  if (isFiniteNumber(creditsBalance?.total)) {
    balanceSubtitleParts.push(`${creditsBalance.total} total`);
  }
  const balanceSubtitle = balanceSubtitleParts.join(" · ");
  const fallbackSubtitle = creditSummary.used
    ? `${creditSummary.used} used · ${creditSummary.total} total`
    : `${creditSummary.total} total`;
  const walletSubtitle = balanceSubtitle || fallbackSubtitle;

  const renderCoachCard = (coach: PlayerCoach) => {
    const coachId = pickCoachId(coach);
    const name = resolveName(coach);
    const avatar = resolveAvatar(coach);
    const location = resolveLocation(coach);
    const isActive = coachId === selectedCoachId;

    return (
      <button
        key={coachId ?? name}
        type="button"
        className={`credits-page__coach-card${isActive ? " credits-page__coach-card--active" : ""}`}
        onClick={() => setSelectedCoachId(coachId ?? null)}
      >
        <div className="credits-page__coach-avatar">
          <img src={avatar} alt={`Portrait of ${name}`} />
        </div>
        <div className="credits-page__coach-meta">
          <p className="credits-page__coach-name">{name}</p>
          {location && (
            <span className="credits-page__coach-location">
              <MapPin size={14} /> {location}
            </span>
          )}
        </div>
      </button>
    );
  };

  const renderPackages = () => {
    if (!selectedCoachId) {
      return (
        <StateBanner
          tone="empty"
          title="Choose a coach"
          message="Select a coach on the left to view packages and credits."
        />
      );
    }

    if (packagesError) {
      return <StateBanner tone="error" title="Couldn’t load packages" message={packagesError} />;
    }

    if (packagesLoading) {
      return (
        <div className="credits-page__package-grid">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="credits-page__package-skeleton">
              <Loader2 size={20} className="credits-page__spinner" />
            </div>
          ))}
        </div>
      );
    }

    if (!packages.length) {
      return (
        <StateBanner
          tone="empty"
          title="No packages available"
          message="This coach hasn’t published lesson packages yet."
        />
      );
    }

    return (
      <div className="credits-page__package-grid">
        {packages.map((pkg) => {
          const perLesson = buildPerLessonLabel(pkg.total_price, pkg.lesson_count);
          const validity = buildValidityLabel(pkg.validity_months);
          const allowedLessonTypes = (pkg.lesson_types_allowed ?? []).filter(Boolean);
          const packagePurchased = hasCredits;

          return (
            <article key={pkg.id ?? pkg.name} className="credits-page__package-card">
              <div className="credits-page__package-heading">
                <div>
                  <p className="credits-page__eyebrow">Package</p>
                  <h3 className="credits-page__package-title">{pkg.name ?? "Lesson package"}</h3>
                </div>
                {packagePurchased && (
                  <span className="credits-page__pill">
                    <CheckCircle2 size={16} /> Credits active
                  </span>
                )}
              </div>
              {pkg.description && <p className="credits-page__package-description">{pkg.description}</p>}
              <div className="credits-page__package-meta">
                <div className="credits-page__meta-item">
                  <Package size={16} />
                  <span>{pkg.lesson_count ?? 0} lessons</span>
                </div>
                <div className="credits-page__meta-item">
                  <Sparkles size={16} />
                  <span>{formatCurrency(pkg.total_price) ?? "Price unavailable"}</span>
                </div>
                <div className="credits-page__meta-item">
                  <CalendarClock size={16} />
                  <span>{validity}</span>
                </div>
              </div>
              <div className="credits-page__package-footer">
                <div className="credits-page__package-detail">
                  {perLesson ? perLesson : "Use credits for lessons with this coach"}
                </div>
                <Link
                  to={`/coaches/${selectedCoachId}/purchase${pkg.id ? `?packageId=${pkg.id}` : ""}`}
                  className="credits-page__action"
                >
                  Purchase package
                </Link>
              </div>
              {allowedLessonTypes.length > 0 && (
                <div className="credits-page__lesson-types">
                  {allowedLessonTypes.map((type) => (
                    <span key={type} className="credits-page__lesson-pill">
                      {type.replace(/[_-]+/g, " ")}
                    </span>
                  ))}
                </div>
              )}
            </article>
          );
        })}
      </div>
    );
  };

  const renderCredits = () => {
    if (!selectedCoachId) return null;
    if (creditsError) {
      return <StateBanner tone="error" title="Couldn’t load credits" message={creditsError} />;
    }

    if (creditsLoading) {
      return (
        <div className="credits-page__wallet">
          <Loader2 size={18} className="credits-page__spinner" />
          <div>
            <p className="credits-page__eyebrow">Checking credits</p>
            <p className="credits-page__wallet-title">Fetching your balance…</p>
          </div>
        </div>
      );
    }

    if (!hasCredits) {
      return (
        <div className="credits-page__wallet">
          <p className="credits-page__eyebrow">Credits</p>
          <p className="credits-page__wallet-title">No active packages yet</p>
          <p className="credits-page__wallet-subtitle">
            Purchase a package to start using credits with {selectedCoach ? resolveName(selectedCoach) : "this coach"}.
          </p>
        </div>
      );
    }

    return (
      <div className="credits-page__wallet credits-page__wallet--active">
        <div>
          <p className="credits-page__eyebrow">Credits</p>
          <p className="credits-page__wallet-title">You have {availableCredits} credits available</p>
          <p className="credits-page__wallet-subtitle">
            {walletSubtitle}
            {creditSummary.nextExpiry ? ` · Next expiry ${creditSummary.nextExpiry}` : ""}
          </p>
        </div>
        <span className="credits-page__pill credits-page__pill--glow">
          <CheckCircle2 size={16} /> Active package
        </span>
      </div>
    );
  };

  return (
    <MainLayout>
      <div className="credits-page">
        <header className="credits-page__header">
          <div>
            <p className="credits-page__eyebrow">Credits</p>
            <h1 className="credits-page__title">Lesson credits</h1>
            <p className="credits-page__subtitle">
              Pick a coach to view their packages and see whether you already have credits with them.
            </p>
          </div>
          <div className="credits-page__search">
            <Search size={16} />
            <input
              type="search"
              placeholder="Search coaches"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </header>

        <div className="credits-page__layout">
          <aside className="credits-page__sidebar">
            <div className="credits-page__sidebar-header">
              <h2>Select a coach</h2>
              {coachesLoading && <Loader2 size={16} className="credits-page__spinner" aria-label="Loading coaches" />}
            </div>
            {coachesError && (
              <StateBanner tone="error" title="Couldn’t load coaches" message={coachesError} />
            )}
            {!coachesLoading && !coachesError && !coaches.length && (
              <StateBanner
                tone="empty"
                title="No coaches found"
                message="Adjust your search to find coaches with packages."
              />
            )}
            <div className="credits-page__coach-list">
              {coachesLoading
                ? Array.from({ length: 5 }).map((_, index) => (
                    <div key={index} className="credits-page__coach-skeleton">
                      <Loader2 size={18} className="credits-page__spinner" />
                    </div>
                  ))
                : coaches.map((coach) => renderCoachCard(coach))}
            </div>
          </aside>

          <section className="credits-page__content">
            <div className="credits-page__content-header">
              <div>
                <p className="credits-page__eyebrow">Packages</p>
                <h2 className="credits-page__section-title">
                  {selectedCoach ? resolveName(selectedCoach) : "Choose a coach"}
                </h2>
              </div>
              {selectedCoach && resolveLocation(selectedCoach) && (
                <span className="credits-page__pill">
                  <MapPin size={14} />
                  {resolveLocation(selectedCoach)}
                </span>
              )}
            </div>

            {renderCredits()}
            {renderPackages()}
          </section>
        </div>
      </div>
    </MainLayout>
  );
};

export default CreditsPage;
