import { useBookedLessons } from "../hooks/useBookedLessons";

const formatDate = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

// Truthful: only render a price when the lesson genuinely carries a positive per-player
// price; otherwise omit it (never $0).
const formatPrice = (value?: string | number | null) => {
  if (value === undefined || value === null || String(value).trim() === "") return "";
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return "";
  return `$${num.toFixed(2)}`;
};

const BookedLessonsSection = () => {
  const { lessons, loading, error } = useBookedLessons();

  return (
    <div className="settings-card">
      <h2 className="settings-card__title">Lessons booked</h2>
      <p className="settings-card__subtitle">
        Group lessons you&apos;ve booked. Amounts shown are the per-player lesson price.
      </p>

      {loading ? (
        <p className="ph-status">Loading your booked lessons…</p>
      ) : error ? (
        <p className="ph-status ph-status--error">{error}</p>
      ) : lessons.length === 0 ? (
        <p className="ph-status">You haven&apos;t booked any lessons yet.</p>
      ) : (
        <ul className="ph-past-list">
          {lessons.map((lesson) => {
            const price = formatPrice(lesson.pricePerPerson);
            const date = formatDate(lesson.startDateTime);
            return (
              <li key={String(lesson.id)} className="ph-past-row">
                <span className="ph-past-row__main">
                  {lesson.title}
                  {lesson.coachName ? ` · ${lesson.coachName}` : ""}
                </span>
                <span className="ph-past-row__meta">
                  {date}
                  {date && price ? " · " : ""}
                  {price}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default BookedLessonsSection;
