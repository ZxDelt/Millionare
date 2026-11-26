"use client";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useGame } from "../store";
import { askWalkAway, cancel, confirm, next, resumeIfAny, select, takeLifeline, walkAway, endPhone } from "../director";
import TitleScreen from "./TitleScreen";
import Hud from "./Hud";
import { HostBubble, OverScreen, PhoneOverlay, ReconfirmDialog, Toast, WalkConfirm, LoadingScreen, AudioUnlock } from "./Overlays";
import DebugOverlay from "./DebugOverlay";

// three.js is code-split: only the game page downloads it, and never on the server (GDD §14.3).
const Stage = dynamic(() => import("../three/Stage"), { ssr: false });

export default function GameApp() {
  const screen = useGame((s) => s.screen);
  const [debug, setDebug] = useState(false);
  const [resumed, setResumed] = useState(false);

  useEffect(() => {
    setDebug(new URLSearchParams(location.search).has("debug"));
    void resumeIfAny().then(setResumed);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.repeat) return;
      const s = useGame.getState();
      if (s.screen !== "play") return;
      const k = e.key.toLowerCase();
      if (s.walkConfirm) {
        if (k === "y" || k === "enter") walkAway(true);
        if (k === "n" || k === "escape") walkAway(false);
        return;
      }
      if (s.reconfirm) {
        if (k === "y" || k === "enter") confirm();
        if (k === "n" || k === "escape") cancel();
        return;
      }
      if (s.phone) {
        if (k === "enter" || k === "escape") endPhone();
        return;
      }
      const idx = ["a", "b", "c", "d"].indexOf(k);
      const num = ["1", "2", "3", "4"].indexOf(k);
      if (idx >= 0 || num >= 0) select(idx >= 0 ? idx : num);
      else if ((k === "enter" || k === " ") && s.canNext) { e.preventDefault(); next(); }
      else if (k === "w") askWalkAway();
      else if (k === "q") takeLifeline("double");
      else if (k === "p") takeLifeline("phone");
      else if (k === "i") takeLifeline("askAi");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="game-root">
      <Stage />
      {screen === "title" && <TitleScreen />}
      {screen === "loading" && <LoadingScreen />}
      {(screen === "play" || screen === "over") && <Hud />}
      {screen === "play" && (
        <>
          <HostBubble />
          <ReconfirmDialog />
          <PhoneOverlay />
          <WalkConfirm />
        </>
      )}
      {screen === "over" && <OverScreen />}
      {resumed && screen === "play" && <AudioUnlock />}
      <Toast />
      {debug && <DebugOverlay />}
    </div>
  );
}
