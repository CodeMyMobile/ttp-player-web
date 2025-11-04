import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeftCircle, Loader2 } from "lucide-react";

import MainLayout from "../components/MainLayout";
import { PurchaseLessonPackageCheckout } from "../components/coaches/PurchaseLessonPackageExperience";
import { findCoachProfile, type CoachProfile } from "../data/mockCoachProfiles";

import "./PurchaseLessonPackagePage.css";

const PurchaseLessonPackagePage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [coach, setCoach] = useState<CoachProfile | undefined>();

  useEffect(() => {
    let timer: number | undefined;
    setLoading(true);
    timer = window.setTimeout(() => {
      setCoach(id ? findCoachProfile(id) : undefined);
      setLoading(false);
    }, 480);

    return () => {
      if (timer) {
        window.clearTimeout(timer);
      }
    };
  }, [id]);

  const handleClose = () => {
    if (coach) {
      navigate(`/coaches/${coach.id}`);
    } else {
      navigate(-1);
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
            <p>We couldn&apos;t locate that coaching profile. Choose another coach to purchase lesson packages.</p>
            <Link to="/find-coaches" className="purchase-package-page__status-link">
              Browse coaches
            </Link>
          </div>
        ) : null}

        {!loading && coach ? <PurchaseLessonPackageCheckout coach={coach} onClose={handleClose} /> : null}
      </div>
    </MainLayout>
  );
};

export default PurchaseLessonPackagePage;
