"use client";
/**
 * The show director: turns server state changes into a TV-style sequence
 * (host lines, suspense, lights, crowd, sound). The server is the referee; this is presentation only.
 */
import type { GameAction, LifelineId, PublicState } from "@/lib/game-types";
import { pickLine, type HostState } from "@/lib/host-lines";
import { explanationSpeech, formatCoins, questionSpeech } from "@/lib/speech";
import { audio, type Cue } from "./audio";
import { frame, initialView, setView, timerRemaining, useGame, type Crowd, type Mood, type Plate } from "./store";

const SESSION_KEY = "jj_session";
const LETTERS = ["A", "B", "C", "D"];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const get = () => useGame.getState();

// ---------------------------------------------------------------- server
class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json" } });
  const data = await res.json().catch(() => ({ ok: false, error: "Network error" }));
  if (!res.ok || !data.ok) throw new ApiError(data.error ?? "Something went wrong.", res.status);
  return data as T;
}

async function act(a: GameAction): Promise<PublicState> {
  const id = get().server?.id;
  if (!id) throw new ApiError("No game.", 400);
  try {
    const { state } = await api<{ state: PublicState }>(`/api/game/${id}`, { method: "POST", body: JSON.stringify(a) });
    sync(state);
    return state;
  } catch (e) {
    if (e instanceof ApiError && e.status === 409) {
      // State moved on (another tab, timeout...). Re-sync from the server.
      const { state } = await api<{ state: PublicState }>(`/api/game/${id}`);
      sync(state);
    }
    throw e;
  }
}

function sync(state: PublicState) {
  setView({
    server: state,
    timer: {
      timed: state.timer.timed,
      remainingMs: state.timer.remainingMs,
      running: state.timer.running,
      at: performance.now(),
      totalMs: state.timer.totalMs,
    },
  });
}

function toast(e: unknown) {
  setView({ error: e instanceof Error ? e.message : "Something went wrong." });
  setTimeout(() => setView({ error: null }), 4000);
}

// ---------------------------------------------------------------- stage helpers
function mood(m: Mood) { setView({ mood: m }); }
function crowd(c: Crowd) { setView({ crowd: c, crowdAt: performance.now() }); }
function plate(i: number, p: Plate) { setView((s) => ({ plates: s.plates.map((x, j) => (j === i ? p : x)) })); }
function sfx(c: Cue) { audio.play(c); }

function vars(extra: Record<string, string | number> = {}): Record<string, string | number> {
  const s = get().server;
  return {
    name: s?.name ?? "",
    level: s?.level ?? 1,
    coins: s ? formatCoins(s.ladder[Math.min(s.level, s.ladder.length) - 1].coins) : 0,
    ...extra,
  };
}

// ---------------------------------------------------------------- host voice
const voiceCache = new Map<string, Promise<ArrayBuffer | null>>();
let lastLine = "";

function fetchVoice(text: string): Promise<ArrayBuffer | null> {
  const s = get();
  if (!s.voice || !s.server) return Promise.resolve(null);
  let p = voiceCache.get(text);
  if (!p) {
    p = fetch(`/api/game/${s.server.id}/speak`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    })
      .then((r) => {
        if (r.ok) return r.arrayBuffer();
        // Voice broken (bad key, no credits, limit): stop trying for the rest of this game.
        if (r.status === 503 || r.status === 429) setView({ voice: false });
        return null;
      })
      .catch(() => null);
    voiceCache.set(text, p);
    if (voiceCache.size > 40) voiceCache.delete(voiceCache.keys().next().value!);
  }
  return p;
}

/** Host speaks: voice (with lip sync) if available, otherwise bubble with flapping mouth. */
async function say(text: string, opts: { bubble?: boolean } = {}) {
  const bubble = opts.bubble ?? true;
  if (bubble) setView((s) => ({ host: { text, visible: true, key: s.host.key + 1 } }));
  const clip = await fetchVoice(text);
  if (clip) {
    try {
      await audio.playVoice(clip);
      await sleep(250);
      return;
    } catch { /* bad clip → fall back to text timing */ }
  }
  setView({ talking: true });
  await sleep(Math.min(6000, 600 + text.length * 38));
  setView({ talking: false });
  await sleep(500);
}

async function line(state: HostState, extra?: Record<string, string | number>, opts?: { bubble?: boolean }) {
  const t = pickLine(state, vars(extra), lastLine);
  lastLine = t;
  await say(t, opts);
}

// ---------------------------------------------------------------- timer watch
let watch: ReturnType<typeof setInterval> | null = null;
let lowSaid = false;
let lastTickSec = -1;
let timeoutSent = false;

function startWatch() {
  stopWatch();
  lowSaid = false;
  lastTickSec = -1;
  timeoutSent = false;
  watch = setInterval(() => {
    const s = get();
    if (s.screen !== "play" || !s.server || s.server.phase !== "question" || !s.timer.running) return;
    const rem = timerRemaining(s.timer);
    const sec = Math.ceil(rem / 1000);
    if (rem <= 10_000 && rem > 0) {
      if (!lowSaid) {
        lowSaid = true;
        mood("tension");
        void line("timerLow");
      }
      if (sec !== lastTickSec) { lastTickSec = sec; sfx("tick"); }
    }
    if (rem <= 0 && !timeoutSent && !s.busy) {
      timeoutSent = true;
      void onTimeout();
    }
  }, 100);
}

function stopWatch() {
  if (watch) clearInterval(watch);
  watch = null;
}

// ---------------------------------------------------------------- flow
async function withBusy<T>(fn: () => Promise<T>): Promise<T | undefined> {
  if (get().busy) return;
  setView({ busy: true });
  try {
    return await fn();
  } catch (e) {
    toast(e);
  } finally {
    setView({ busy: false });
  }
}

const bedFor = (tier: string): Cue => (tier === "hard" ? "bedHard" : tier === "medium" ? "bedMedium" : "bedEasy");

async function presentQuestion(first: boolean) {
  const s = get().server!;
  setView({
    questionVisible: false,
    optionsShown: 0,
    plates: ["idle", "idle", "idle", "idle"],
    suggestion: null,
    explanation: null,
    canNext: false,
    reconfirm: null,
  });
  const q = s.question!;
  const speech = questionSpeech(q.text, q.options);
  void fetchVoice(speech); // prefetch while the host introduces it
  mood("question");
  audio.loop("bed", bedFor(s.ladder[s.level - 1].tier));
  audio.loop("crowd", null);

  if (s.level === s.walkAwayFromLevel) await line("walkAwayUnlocked");
  await line(first ? "firstQuestion" : s.level >= 11 ? "bigQuestion" : "askQuestion");

  setView({ questionVisible: true });
  const reveal = (async () => {
    for (let i = 1; i <= 4; i++) {
      await sleep(get().voice ? 900 : 550);
      setView({ optionsShown: i });
    }
  })();
  if (get().voice) await say(speech, { bubble: false });
  await reveal;
  setView({ host: { ...get().host, visible: false } });

  await act({ type: "begin" });
  startWatch();
}

function suspenseMs(level: number) {
  return 2000 + (level - 1) * 400; // Q1 2 s → Q16 8 s (GDD §7)
}

async function afterJudged(res: PublicState, index: number) {
  stopWatch();
  setView({ reconfirm: null });
  plate(index, "locked");
  mood("locked");
  sfx("lock");
  audio.loop("bed", null, 0.3);
  await line("suspense", { letter: LETTERS[index] });
  mood("suspense");
  audio.loop("bed", "suspense", 0.2);
  await sleep(suspenseMs(res.level));
  audio.loop("bed", null, 0.15);

  if (res.phase === "dcMiss") {
    plate(index, "wrong");
    mood("miss");
    sfx("miss");
    crowd("gasp");
    sfx("gasp");
    await line("doubleChanceMiss");
    plate(index, "eliminated");
    await act({ type: "resume" });
    mood("question");
    audio.loop("bed", bedFor(res.ladder[res.level - 1].tier));
    startWatch();
    return;
  }

  if (res.phase === "revealed") {
    plate(index, "correct");
    mood("correct");
    sfx("correct");
    crowd("cheer");
    sfx("cheer");
    const big = res.level >= 11;
    if (big) setView({ confettiAt: performance.now() });
    await line(big ? "correctBig" : "correct", { coins: formatCoins(res.bankedCoins) });
    setView({ explanation: res.reveal?.explanation ?? null, canNext: true });
    if (res.reveal?.explanation && get().voice) void say(explanationSpeech(res.reveal.explanation), { bubble: false });
    crowd("idle");
    return;
  }

  // over
  await finish(res, index);
}

async function finish(res: PublicState, picked: number | null) {
  stopWatch();
  const r = res.reveal!;
  const over = res.over!;
  if (over.reason === "win") {
    plate(r.correctIndex, "correct");
    mood("jackpot");
    sfx("win");
    crowd("cheer");
    sfx("cheer");
    setView({ confettiAt: performance.now() });
    await line("win");
  } else if (over.reason === "walk") {
    plate(r.correctIndex, "correct");
    mood("walk");
    sfx("walk");
    crowd("clap");
    sfx("applause");
    await line("walkAway", { coins: formatCoins(over.coins) });
  } else {
    if (picked !== null) plate(picked, "wrong");
    plate(r.correctIndex, "correct");
    mood("wrong");
    sfx("wrong");
    crowd("gasp");
    sfx("gasp");
    const answer = { letter: LETTERS[r.correctIndex], option: res.question!.options[r.correctIndex] };
    await line(over.reason === "timeout" ? "timeout" : "wrong", answer);
  }
  setView({ explanation: r.explanation || null });
  try { sessionStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
  await sleep(1200);
  setView({ screen: "over" });
}

// ---------------------------------------------------------------- public actions (UI calls these)
export async function startGame(name: string) {
  audio.init();
  setView({ screen: "loading", error: null });
  try {
    const waitStage = new Promise<void>((resolve) => {
      if (get().stageReady) return resolve();
      const unsub = useGame.subscribe((s) => { if (s.stageReady) { unsub(); resolve(); } });
    });
    const [data] = await Promise.all([
      api<{ state: PublicState; voice: boolean }>("/api/game", { method: "POST", body: JSON.stringify({ name }) }),
      audio.preload(),
      waitStage,
    ]);
    try { sessionStorage.setItem(SESSION_KEY, data.state.id); } catch { /* ignore */ }
    setView({ voice: data.voice });
    sync(data.state);
    setView({ screen: "play", busy: true });
    mood("intro");
    sfx("theme");
    crowd("cheer");
    sfx("cheer");
    await sleep(600);
    await line("intro");
    crowd("idle");
    await presentQuestion(true);
  } catch (e) {
    setView({ screen: "title" });
    toast(e);
  } finally {
    setView({ busy: false });
  }
}

/** Refresh mid-game → continue where the player was (GDD §15). */
export async function resumeIfAny(): Promise<boolean> {
  let id: string | null = null;
  try { id = sessionStorage.getItem(SESSION_KEY); } catch { /* ignore */ }
  if (!id) return false;
  try {
    const { state } = await api<{ state: PublicState }>(`/api/game/${id}`);
    if (state.phase === "over") {
      sessionStorage.removeItem(SESSION_KEY);
      return false;
    }
    sync(state);
    setView({ screen: "play", questionVisible: true, optionsShown: 4, mood: "question" });
    const plates: Plate[] = ["idle", "idle", "idle", "idle"];
    state.question?.eliminated.forEach((i) => (plates[i] = "eliminated"));
    setView({ plates });
    if (state.phase === "reconfirm") await act({ type: "cancel" }).catch(() => undefined);
    if (state.phase === "lifeline" || state.phase === "dcMiss") await act({ type: "resume" }).catch(() => undefined);
    if (get().server?.phase === "revealed") setView({ canNext: true, explanation: get().server?.reveal?.explanation ?? null });
    if (get().server?.phase === "question" && !get().server?.begun) await act({ type: "begin" }).catch(() => undefined);
    startWatch();
    return true;
  } catch {
    try { sessionStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
    return false;
  }
}

export function needsAudioUnlock() {
  return !audio.ctx || audio.ctx.state !== "running";
}

export function unlockAudio() {
  audio.init();
  void audio.preload().then(() => audio.loop("bed", bedFor(get().server?.ladder[(get().server?.level ?? 1) - 1].tier ?? "easy")));
}

export function select(index: number) {
  const s = get();
  if (s.screen !== "play" || s.server?.phase !== "question" || !s.server.begun || s.reconfirm || s.walkConfirm) return;
  if (s.plates[index] === "eliminated") return;
  void withBusy(async () => {
    plate(index, "selected");
    const res = await act({ type: "select", index }).catch((e) => { plate(index, "idle"); throw e; });
    if (res.phase === "reconfirm") {
      setView({ reconfirm: { index, endsAt: performance.now() + (res.reconfirmMs ?? 10_000), totalMs: res.reconfirmMs ?? 10_000 } });
      void line("reconfirm", { letter: LETTERS[index], option: res.question!.options[index] });
      return;
    }
    await afterJudged(res, index); // no cancels left → locked directly
  });
}

export function confirm() {
  const r = get().reconfirm;
  if (!r) return;
  audio.stopVoice();
  void withBusy(async () => {
    const res = await act({ type: "confirm" });
    await afterJudged(res, r.index);
  });
}

export function cancel(auto = false) {
  const r = get().reconfirm;
  if (!r) return;
  audio.stopVoice();
  void withBusy(async () => {
    setView({ reconfirm: null });
    plate(r.index, "idle");
    const res = await act({ type: "cancel" });
    void line(auto ? "reconfirmTimeout" : res.cancelsLeft === 0 ? "finalAnswer" : "cancelled");
  });
}

export function takeLifeline(id: LifelineId) {
  const s = get();
  if (s.screen !== "play" || s.server?.phase !== "question" || !s.server.begun || !s.server.lifelines[id] || s.reconfirm) return;
  void withBusy(async () => {
    const res = await act({ type: "lifeline", id });
    sfx("lifeline");
    if (id === "double") {
      await line("doubleChanceOn");
      return;
    }
    mood("lifeline");
    if (id === "phone") {
      const ms = res.lifelineActive?.id === "phone" ? res.lifelineActive.remainingMs : res.phoneFriendSec * 1000;
      audio.loop("bed", "phoneBed");
      setView({ phone: { endsAt: performance.now() + ms, totalMs: ms } });
      void line("phoneFriend", { next: Math.round(ms / 1000) });
      return; // overlay calls endPhone()
    }
    // askAi
    const sug = res.lifelineActive?.id === "askAi" ? res.lifelineActive.suggestion : 0;
    setView({ suggestion: sug });
    await line("askAi", { letter: LETTERS[sug], option: res.question!.options[sug] });
    await act({ type: "resume" });
    mood("question");
  });
}

export function endPhone() {
  if (!get().phone) return;
  setView({ phone: null });
  void withBusy(async () => {
    const s = get().server!;
    audio.loop("bed", bedFor(s.ladder[s.level - 1].tier));
    await act({ type: "resume" });
    mood("question");
    await line("phoneDone");
  });
}

export function askWalkAway() {
  const s = get();
  if (s.server?.canWalkAway && !s.reconfirm && !s.busy) setView({ walkConfirm: true });
}

export function walkAway(yes: boolean) {
  setView({ walkConfirm: false });
  if (!yes) return;
  void withBusy(async () => {
    const res = await act({ type: "walkAway" });
    await finish(res, null);
  });
}

export function next() {
  if (!get().canNext) return;
  audio.stopVoice();
  void withBusy(async () => {
    setView({ canNext: false });
    await act({ type: "next" });
    await presentQuestion(false);
  });
}

async function onTimeout() {
  await withBusy(async () => {
    const res = await act({ type: "timeout" });
    if (res.phase === "over") await finish(res, null);
    else timeoutSent = false; // server disagreed (clock drift); keep watching
  });
}

export function playAgain() {
  stopWatch();
  audio.stopAll();
  voiceCache.clear();
  frame.mouth = 0;
  const keep = { stageReady: get().stageReady, quality: get().quality, muted: get().muted };
  useGame.setState({ ...initialView(), ...keep });
  audio.loop("bed", "lobby");
}

export function toggleMute() {
  const m = !get().muted;
  audio.setMuted(m);
  setView({ muted: m });
}
