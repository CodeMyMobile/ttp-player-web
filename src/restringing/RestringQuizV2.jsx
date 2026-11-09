import { ArrowRight, Check, Sparkles, TriangleAlert } from "lucide-react";
import { formatMoneyCents } from "./playerFlow.js";
import { QUIZ_QUESTIONS } from "./quizV2.js";
import "./RestringQuizV2.css";

/**
 * One question of "Help me choose" (VITE_RESTRING_V2). Tapping an answer moves on. The level
 * question arrives pre-selected from the player's NTRP when we have one.
 */
export function RestringQuizQuestion({ index, answers, levelFromRating = null, onAnswer }) {
  const question = QUIZ_QUESTIONS[index];
  const selected = answers[question.key] ?? (question.key === "level" ? levelFromRating : null);
  return (
    <section className="rsq">
      <div className="rsq-progress" aria-hidden="true">
        <span style={{ width: `${((index + 1) / QUIZ_QUESTIONS.length) * 100}%` }} />
      </div>
      <span className="rsq-step">Question {index + 1} of {QUIZ_QUESTIONS.length}</span>
      <h1>{question.label}</h1>
      {question.key === "level" && levelFromRating && !answers.level ? (
        <p className="rsq-note">Picked from your rating. Change it if it’s not right.</p>
      ) : null}
      <div className="rsq-options">
        {question.options.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`rsq-option ${selected === option.value ? "is-selected" : ""}`}
            aria-pressed={selected === option.value}
            onClick={() => onAnswer(question.key, option.value)}
          >
            <span>
              <b>{option.label}</b>
              {option.hint ? <small>{option.hint}</small> : null}
            </span>
            {selected === option.value ? <Check size={18} aria-hidden="true" /> : <ArrowRight size={18} aria-hidden="true" />}
          </button>
        ))}
      </div>
    </section>
  );
}

const optionTitle = (option) => `${option.string.brand} ${option.string.name}`.trim();

/**
 * The result from the recommendation engine: our pick with why it fits, up to two
 * alternatives with how each differs from it, and the way to every string.
 */
export function RestringQuizResult({ result, vendor, onChoose, onSeeAll }) {
  const options = result?.options || [];
  if (!options.length) {
    return (
      <section className="rsq">
        <h1>We couldn’t match a string in stock</h1>
        <p className="rsq-note">See everything {vendor?.name || "the shop"} has instead.</p>
        <button type="button" className="rsq-primary" onClick={onSeeAll}>See all strings</button>
      </section>
    );
  }
  const [pick, ...alternatives] = options;
  return (
    <div className="rsq rsq-result">
      <section className="rsq-pick">
        <span className="rsq-pill"><Sparkles size={14} aria-hidden="true" /> Our pick</span>
        <h1>{optionTitle(pick)}</h1>
        <span className="rsq-pick__meta">
          {pick.category_label} · {pick.tension_lbs} lbs · {formatMoneyCents(pick.price_cents)}
        </span>
        <ul className="rsq-reasons">
          {pick.reasons.map((reason) => (
            <li key={reason}><Check size={16} aria-hidden="true" /> {reason}</li>
          ))}
        </ul>
        {result.warning ? (
          <p className="rsq-warning"><TriangleAlert size={16} aria-hidden="true" /> {result.warning}</p>
        ) : null}
        <button type="button" className="rsq-primary" onClick={() => onChoose(pick)}>Choose this string</button>
      </section>

      {alternatives.length ? (
        <section className="rsq-alt">
          <span className="rsq-alt__label">Or compare</span>
          {alternatives.map((option) => (
            <div className="rsq-alt__row" key={option.string.id}>
              <span>
                <b>{optionTitle(option)}</b>
                <small>{option.category_label} · {formatMoneyCents(option.price_cents)}</small>
                {option.differences?.length ? <small className="rsq-alt__diff">vs our pick: {option.differences.join(" · ")}</small> : null}
                {option.reasons?.[0] ? <small>{option.reasons[0]}</small> : null}
              </span>
              <button type="button" className="rsq-secondary" onClick={() => onChoose(option)}>Choose</button>
            </div>
          ))}
        </section>
      ) : null}

      <button type="button" className="rsq-link" onClick={onSeeAll}>See all strings</button>
    </div>
  );
}
