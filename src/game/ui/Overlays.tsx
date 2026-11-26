"use client";
import { useEffect, useRef, useState } from "react";
import { useGame } from "../store";
import { cancel, confirm, endPhone, needsAudioUnlock, playAgain, unlockAudio, walkAway } from "../director";
import { formatCoins } from "@/lib/speech";

const LETTERS = ["A", "B", "C", "D"];

/** Typewriter speech bubble. */
export function HostBubble() {
  const host = useGame((s) => s.host);
  const [shown, setShown] = useState("");
  useEffect(() => {
    if (!host.visible) return;
    let i = 0;
    setShown("");
    const id = setInterval(() => {
      i += 2;
      setShown(host.text.slice(0, i));
      if (i >= host.text.length) clearInterval(id);
    }, 30);
    return () => clearInterval(id);
  }, [host.key, host.text, host.visible]);
  if (!host.visible) return null;
  return (
    <div className="host-bubble" aria-live="polite">
      <span className="host-name">HOST</span>
      {shown}
    </div>
  );
}

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

export function ReconfirmDialog() {
  const r = useGame((s) => s.reconfirm);
  const s = useGame((g) => g.server);
  const busy = useGame((g) => g.busy);
  const { barRef, numRef } = useCountdown(r?.endsAt ?? null, () => cancel(true));
  if (!r || !s?.question) return null;
  return (
    <div className="dialog reconfirm" role="dialog" aria-label="Confirm your answer">
      <div className="dialog-title">
        Lock in <b>{LETTERS[r.index]}: {s.question.options[r.index]}</b>?
      </div>
      <div className="dialog-sub muted">
        {s.cancelsLeft > 0 ? `You can change your mind ${s.cancelsLeft} more time.` : "This is your last chance to change."} Timer is paused.
      </div>
      <div className="dialog-btns">
        <button className="btn btn-primary" onClick={confirm} disabled={busy} autoFocus>Yes, lock it (Y)</button>
        <button className="btn" onClick={() => cancel()} disabled={busy}>No (N)</button>
      </div>
      <div className="cd-bar"><div ref={barRef} /></div>
      <span className="cd-n" ref={numRef} />
    </div>
  );
}

export function PhoneOverlay() {
  const p = useGame((s) => s.phone);
  const { barRef, numRef } = useCountdown(p?.endsAt ?? null, endPhone);
  if (!p) return null;
  return (
    <div className="dialog phone" role="dialog" aria-label="Phone a friend">
      <div className="phone-icon" aria-hidden>☎</div>
      <div className="dialog-title">Phone a Friend</div>
      <div className="dialog-sub muted">Call your friend on your own phone now. The question timer is paused.</div>
      <div className="phone-n"><span ref={numRef} />s</div>
      <div className="cd-bar"><div ref={barRef} /></div>
      <div className="dialog-btns">
        <button className="btn btn-primary" onClick={endPhone}>Done, back to the game</button>
      </div>
    </div>
  );
}

export function WalkConfirm() {
  const open = useGame((s) => s.walkConfirm);
  const s = useGame((g) => g.server);
  if (!open || !s) return null;
  return (
    <div className="dialog" role="dialog" aria-label="Walk away">
      <div className="dialog-title">Walk away with ◆ {formatCoins(s.bankedCoins)} Image Coins?</div>
      <div className="dialog-sub muted">If you play on and get it wrong, you leave with nothing.</div>
      <div className="dialog-btns">
        <button className="btn btn-primary" onClick={() => walkAway(true)} autoFocus>Yes, walk away (Y)</button>
        <button className="btn" onClick={() => walkAway(false)}>Keep playing (N)</button>
      </div>
    </div>
  );
}

export function OverScreen() {
  const s = useGame((g) => g.server);
  if (!s?.over) return null;
  const { reason, coins } = s.over;
  const title = { win: "JACKPOT!", walk: "Well played!", wrong: "Game over", timeout: "Time's up!" }[reason];
  const sub = {
    win: `${s.name} answered all 16 questions!`,
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
