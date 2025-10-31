import CoachList from '../components/coaches/CoachList';
import './PlayerCoachListPage.css';

const PlayerCoachListPage = () => (
  <main className="coach-page" aria-labelledby="coach-page-heading">
    <header className="coach-page__header">
      <h1 id="coach-page-heading">Find Your Coach</h1>
      <p>Explore trusted tennis pros and view full profiles to start training.</p>
    </header>
    <CoachList />
  </main>
);

export default PlayerCoachListPage;
