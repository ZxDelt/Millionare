"use client";
import { useMemo, useRef, useState } from "react";
import type { Question } from "@/lib/questions";
import { CATEGORIES, DIFFICULTIES, SESSION_TIER_NEEDS, type Difficulty } from "@/lib/constants";
import QuestionEditor from "./QuestionEditor";

const catLabel = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.label])) as Record<string, string>;
const LETTERS = ["A", "B", "C", "D"];
type DiffFilter = "all" | Difficulty | "untagged";

export default function QuestionBankClient({ initial }: { initial: Question[] }) {
  const [questions, setQuestions] = useState(initial);
  const [search, setSearch] = useState("");
  const [diff, setDiff] = useState<DiffFilter>("all");
  const [cat, setCat] = useState("all");
  const [status, setStatus] = useState("all");
  const [editing, setEditing] = useState<Question | "new" | null>(null);
  const [notice, setNotice] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return questions.filter(
      (q) =>
        (diff === "all" || (diff === "untagged" ? q.difficulty === null : q.difficulty === diff)) &&
        (cat === "all" || q.category === cat) &&
        (status === "all" || q.status === status) &&
        (!s || q.text.toLowerCase().includes(s) || q.options.some((o) => o.toLowerCase().includes(s))),
    );
  }, [questions, search, diff, cat, status]);

  const counts = useMemo(() => {
    const active = questions.filter((q) => q.status === "active");
    return {
      easy: active.filter((q) => q.difficulty === "easy").length,
      medium: active.filter((q) => q.difficulty === "medium").length,
      hard: active.filter((q) => q.difficulty === "hard").length,
      untagged: active.filter((q) => q.difficulty === null).length,
    };
  }, [questions]);

  const upsert = (q: Question) =>
    setQuestions((list) => (list.some((x) => x.id === q.id) ? list.map((x) => (x.id === q.id ? q : x)) : [...list, q]));

  async function patch(id: number, body: object) {
    const res = await fetch(`/api/admin/questions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (data.ok) upsert(data.question);
    else setNotice({ kind: "err", text: data.errors?.join(" ") ?? "Update failed." });
  }

  async function remove(q: Question) {
    if (!confirm(`Delete question #${q.id}?\n\n"${q.text}"\n\nThis cannot be undone.`)) return;
    const res = await fetch(`/api/admin/questions/${q.id}`, { method: "DELETE" });
    if (res.ok) setQuestions((list) => list.filter((x) => x.id !== q.id));
    else setNotice({ kind: "err", text: "Delete failed." });
  }

  async function reload() {
    const data = await (await fetch("/api/admin/questions")).json();
    if (data.ok) setQuestions(data.questions);
  }

  async function onImport(file: File) {
    const text = await file.text();
    const format = file.name.toLowerCase().endsWith(".csv") ? "csv" : "json";
    const res = await fetch("/api/admin/questions/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ format, data: text }),
    });
    const data = await res.json();
    if (!data.ok) {
      setNotice({ kind: "err", text: data.errors?.join(" ") ?? "Import failed." });
      return;
    }
    await reload();
    const parts = [`Imported ${data.imported}.`];
    if (data.duplicates) parts.push(`Skipped ${data.duplicates} duplicates.`);
    if (data.errorCount) parts.push(`${data.errorCount} rows had errors: ${data.errors.slice(0, 3).join(" | ")}`);
    setNotice({ kind: data.errorCount ? "err" : "ok", text: parts.join(" ") });
  }

  return (
    <>
      <div className="row-between">
        <h1>Question Bank</h1>
        <div className="toolbar">
          <button className="btn btn-primary" onClick={() => setEditing("new")}>+ Add question</button>
          <button className="btn" onClick={() => fileRef.current?.click()}>Import JSON/CSV</button>
          <input
            ref={fileRef}
            type="file"
            accept=".json,.csv,application/json,text/csv"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onImport(f);
              e.target.value = "";
            }}
          />
          <a className="btn" href="/api/admin/questions/export?format=json">Export JSON</a>
          <a className="btn" href="/api/admin/questions/export?format=csv">Export CSV</a>
        </div>
      </div>

      <div className="stats">
        {DIFFICULTIES.map((d) => (
          <div key={d} className={`stat${counts[d] < SESSION_TIER_NEEDS[d] ? " warn" : ""}`}>
            <div className="v">{counts[d]}</div>
            <div className="k">{d} (active){counts[d] < SESSION_TIER_NEEDS[d] ? ` · need ${SESSION_TIER_NEEDS[d]}` : ""}</div>
          </div>
        ))}
        <div className="stat"><div className="v">{counts.untagged}</div><div className="k">untagged (active)</div></div>
        <div className="stat"><div className="v">{questions.length}</div><div className="k">total</div></div>
      </div>

      {notice && (
        <div className={`notice ${notice.kind}`} role="status">
          {notice.text}
          <button className="link" onClick={() => setNotice(null)} aria-label="Dismiss">×</button>
        </div>
      )}

      <div className="filters">
        <input className="input" placeholder="Search question or option…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="input" value={diff} onChange={(e) => setDiff(e.target.value as DiffFilter)} aria-label="Difficulty filter">
          <option value="all">All difficulties</option>
          {DIFFICULTIES.map((d) => <option key={d} value={d}>{d}</option>)}
          <option value="untagged">untagged</option>
        </select>
        <select className="input" value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Category filter">
          <option value="all">All categories</option>
          {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
        <select className="input" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status filter">
          <option value="all">Any status</option>
          <option value="active">active</option>
          <option value="draft">draft</option>
        </select>
      </div>

      <p className="muted">Showing {filtered.length} of {questions.length}. Tag buttons: E / M / H set difficulty, – clears it (untagged = picked at random).</p>

      <div className="card table-wrap">
        <table className="grid">
          <thead>
            <tr><th>#</th><th>Question</th><th>Options</th><th>Difficulty</th><th>Category</th><th>Status</th><th>Used</th><th /></tr>
          </thead>
          <tbody>
            {filtered.map((q) => (
              <tr key={q.id} className={q.status === "draft" ? "dim" : undefined}>
                <td>{q.id}</td>
                <td className="qtext">{q.text}</td>
                <td className="opts">
                  {q.options.map((o, i) => (
                    <div key={i} className={i === q.correctIndex ? "correct" : undefined}>
                      {LETTERS[i]}. {o}{i === q.correctIndex ? " ✓" : ""}
                    </div>
                  ))}
                </td>
                <td>
                  <div className="quicktag" role="group" aria-label={`Difficulty for question ${q.id}`}>
                    {(["easy", "medium", "hard"] as const).map((d) => (
                      <button
                        key={d}
                        className={`qt qt-${d}${q.difficulty === d ? " on" : ""}`}
                        onClick={() => patch(q.id, { difficulty: d })}
                        title={d}
                        aria-pressed={q.difficulty === d}
                      >
                        {d[0].toUpperCase()}
                      </button>
                    ))}
                    <button
                      className={`qt${q.difficulty === null ? " on" : ""}`}
                      onClick={() => patch(q.id, { difficulty: null })}
                      title="untagged"
                      aria-pressed={q.difficulty === null}
                    >
                      –
                    </button>
                  </div>
                </td>
                <td>{catLabel[q.category] ?? q.category}</td>
                <td>
                  <button className="link" onClick={() => patch(q.id, { status: q.status === "active" ? "draft" : "active" })}>
                    {q.status}
                  </button>
                </td>
                <td>{q.timesUsed}</td>
                <td className="actions">
                  <button className="btn btn-sm" onClick={() => setEditing(q)}>Edit</button>
                  <button className="btn btn-sm btn-danger" onClick={() => remove(q)}>Delete</button>
                </td>
              </tr>
            ))}
            {!filtered.length && (
              <tr><td colSpan={8} className="muted">No questions match.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <QuestionEditor
          question={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(q) => {
            upsert(q);
            setEditing(null);
            setNotice({ kind: "ok", text: `Saved question #${q.id}.` });
          }}
        />
      )}
    </>
  );
}
