import { useEffect, useState } from "react";
import { isValidClarifyingAnswer } from "../decision/shoppingBrief";
import { useStore } from "../store/useStore";
import type { ClarifyingQuestion } from "../types";

function moneyValue(values: string[] | undefined) {
  return values?.[0] ?? "";
}

export default function ClarificationDeck() {
  const questions = useStore((state) => state.clarifyingQuestions);
  const answers = useStore((state) => state.answers);
  const reference = useStore((state) => state.discoveryReference);
  const brief = useStore((state) => state.shoppingBrief);
  const setClarifyingAnswer = useStore((state) => state.setClarifyingAnswer);
  const proceedToBriefReview = useStore((state) => state.proceedToBriefReview);
  const returnToEntry = useStore((state) => state.returnToEntry);
  const agentAnswerFlash = useStore((state) => state.agentAnswerFlash);
  const [flashClearedAt, setFlashClearedAt] = useState(0);
  const flashId = agentAnswerFlash && agentAnswerFlash.at > flashClearedAt ? agentAnswerFlash.questionId : null;

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, []);

  useEffect(() => {
    if (!agentAnswerFlash) return;
    const card = document.getElementById(`clarify-${agentAnswerFlash.questionId}`);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    card?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" });
    const timer = window.setTimeout(() => setFlashClearedAt(agentAnswerFlash.at), 1600);
    return () => window.clearTimeout(timer);
  }, [agentAnswerFlash]);

  const requiredMissing = questions.filter((question) => question.required && !isValidClarifyingAnswer(question, answers[question.id] ?? []));
  const answeredCount = questions.filter((question) => isValidClarifyingAnswer(question, answers[question.id] ?? [])).length;

  const choose = (question: ClarifyingQuestion, value: string) => {
    const current = answers[question.id] ?? [];
    const next = question.kind === "multiple"
      ? current.includes(value) ? current.filter((item) => item !== value) : [...current, value].slice(-2)
      : [value];
    setClarifyingAnswer(question.id, next);
  };

  const setTextValue = (question: ClarifyingQuestion, value: string) => {
    setClarifyingAnswer(question.id, value.trim() ? [value] : []);
  };

  return (
    <main className="decision-space">
      <header className="decision-space__intro">
        <p className="quiet-kicker">Open product search</p>
        <h1>Here’s what the agent understood.</h1>
        <p>
          {reference ? `Interpreted as “${reference.interpretedProduct}”. ` : ""}
          {reference?.uncertaintyNotes.length ? `Uncertain about: ${reference.uncertaintyNotes.join("; ")}. ` : ""}
          Answer only what matters — everything can still be edited on the next screen.
        </p>
        <span>{answeredCount} of {questions.length} answered</span>
      </header>

      <div className="decision-stack">
        {questions.map((question, index) => {
          const selected = answers[question.id] ?? [];
          const answered = isValidClarifyingAnswer(question, selected);
          return (
            <section
              key={question.id}
              id={`clarify-${question.id}`}
              className={`decision-step ${answered ? "decision-step--answered" : ""} ${flashId === question.id ? "decision-step--agent-set" : ""}`}
              aria-labelledby={`clarify-title-${question.id}`}
            >
              <div className="decision-step__number">{String(index + 1).padStart(2, "0")}</div>
              <div className="decision-step__body">
                <p className="quiet-kicker">{question.required ? "Needed" : "Optional"}</p>
                <h2 id={`clarify-title-${question.id}`}>{question.prompt}</h2>
                {question.detail && <p>{question.detail}</p>}
                {(question.kind === "single" || question.kind === "multiple") && (
                  <div className="decision-options" role="group" aria-label={question.prompt}>
                    {question.options?.map((option) => {
                      const active = selected.includes(option.value);
                      return (
                        <button
                          key={option.value}
                          type="button"
                          className={`decision-option ${active ? "decision-option--active" : ""}`}
                          aria-pressed={active}
                          onClick={() => choose(question, option.value)}
                        >
                          <span>{option.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
                {question.kind === "text" && (
                  <div className="decision-text-field">
                    <input
                      type="text"
                      className="decision-address-input"
                      value={selected[0] ?? ""}
                      maxLength={200}
                      aria-label={question.prompt}
                      onChange={(event) => setTextValue(question, event.target.value)}
                    />
                  </div>
                )}
                {question.kind === "money" && (
                  <div className="decision-text-field">
                    <input
                      type="number"
                      className="decision-address-input"
                      min={1}
                      max={1000000}
                      inputMode="decimal"
                      value={moneyValue(selected)}
                      placeholder={`Amount in ${brief?.budget?.currency ?? "USD"}`}
                      aria-label={question.prompt}
                      onChange={(event) => setTextValue(question, event.target.value)}
                    />
                    <small className="decision-text-field__note">Currency: {brief?.budget?.currency ?? "USD"} — adjustable on the next screen.</small>
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>

      <div className="go-dock">
        <div>
          <strong>{requiredMissing.length ? `${requiredMissing.length} needed answer${requiredMissing.length === 1 ? "" : "s"} left.` : "Ready to review your brief."}</strong>
          <span>Nothing is searched until you confirm the brief.</span>
        </div>
        <div className="go-dock__actions">
          <button type="button" className="quiet-button" onClick={returnToEntry}>Start over</button>
          <button type="button" className="go-button" disabled={requiredMissing.length > 0} onClick={proceedToBriefReview}>
            Review brief <span aria-hidden>→</span>
          </button>
        </div>
      </div>
    </main>
  );
}
