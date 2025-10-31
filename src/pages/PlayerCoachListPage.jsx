import CoachList from "../components/coaches/CoachList";
import "./PlayerCoachListPage.css";

const PlayerCoachListPage = () => (
  <div className="coach-page" aria-labelledby="coach-page-heading">
    <header className="coach-page__hero">
      <div>
        <p className="coach-page__eyebrow">Find your perfect match</p>
        <h1 id="coach-page-heading">Coaches</h1>
        <p className="coach-page__subtitle">
          Browse verified coaches, compare availability and rates, and jump into a session that fits your
          schedule.
        </p>
      </div>
    </header>
    <main className="coach-page__content">
      <CoachList />
    </main>
  </div>
);

export default PlayerCoachListPage;
