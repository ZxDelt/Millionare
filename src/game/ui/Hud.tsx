"use client";
import { useEffect, useRef } from "react";
import { timerRemaining, useGame, type GameView } from "../store";
import { askWalkAway, next, select, takeLifeline, toggleMute } from "../director";
import { formatCoins } from "@/lib/speech";
import type { LifelineId } from "@/lib/game-types";

const LETTERS = ["A", "B", "C", "D"];

/** The server already knows the verdict during the suspense beat; the HUD must not give it away. */
const hidingResult = (g: GameView) => g.mood === "locked" || g.mood === "suspense";

export default function Hud() {
  return (
    <div className="hud">
      <div className="top-left">
        <Lifelines />
        <MuteButton />
      </div>
      <Ladder />
      <BottomPanel />
    </div>
  );
}

function MuteButton() {
  const muted = useGame((s) => s.muted);
  return (
    <button className="mute-btn" onClick={toggleMute} aria-label={muted ? "Unmute" : "Mute"}>
      {muted ? "🔇" : "🔊"}
    </button>
  );
}

const LIFELINES: { id: LifelineId; label: string; icon: string; key: string }[] = [
  { id: "double", label: "Double Chance", icon: "×2", key: "Q" },
  { id: "phone", label: "Phone a Friend", icon: "☎", key: "P" },
  { id: "askAi", label: "Ask the AI", icon: "AI", key: "I" },
];

function Lifelines() {
  const s = useGame((g) => g.server);
  const busy = useGame((g) => g.busy);
  const reconfirm = useGame((g) => g.reconfirm);
  const doubleActive = s?.doubleActive;
  if (!s) return null;
  const canUse = s.phase === "question" && s.begun && !busy && !reconfirm;
  return (
    <div className="lifelines" role="group" aria-label="Lifelines">
      {LIFELINES.map((l) => {
        const avail = s.lifelines[l.id];
        const active = l.id === "double" && doubleActive;
        return (
          <button
            key={l.id}
            className={`lifeline${avail ? "" : " used"}${active ? " active" : ""}`}
            disabled={!avail || !canUse}
            onClick={() => takeLifeline(l.id)}
            title={`${l.label} (${l.key})`}
            aria-label={`${l.label}${avail ? "" : " (used)"}`}
          >
            <span className="ll-icon">{l.icon}</span>
            <span className="ll-label">{l.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function Ladder() {
  const s = useGame((g) => g.server);
  const hidden = useGame(hidingResult);
  if (!s) return null;
  const steps = s.ladder.map((st, i) => ({ ...st, level: i + 1 })).reverse();
  return (
    <ol className="ladder" aria-label="Image Coins ladder">
      {steps.map((st) => {
        const cls = [
          "rung",
          st.level === s.level && s.phase !== "over" ? "current" : "",
          st.level < s.level || (st.level === s.level && ((s.phase === "revealed" && !hidden) || s.over?.reason === "win")) ? "won" : "",
          st.level === s.walkAwayFromLevel ? "walk-mark" : "",
          st.level === 16 ? "jackpot" : "",
        ].join(" ");
        return (
          <li key={st.level} className={cls}>
            <span className="rung-n">{st.level}</span>
            <span className="rung-c">{formatCoins(st.coins)}</span>
          </li>
        );
      })}
    </ol>
  );
}

function BottomPanel() {
  const s = useGame((g) => g.server);
  const qVisible = useGame((g) => g.questionVisible);
  const shown = useGame((g) => g.optionsShown);
  const plates = useGame((g) => g.plates);
  const suggestion = useGame((g) => g.suggestion);
  const canNext = useGame((g) => g.canNext);
  const explanation = useGame((g) => g.explanation);
  const busy = useGame((g) => g.busy);
  const screen = useGame((g) => g.screen);
  const hidden = useGame(hidingResult);
  if (!s?.question) return null;
  const showOver = !!s.over && !hidden;
  const banked = hidden && (s.phase === "revealed" || s.phase === "over") ? (s.level > 1 ? s.ladder[s.level - 2].coins : 0) : s.bankedCoins;
  const q = s.question;
  const clickable = s.phase === "question" && s.begun && !busy;

  return (
    <div className={`bottom${qVisible ? " in" : ""}`}>
      <div className="bottom-top">
        <div className="coins-now">
          <span className="muted">{showOver ? "Won" : "Banked"}</span>
          <b>◆ {formatCoins(showOver ? s.over!.coins : banked)}</b>
        </div>
        <TimerRing />
        <div className="bottom-actions">
          {s.canWalkAway && screen === "play" && (
            <button className="btn btn-walk" onClick={askWalkAway} disabled={busy}>Walk away (W)</button>
          )}
          {s.doubleActive && s.phase !== "over" && <span className="badge-dc">Double Chance active</span>}
        </div>
      </div>

      {explanation && (
        <div className="explain" role="status">
          <b>Did you know?</b> {explanation}
          {canNext && (
            <button className="btn btn-primary btn-next" onClick={next} autoFocus>
              Next question ▶
            </button>
          )}
        </div>
      )}

      <div className="q-banner" aria-live="polite">
        <span className="q-level">Q{s.level}</span>
        <span className="q-text">{q.text}</span>
      </div>
      <div className="plates">
        {q.options.map((o, i) => {
          const st = plates[i];
          const visible = i < shown;
          return (
            <button
              key={i}
              className={`plate plate-${st}${visible ? " in" : ""}${suggestion === i && st === "idle" ? " suggested" : ""}`}
              disabled={!visible || !clickable || st === "eliminated"}
              onClick={() => select(i)}
              aria-label={`${LETTERS[i]}: ${o}`}
            >
              <span className="plate-l">{LETTERS[i]}</span>
              <span className="plate-t">{o}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Countdown ring. Updates the DOM directly each frame — no React re-render per tick (GDD §14.3). */
function TimerRing() {
  const timed = useGame((g) => g.timer.timed);
  const ringRef = useRef<SVGCircleElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const C = 2 * Math.PI * 34;

  useEffect(() => {
    if (!timed) return;
    let raf = 0;
    const loop = () => {
      const t = useGame.getState().timer;
      const rem = timerRemaining(t);
      const frac = t.totalMs ? rem / t.totalMs : 0;
      if (ringRef.current) ringRef.current.style.strokeDashoffset = String(C * (1 - frac));
      if (textRef.current) textRef.current.textContent = String(Math.ceil(rem / 1000));
      if (wrapRef.current) {
        wrapRef.current.classList.toggle("low", rem <= 10_000);
        wrapRef.current.classList.toggle("paused", !t.running);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [timed, C]);

  if (!timed) return <div className="timer untimed" title="No timer from this level">∞</div>;
  return (
    <div className="timer" ref={wrapRef} role="timer" aria-label="Time left">
      <svg viewBox="0 0 80 80" width="80" height="80" aria-hidden>
        <circle cx="40" cy="40" r="34" className="timer-bg" />
        <circle cx="40" cy="40" r="34" className="timer-fg" ref={ringRef} strokeDasharray={C} transform="rotate(-90 40 40)" />
      </svg>
      <span ref={textRef} className="timer-n" />
    </div>
  );
}
