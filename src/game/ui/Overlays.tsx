"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { frame, useGame } from "../store";
import { cancel, confirm, endPhone, needsAudioUnlock, playAgain, unlockAudio, walkAway } from "../director";
import { formatCoins } from "@/lib/speech";

const LETTERS = ["A", "B", "C", "D"];

/** Countdown bar driven by rAF; calls onDone once when it hits zero. */
function useCountdown(endsAt: number | null, onDone: () => void) {
  const barRef = useRef<HTMLDivElement>(null);
  const numRef = useRef<HTMLSpanElement>(null);
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    if (endsAt === null) return;
    let raf = 0;
    let fired = false;
    const start = performance.now();
    const total = Math.max(1, endsAt - start);
    const loop = () => {
      const rem = Math.max(0, endsAt - performance.now());
      if (barRef.current) barRef.current.style.transform = `scaleX(${rem / total})`;
      if (numRef.current) numRef.current.textContent = String(Math.ceil(rem / 1000));
      if (rem <= 0 && !fired) { fired = true; done.current(); return; }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [endsAt]);
  return { barRef, numRef };
}

/** Typewriter text that restarts whenever `key` changes. */
function useTyped(text: string, key: number, on: boolean) {
  const [shown, setShown] = useState("");
  useEffect(() => {
    if (!on) return;
    let i = 0;
    setShown("");
    const id = setInterval(() => {
      i += 2;
      setShown(text.slice(0, i));
      if (i >= text.length) clearInterval(id);
    }, 30);
    return () => clearInterval(id);
  }, [key, text, on]);
  return shown;
}

const rectOf = (sel: string) => {
  const el = document.querySelector(sel);
  return el ? el.getBoundingClientRect() : null;
};

/**
 * Keeps a bubble next to a character's head. Prefers the outer side of the head (host: left,
 * contestant: right), falls back to above the head, and stays clear of the lifelines, ladder and
 * question panel. Runs on rAF and writes the transform directly (no React re-render per frame).
 */
function useHeadAnchor(who: "host" | "player", on: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!on) return;
    let raf = 0;
    const side = who === "host" ? -1 : 1;
    const loop = () => {
      const el = ref.current;
      if (el) {
        const a = frame.anchors[who];
        const vw = window.innerWidth, vh = window.innerHeight;
        const ladder = rectOf(".ladder");
        const tools = rectOf(".top-left");
        const panel = rectOf(".bottom.in");
        const L = 16, R = (ladder ? ladder.left : vw) - 16, T = 16, B = (panel ? panel.top : vh) - 12;
        const ax = a.on ? a.x : side < 0 ? vw * 0.35 : vw * 0.6;
        const ay = a.on ? a.y : vh * 0.4;
        const gap = Math.max(26, a.scale * 0.34 + 12);
        // Beside the head if at least 230 px fit there (the bubble narrows to fit), else above it.
        const room = side < 0 ? ax - gap - L : R - (ax + gap);
        const mode: "side" | "top" = room >= 230 ? "side" : "top";
        el.style.maxWidth = mode === "side" ? `${Math.floor(Math.min(400, room))}px` : "";
        const w = el.offsetWidth, h = el.offsetHeight;
        let x = mode === "side" ? (side < 0 ? ax - gap - w : ax + gap) : ax - w / 2;
        let y = mode === "side" ? ay - h * 0.55 : ay - gap - h - 8;
        x = Math.min(Math.max(x, L), Math.max(L, R - w));
        if (tools && x < tools.right + 8 && y < tools.bottom + 12) y = tools.bottom + 12;
        y = Math.min(Math.max(y, T), Math.max(T, B - h));
        el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
        let tail = "none";
        if (a.on) {
          if (mode === "side") {
            const ty = ay - y;
            if (ty > 14 && ty < h - 14) { tail = side < 0 ? "right" : "left"; el.style.setProperty("--ty", `${Math.round(ty)}px`); }
          } else {
            const tx = ax - x;
            if (tx > 20 && tx < w - 20 && ay > y + h) { tail = "down"; el.style.setProperty("--tx", `${Math.round(tx)}px`); }
          }
        }
        el.dataset.tail = tail;
        el.style.visibility = "visible";
      }
      raf = requestAnimationFrame(loop);
    };
    loop(); // place it before the first paint
    return () => cancelAnimationFrame(raf);
  }, [who, on]);
  return ref;
}

/**
 * The host's speech bubble, next to the host's head. Prompts the host asks (lock in? walk away?
 * phone timer) appear inside it, so every dialog comes from the host.
 */
export function HostBubble() {
  const host = useGame((s) => s.host);
  const r = useGame((s) => s.reconfirm);
  const walk = useGame((s) => s.walkConfirm);
  const phone = useGame((s) => s.phone);
  const s = useGame((g) => g.server);
  const busy = useGame((g) => g.busy);
  const walkText = s ? `Walk away with ◆ ${formatCoins(s.bankedCoins)} Image Coins? Play on and miss, and you leave with nothing.` : "";
  const text = walk ? walkText : host.text;
  const visible = host.visible || !!r || walk || !!phone;
  const shown = useTyped(text, walk ? -1 : host.key, visible);
  const ref = useHeadAnchor("host", visible);
  const cd = useCountdown(r?.endsAt ?? null, () => cancel(true));
  const ph = useCountdown(phone?.endsAt ?? null, endPhone);
  if (!visible) return null;
  const mode = r ? "reconfirm" : walk ? "walk" : phone ? "phone" : "talk";
  return (
    <div ref={ref} className={`speech speech-host speech-${mode}`} role={mode === "talk" ? undefined : "dialog"} aria-live="polite">
      <span className="speech-name">HOST</span>
      <p className="speech-text">
        {shown}
        <span className="speech-ghost" aria-hidden>{text.slice(shown.length)}</span>
      </p>
      {r && s?.question && (
        <>
          <div className="speech-pick"><b>{LETTERS[r.index]}</b><span>{s.question.options[r.index]}</span></div>
          <div className="speech-meta">
            <span>{s.cancelsLeft > 0 ? `${s.cancelsLeft} change left` : "Last chance to change"} · timer paused</span>
            <span className="speech-cd" ref={cd.numRef} />
          </div>
          <div className="cd-bar"><div ref={cd.barRef} /></div>
          <div className="speech-btns">
            <button className="btn btn-primary" onClick={confirm} disabled={busy} autoFocus>Lock it <kbd>Y</kbd></button>
            <button className="btn" onClick={() => cancel()} disabled={busy}>No <kbd>N</kbd></button>
          </div>
        </>
      )}
      {walk && (
        <div className="speech-btns">
          <button className="btn btn-primary" onClick={() => walkAway(true)} autoFocus>Walk away <kbd>Y</kbd></button>
          <button className="btn" onClick={() => walkAway(false)}>Keep playing <kbd>N</kbd></button>
        </div>
      )}
      {phone && (
        <>
          <div className="speech-phonebox">
            <span className="phone-icon" aria-hidden>☎</span>
            <span className="phone-n"><span ref={ph.numRef} />s</span>
          </div>
          <div className="speech-meta"><span>Call your friend on your own phone · timer paused</span></div>
          <div className="cd-bar cd-cyan"><div ref={ph.barRef} /></div>
          <div className="speech-btns">
            <button className="btn btn-primary" onClick={endPhone}>Done, back to the game <kbd>Enter</kbd></button>
          </div>
        </>
      )}
    </div>
  );
}

/** The contestant's speech bubble (says the answer, asks for a lifeline). */
export function PlayerBubble() {
  const p = useGame((s) => s.player);
  const name = useGame((s) => s.server?.name ?? "YOU");
  const shown = useTyped(p.text, p.key, p.visible);
  const ref = useHeadAnchor("player", p.visible);
  if (!p.visible) return null;
  return (
    <div ref={ref} className="speech speech-player" aria-live="polite">
      <span className="speech-name">{name.toUpperCase()}</span>
      <p className="speech-text">
        {shown}
        <span className="speech-ghost" aria-hidden>{p.text.slice(shown.length)}</span>
      </p>
    </div>
  );
}

export function OverScreen() {
  const s = useGame((g) => g.server);
  if (!s?.over) return null;
  const { reason, coins } = s.over;
  const title = { win: "JACKPOT!", walk: "Well played!", wrong: "Game over", timeout: "Time's up!" }[reason];
  const sub = {
    win: `${s.name} answered all ${s.ladder.length} questions!`,
    walk: `${s.name} walked away at question ${s.level}.`,
    wrong: `${s.name} reached question ${s.level}.`,
    timeout: `${s.name} ran out of time on question ${s.level}.`,
  }[reason];
  return (
    <div className="over-overlay">
      <div className={`over-card over-${reason}`}>
        <div className="over-title">{title}</div>
        <div className="muted">{sub}</div>
        <div className="over-coins">◆ {formatCoins(coins)}</div>
        <div className="muted">Image Coins</div>
        {s.reveal?.explanation && (
          <div className="over-explain">
            <b>Answer: {LETTERS[s.reveal.correctIndex]} — {s.question?.options[s.reveal.correctIndex]}.</b> {s.reveal.explanation}
          </div>
        )}
        {s.reveal?.cpclFact && (
          <div className="over-explain over-cpcl"><b>CPCL fact:</b> {s.reveal.cpclFact}</div>
        )}
        <button className="btn btn-primary btn-big" onClick={playAgain} autoFocus>Play again</button>
      </div>
    </div>
  );
}

export function LoadingScreen() {
  return (
    <div className="title-overlay">
      <div className="loading">
        <div className="spinner" aria-hidden />
        <div>Powering up the studio…</div>
      </div>
    </div>
  );
}

/** After a refresh the browser blocks audio until a click. */
export function AudioUnlock() {
  const [show, setShow] = useState(false);
  useEffect(() => setShow(needsAudioUnlock()), []);
  if (!show) return null;
  return (
    <button className="audio-unlock" onClick={() => { unlockAudio(); setShow(false); }}>
      🔊 Click to resume sound
    </button>
  );
}

export function Toast() {
  const error = useGame((s) => s.error);
  if (!error) return null;
  return <div className="toast" role="alert">{error}</div>;
}
