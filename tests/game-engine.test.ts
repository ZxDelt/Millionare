import { test } from "node:test";
import assert from "node:assert/strict";
import { apply, newSession, toPublic, GameError, GRACE_MS, type QuestionSnap } from "../src/lib/game-engine";
import { DEFAULT_SETTINGS } from "../src/lib/defaults";

const Q = (id: number, correctIndex = 0): QuestionSnap => ({
  id, text: `Q${id}`, options: ["a", "b", "c", "d"], correctIndex, explanation: "because",
});
const T0 = 1_000_000;
const start = () => {
  const s = newSession("x".repeat(32), "Ana", structuredClone(DEFAULT_SETTINGS), Q(1, 2), T0);
  apply(s, { type: "begin" }, T0);
  return s;
};

test("public state never leaks the correct answer before reveal", () => {
  const s = start();
  const p = toPublic(s, T0);
  assert.equal(p.reveal, null);
  assert.ok(!JSON.stringify(p).includes("correctIndex"));
});

test("select pauses timer and asks to reconfirm; confirm correct banks coins", () => {
  const s = start();
  apply(s, { type: "select", index: 2 }, T0 + 5000);
  assert.equal(s.phase, "reconfirm");
  assert.equal(toPublic(s, T0 + 20000).timer.running, false);
  assert.equal(toPublic(s, T0 + 20000).timer.remainingMs, 40000); // paused at 40 s
  apply(s, { type: "confirm" }, T0 + 6000);
  assert.equal(s.phase, "revealed");
  assert.equal(s.bankedCoins, 50_000);
});

test("wrong answer = game over with 0 coins", () => {
  const s = start();
  apply(s, { type: "select", index: 2 }, T0); apply(s, { type: "confirm" }, T0);
  apply(s, { type: "next" }, T0, { nextQ: Q(2, 0) }); apply(s, { type: "begin" }, T0);
  apply(s, { type: "select", index: 1 }, T0); apply(s, { type: "confirm" }, T0);
  assert.equal(s.phase, "over");
  assert.deepEqual(s.over, { reason: "wrong", coins: 0 });
  assert.equal(toPublic(s, T0).reveal?.correctIndex, 0);
});

test("one cancel allowed, then next pick locks directly", () => {
  const s = start();
  apply(s, { type: "select", index: 0 }, T0);
  apply(s, { type: "cancel" }, T0 + 1000);
  assert.equal(s.phase, "question");
  apply(s, { type: "select", index: 2 }, T0 + 2000);
  assert.equal(s.phase, "revealed"); // no reconfirm
});

test("reconfirm auto-cancels after its limit and counts as a cancel", () => {
  const s = start();
  apply(s, { type: "select", index: 0 }, T0);
  apply(s, { type: "lifeline", id: "double" }, T0 + 10_000 + GRACE_MS + 1); // tick cancels first, then lifeline ok
  assert.equal(s.cancels, 1);
  assert.equal(s.doubleActive, true);
});

test("question timer expiry = timeout, 0 coins", () => {
  const s = start();
  apply(s, { type: "timeout" }, T0 + 45_000);
  assert.deepEqual(s.over, { reason: "timeout", coins: 0 });
});

test("early client timeout claim is ignored", () => {
  const s = start();
  apply(s, { type: "timeout" }, T0 + 10_000);
  assert.equal(s.phase, "question");
});

test("double chance: first miss forgiven, plate eliminated, lifeline gone even if first pick right", () => {
  const s = start();
  apply(s, { type: "lifeline", id: "double" }, T0);
  apply(s, { type: "select", index: 0 }, T0); apply(s, { type: "confirm" }, T0);
  assert.equal(s.phase, "dcMiss");
  assert.deepEqual(s.eliminated, [0]);
  assert.equal(toPublic(s, T0 + 60_000).timer.running, false); // paused during announcement
  apply(s, { type: "resume" }, T0 + 3000);
  assert.throws(() => apply(s, { type: "select", index: 0 }, T0 + 3000), GameError);
  apply(s, { type: "select", index: 1 }, T0 + 3000); apply(s, { type: "confirm" }, T0 + 3000);
  assert.equal(s.phase, "over"); // second miss ends it
  assert.equal(toPublic(s, T0).lifelines.double, false);

  const s2 = start();
  apply(s2, { type: "lifeline", id: "double" }, T0);
  apply(s2, { type: "select", index: 2 }, T0); apply(s2, { type: "confirm" }, T0);
  assert.equal(s2.phase, "revealed");
  assert.equal(toPublic(s2, T0).lifelines.double, false);
});

test("ask the AI respects odds and pauses the timer", () => {
  const right = start();
  apply(right, { type: "lifeline", id: "askAi" }, T0, { rng: () => 0.1 }); // 10 < 50 → correct
  assert.deepEqual(right.lifelineActive, { id: "askAi", suggestion: 2 });
  assert.equal(right.runningSince, null);
  const wrong = start();
  apply(wrong, { type: "lifeline", id: "askAi" }, T0, { rng: () => 0.9 });
  assert.notEqual((wrong.lifelineActive as { suggestion: number }).suggestion, 2);
});

test("lifeline can only be used once", () => {
  const s = start();
  apply(s, { type: "lifeline", id: "phone" }, T0);
  apply(s, { type: "resume" }, T0 + 60_000);
  assert.throws(() => apply(s, { type: "lifeline", id: "phone" }, T0 + 60_000), GameError);
});

test("walking away is off by default; every question is timed", () => {
  const s = start();
  let t = T0;
  for (let lvl = 1; lvl <= 5; lvl++) {
    assert.equal(s.level, lvl);
    assert.equal(s.timed, true);
    assert.throws(() => apply(s, { type: "walkAway" }, t), GameError);
    apply(s, { type: "select", index: s.q.correctIndex }, t);
    if (s.phase === "reconfirm") apply(s, { type: "confirm" }, t);
    if (lvl < 5) { apply(s, { type: "next" }, t, { nextQ: Q(lvl + 1, 1) }); apply(s, { type: "begin" }, t); }
    t += 1000;
  }
  assert.equal(s.over?.reason, "win");
});

test("the last question is timed too", () => {
  const s = start();
  for (let lvl = 1; lvl < 5; lvl++) {
    apply(s, { type: "select", index: s.q.correctIndex }, T0);
    if (s.phase === "reconfirm") apply(s, { type: "confirm" }, T0);
    apply(s, { type: "next" }, T0, { nextQ: Q(lvl + 1, 1) }); apply(s, { type: "begin" }, T0);
  }
  assert.equal(s.level, 5);
  assert.equal(s.timed, true);
});

test("answering all 5 wins the jackpot of 1 crore", () => {
  const s = start();
  for (let lvl = 1; lvl <= 5; lvl++) {
    apply(s, { type: "select", index: s.q.correctIndex }, T0);
    apply(s, { type: "confirm" }, T0);
    if (lvl < 5) apply(s, { type: "next" }, T0, { nextQ: Q(lvl + 1, lvl % 4) }); apply(s, { type: "begin" }, T0);
  }
  assert.deepEqual(s.over, { reason: "win", coins: 10_000_000 });
});

test("timer does not run until begin; server auto-starts it after READ_MS", async () => {
  const { READ_MS } = await import("../src/lib/game-engine");
  const s = newSession("y".repeat(32), "Bo", structuredClone(DEFAULT_SETTINGS), Q(1, 0), T0);
  assert.throws(() => apply(s, { type: "select", index: 0 }, T0 + 1000), GameError);
  assert.equal(toPublic(s, T0 + 20_000).timer.remainingMs, 45_000);
  apply(s, { type: "timeout" }, T0 + READ_MS + 45_000); // auto-started at READ_MS, so this is a real timeout
  assert.equal(s.over?.reason, "timeout");
});
