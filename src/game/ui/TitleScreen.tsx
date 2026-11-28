"use client";
/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from "react";
import { startGame, toggleMute } from "../director";
import { audio } from "../audio";
import { useGame } from "../store";

export default function TitleScreen() {
  const [name, setName] = useState("");
  const muted = useGame((s) => s.muted);
  const ready = useGame((s) => s.stageReady);

  useEffect(() => {
    try {
      setName(localStorage.getItem("jj_name") ?? "");
      useGame.setState({ muted: localStorage.getItem("jj_muted") === "1" });
    } catch { /* storage blocked */ }
  }, []);

  function go(e: React.FormEvent) {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    try { localStorage.setItem("jj_name", n); } catch { /* ignore */ }
    void startGame(n);
  }

  return (
    <div className="title-overlay">
      <form className="title-card" onSubmit={go}>
        <img src="/brand/logo.svg" alt="JOULE JACKPOT — The Energy Quiz Show" className="title-logo" />
        <p className="tagline">5 questions about energy · 3 lifelines · 1 crore Image Coins</p>
        <label htmlFor="pname" className="sr-only">Your name</label>
        <input
          id="pname"
          className="input name-input"
          placeholder="Enter your name"
          maxLength={20}
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button className="btn btn-primary btn-big" disabled={!name.trim()}>
          Take the hot seat
        </button>
        <div className="title-foot">
          <button type="button" className="link" onClick={() => { audio.init(); toggleMute(); }}>
            {muted ? "🔇 Sound off" : "🔊 Sound on"}
          </button>
          <span className="muted">{ready ? "Studio ready" : "Powering up the studio…"}</span>
          <span className="muted">Keys: A–D pick · Y/N confirm · Q/P/I lifelines</span>
        </div>
      </form>
    </div>
  );
}
