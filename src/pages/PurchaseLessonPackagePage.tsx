import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeftCircle, Loader2 } from "lucide-react";

import MainLayout from "../components/MainLayout";
import { PurchaseLessonPackageCheckout } from "../components/coaches/PurchaseLessonPackageExperience";
import { fetchCoachProfile, type CoachProfileRecord } from "../api/coachProfile";

import "./PurchaseLessonPackagePage.css";

type PurchaseLessonPackageRouteState = {
  returnTo?: {
    pathname?: string;
    search?: string;
    hash?: string;
    state?: Record<string, unknown>;
  };
};

const PurchaseLessonPackagePage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [coach, setCoach] = useState<CoachProfileRecord | undefined>();
  const [error, setError] = useState<string | null>(null);
  const routeState = (location.state as PurchaseLessonPackageRouteState | null | undefined) ?? null;

  useEffect(() => {
    const controller = new AbortController();

    if (!id) {
      setCoach(undefined);
      setError("Coach not found.");
      setLoading(false);
      return () => controller.abort();
    }

    const coachId = Number.parseInt(id, 10);
    if (Number.isNaN(coachId)) {
      setCoach(undefined);
      setError("Invalid coach identifier.");
      setLoading(false);
      return () => controller.abort();
    }

    setLoading(true);
    setError(null);
    setCoach(undefined);

    fetchCoachProfile(coachId, { signal: controller.signal })
      .then((data) => {
        setCoach(data);
      })
      .catch((err) => {
        if (controller.signal.aborted) {
          return;
        }
        const status = (err as Error & { status?: number }).status;
        if (status === 404) {
          setCoach(undefined);
          setError(null);
        } else {
          setError(err instanceof Error ? err.message : "Unable to load coach profile.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [id]);

  const handleClose = () => {
    if (routeState?.returnTo?.pathname) {
      navigate(
        {
          pathname: routeState.returnTo.pathname,
          search: routeState.returnTo.search ?? "",
          hash: routeState.returnTo.hash ?? "",
        },
        { state: routeState.returnTo.state },
      );
      return;
    }
    if (coach) {
      navigate(`/coaches/${coach.id}`);
    } else {
      navigate(-1);
    }
  };

  const handleSuccess = () => {
    if (routeState?.returnTo?.pathname) {
      navigate(
        {
          pathname: routeState.returnTo.pathname,
          search: routeState.returnTo.search ?? "",
          hash: routeState.returnTo.hash ?? "",
        },
        {
          replace: true,
          state: routeState.returnTo.state,
        },
      );
    }
  };

  return (
    <MainLayout>
      <div className="purchase-package-page-shell">
        {loading ? (
          <div className="purchase-package-page__status" role="status" aria-live="polite">
            <Loader2 className="purchase-package-page__spinner" aria-hidden />
            <span>Loading package options…</span>
          </div>
        ) : null}

        {!loading && !coach ? (
          <div className="purchase-package-page__status" role="alert">
            <ArrowLeftCircle className="purchase-package-page__status-icon" aria-hidden />
            <h2>Coach not found</h2>
            <p>
              {error ||
                "We couldn't locate that coaching profile. Choose another coach to purchase lesson packages."}
            </p>
            <Link to="/find-coaches" className="purchase-package-page__status-link">
              Browse coaches
            </Link>
          </div>
        ) : null}

        {!loading && coach ? (
          <PurchaseLessonPackageCheckout coach={coach} onClose={handleClose} onSuccess={handleSuccess} />
        ) : null}
      </div>
    </MainLayout>
  );
};

export default PurchaseLessonPackagePage;
