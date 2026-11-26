"use client";
import { useEffect, useState } from "react";
import type { Question } from "@/lib/questions";
import { CATEGORIES, DIFFICULTIES } from "@/lib/constants";
import { LIMITS, validateQuestion } from "@/lib/validate";

interface Props {
  question: Question | null;
  onClose: () => void;
  onSaved: (q: Question) => void;
}

export default function QuestionEditor({ question, onClose, onSaved }: Props) {
  const [text, setText] = useState(question?.text ?? "");
  const [options, setOptions] = useState<string[]>(question?.options ?? ["", "", "", ""]);
  const [correctIndex, setCorrectIndex] = useState(question?.correctIndex ?? -1);
  const [difficulty, setDifficulty] = useState<string>(question?.difficulty ?? "");
  const [category, setCategory] = useState<string>(question?.category ?? "");
  const [explanation, setExplanation] = useState(question?.explanation ?? "");
  const [status, setStatus] = useState<string>(question?.status ?? "active");
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const payload = { text, options, correctIndex, difficulty: difficulty || null, category, explanation, status };
    const v = validateQuestion(payload);
    if (!v.ok) { setErrors(v.errors); return; }
    setBusy(true);
    const res = await fetch(question ? `/api/admin/questions/${question.id}` : "/api/admin/questions", {
      method: question ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(v.value),
    });
    const data = await res.json();
    setBusy(false);
    if (data.ok) onSaved(data.question);
    else setErrors(data.errors ?? ["Save failed."]);
  }

  const counter = (n: number, max: number) => <span className={n > max ? "error" : "muted"}>{n}/{max}</span>;

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="modal card" onSubmit={save} aria-label={question ? `Edit question ${question.id}` : "New question"}>
        <div className="row-between">
          <h2>{question ? `Edit question #${question.id}` : "New question"}</h2>
          <button type="button" className="link" onClick={onClose} aria-label="Close">×</button>
        </div>

        <label className="field">
          <span>Question {counter(text.length, LIMITS.text)}</span>
          <textarea className="input" rows={2} value={text} onChange={(e) => setText(e.target.value)} autoFocus />
        </label>

        <fieldset className="field">
          <legend>Options (select the correct one)</legend>
          {options.map((o, i) => (
            <div key={i} className="opt-row">
              <input
                type="radio"
                name="correct"
                checked={correctIndex === i}
                onChange={() => setCorrectIndex(i)}
                aria-label={`Option ${"ABCD"[i]} is correct`}
              />
              <span className="letter">{"ABCD"[i]}</span>
              <input
                className="input"
                value={o}
                onChange={(e) => setOptions((arr) => arr.map((x, j) => (j === i ? e.target.value : x)))}
                aria-label={`Option ${"ABCD"[i]}`}
              />
              {counter(o.length, LIMITS.option)}
            </div>
          ))}
        </fieldset>

        <div className="grid3">
          <label className="field">
            <span>Difficulty</span>
            <select className="input" value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
              <option value="">untagged (random)</option>
              {DIFFICULTIES.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Category</span>
            <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">Choose…</option>
              {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Status</span>
            <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="active">active</option>
              <option value="draft">draft (not used in games)</option>
            </select>
          </label>
        </div>

        <label className="field">
          <span>Explanation (shown after the reveal) {counter(explanation.length, LIMITS.explanation)}</span>
          <textarea className="input" rows={3} value={explanation} onChange={(e) => setExplanation(e.target.value)} />
        </label>

        <div className="preview" aria-label="Stage preview">
          <div className="pv-q">{text || "Question text…"}</div>
          <div className="pv-opts">
            {options.map((o, i) => (
              <div key={i} className={`pv-opt${correctIndex === i ? " pv-correct" : ""}`}>
                <b>{"ABCD"[i]}:</b> {o || "…"}
              </div>
            ))}
          </div>
        </div>

        {errors.length > 0 && (
          <ul className="error" role="alert">{errors.map((e) => <li key={e}>{e}</li>)}</ul>
        )}

        <div className="toolbar end">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={busy}>{busy ? "Saving…" : "Save"}</button>
        </div>
      </form>
    </div>
  );
}
