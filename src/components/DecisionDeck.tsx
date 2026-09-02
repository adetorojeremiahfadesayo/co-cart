import { startCurrentLiveSearch } from "../agent/startCurrentSearch";
import { DECISION_QUESTIONS, requiredQuestionIds } from "../decision/questions";
import { DOMAIN_CONFIG } from "../data/catalog";
import { useStore } from "../store/useStore";

export default function DecisionDeck() {
  const domain = useStore((state) => state.domain);
  const answers = useStore((state) => state.answers);
  const setDecisionAnswer = useStore((state) => state.setDecisionAnswer);

  const questions = domain ? DECISION_QUESTIONS[domain] : [];
  const required = domain ? requiredQuestionIds(domain) : [];
  const completed = required.filter((id) => answers[id]?.length).length;
  const ready = required.length > 0 && completed === required.length;

  if (!domain) return null;

  const choose = (questionId: string, value: string, multiple = false) => {
    const current = answers[questionId] ?? [];
    const next = multiple
      ? current.includes(value) ? current.filter((item) => item !== value) : [...current, value].slice(-2)
      : [value];
    setDecisionAnswer(questionId, next);
  };

  const go = async () => {
    if (!ready) return;
    window.scrollTo({ top: 0, behavior: "smooth" });
    try {
      await startCurrentLiveSearch();
    } catch { /* The search screen presents the actionable error. */ }
  };

  return (
    <main className="decision-space">
      <header className="decision-space__intro">
        <p className="quiet-kicker">{DOMAIN_CONFIG[domain].label}</p>
        <h1>Let’s narrow the noise.</h1>
        <p>Choose what matters. Nothing is searched until you press Go.</p>
        <span>{completed} of {required.length} decisions made</span>
      </header>

      <div className="decision-stack">
        {questions.map((question, index) => {
          const selected = answers[question.id] ?? [];
          const answered = selected.length > 0;
          return (
            <section
              key={question.id}
              id={`decision-${question.id}`}
              className={`decision-step ${answered ? "decision-step--answered" : ""}`}
              aria-labelledby={`decision-title-${question.id}`}
            >
              <div className="decision-step__number">{String(index + 1).padStart(2, "0")}</div>
              <div className="decision-step__body">
                <p className="quiet-kicker">{question.eyebrow}</p>
                <h2 id={`decision-title-${question.id}`}>{question.prompt}</h2>
                <p>{question.detail}</p>
                <div className="decision-options" role="group" aria-label={question.prompt}>
                  {question.options.map((option) => {
                    const active = selected.includes(option.value);
                    return (
                      <button
                        key={option.value}
                        type="button"
                        className={`decision-option ${active ? "decision-option--active" : ""}`}
                        aria-pressed={active}
                        onClick={() => choose(question.id, option.value, question.multiple)}
                      >
                        <span>{option.label}</span>
                        {option.hint && <small>{option.hint}</small>}
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>
          );
        })}
      </div>

      <div className="go-dock">
        <div>
          <strong>{ready ? "Your brief is ready." : `${required.length - completed} decision${required.length - completed === 1 ? "" : "s"} left.`}</strong>
          <span>Go starts a real OpenAI agent and live Shopify catalog search.</span>
        </div>
        <button type="button" className="go-button" disabled={!ready} onClick={go}>Go <span aria-hidden>→</span></button>
      </div>
    </main>
  );
}
