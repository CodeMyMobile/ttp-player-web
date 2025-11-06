import { useNavigate } from "react-router-dom";

import MainLayout from "../components/MainLayout";

import "./CreateMatchPage.css";

const CreateMatchReviewPage = () => {
  const navigate = useNavigate();

  return (
    <MainLayout>
      <div className="create-match-page">
        <div className="create-match-page__header">
          <div>
            <p className="create-match-page__eyebrow">Create a Match</p>
            <h1 className="create-match-page__title">Review &amp; publish</h1>
            <p className="create-match-page__subtitle">
              We&apos;re putting the finishing touches on this step. For now you can double-check the details you
              entered and publish soon.
            </p>
          </div>
          <div className="create-match-page__progress" aria-label="Match creation progress">
            <div className="progress-step progress-step--complete">
              <span className="progress-step__number">1</span>
              <span className="progress-step__label">Match details</span>
            </div>
            <div className="progress-connector" aria-hidden="true" />
            <div className="progress-step progress-step--complete">
              <span className="progress-step__number">2</span>
              <span className="progress-step__label">Match settings</span>
            </div>
            <div className="progress-connector" aria-hidden="true" />
            <div className="progress-step progress-step--active">
              <span className="progress-step__number">3</span>
              <span className="progress-step__label">Review &amp; publish</span>
            </div>
          </div>
        </div>

        <section className="create-match-card" aria-label="Review summary coming soon">
          <h2>Review experience coming soon</h2>
          <p className="create-match-card__subtitle">
            We&apos;re still building the final confirmation step. Your match details are saved as you go so you can come
            back to publish shortly.
          </p>
        </section>

        <div className="create-match-actions">
          <button type="button" className="create-match-actions__secondary" onClick={() => navigate(-1)}>
            Back to settings
          </button>
          <button type="button" className="create-match-actions__primary" disabled>
            Publish match
          </button>
        </div>
      </div>
    </MainLayout>
  );
};

export default CreateMatchReviewPage;
