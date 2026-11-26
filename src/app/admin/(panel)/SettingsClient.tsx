"use client";
import { useState } from "react";
import type { GameSettings } from "@/lib/defaults";
import { DIFFICULTIES, type Difficulty } from "@/lib/constants";

type NumKey = Exclude<keyof GameSettings, "ladder">;

const FIELDS: { k: NumKey; label: string; hint: string }[] = [
  { k: "questionTimerSec", label: "Question timer (s)", hint: "Per question, on timed levels" },
  { k: "timedUntilLevel", label: "Timer up to level", hint: "Q1 to this level are timed" },
  { k: "walkAwayFromLevel", label: "Walk away from level", hint: "Player may quit from this level" },
  { k: "phoneFriendSec", label: "Phone a Friend (s)", hint: "Call countdown" },
  { k: "reconfirmSec", label: "Reconfirm limit (s)", hint: "Auto-cancel if no answer" },
  { k: "maxCancelsPerQuestion", label: "Cancels per question", hint: "Then the next pick locks directly" },
  { k: "askAiCorrectPct", label: "Ask the AI correct (%)", hint: "Chance the suggestion is right" },
];

export default function SettingsClient({ initial, defaults }: { initial: GameSettings; defaults: GameSettings }) {
  const [s, setS] = useState<GameSettings>(initial);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const setNum = (k: NumKey, v: string) => setS((p) => ({ ...p, [k]: v === "" ? ("" as unknown as number) : Number(v) }));
  const setStep = (i: number, patch: Partial<GameSettings["ladder"][number]>) =>
    setS((p) => ({ ...p, ladder: p.ladder.map((st, j) => (j === i ? { ...st, ...patch } : st)) }));

  async function save() {
    setBusy(true);
    const res = await fetch("/api/admin/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(s),
    });
    const data = await res.json();
    setBusy(false);
    if (data.ok) { setS(data.settings); setMsg({ kind: "ok", text: "Settings saved. New games use them immediately." }); }
    else setMsg({ kind: "err", text: data.errors?.join(" ") ?? "Save failed." });
  }

  return (
    <section className="card section">
      <div className="row-between">
        <h2>Game rules</h2>
        <div className="toolbar">
          <button className="btn" onClick={() => { setS(defaults); setMsg(null); }}>Reset to defaults</button>
          <button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save settings"}</button>
        </div>
      </div>
      {msg && <div className={`notice ${msg.kind}`} role="status">{msg.text}</div>}

      <div className="fields">
        {FIELDS.map((f) => (
          <label key={f.k} className="field">
            <span>{f.label}</span>
            <input className="input" type="number" value={s[f.k]} onChange={(e) => setNum(f.k, e.target.value)} />
            <small className="muted">{f.hint}</small>
          </label>
        ))}
      </div>

      <h3>Image Coins ladder</h3>
      <div className="table-wrap">
        <table className="grid ladder-edit">
          <thead><tr><th>Q</th><th>Image Coins</th><th>Tier</th><th>Timer</th><th>Walk away</th></tr></thead>
          <tbody>
            {s.ladder.map((st, i) => {
              const level = i + 1;
              return (
                <tr key={level}>
                  <td>{level}</td>
                  <td>
                    <input
                      className="input"
                      type="number"
                      value={st.coins}
                      aria-label={`Coins for question ${level}`}
                      onChange={(e) => setStep(i, { coins: Number(e.target.value) })}
                    />
                  </td>
                  <td>
                    <select
                      className="input"
                      value={st.tier}
                      aria-label={`Tier for question ${level}`}
                      onChange={(e) => setStep(i, { tier: e.target.value as Difficulty })}
                    >
                      {DIFFICULTIES.map((d) => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </td>
                  <td>{level <= s.timedUntilLevel ? `${s.questionTimerSec}s` : "—"}</td>
                  <td>{level >= s.walkAwayFromLevel ? "✓" : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
