import { getCoverage } from "@/lib/questions";
import { getSettings, DEFAULT_SETTINGS } from "@/lib/settings";
import { SESSION_TIER_NEEDS } from "@/lib/constants";
import { cacheStats, voiceStatus } from "@/lib/voice";
import SettingsClient from "./SettingsClient";
import VoicePanel from "./VoicePanel";

export const metadata = { title: "Admin — JOULE JACKPOT" };

export default async function AdminHome() {
  const [cov, settings, voice, cache] = await Promise.all([getCoverage(), getSettings(), voiceStatus(), cacheStats()]);
  const low = (tier: keyof typeof SESSION_TIER_NEEDS) => cov[tier] < SESSION_TIER_NEEDS[tier];
  const tooSmall = cov.active < 16;

  return (
    <>
      <h1>Settings</h1>
      <p className="muted">Active question coverage. One session needs 5 easy, 5 medium and 6 hard (untagged questions fill gaps).</p>
      <div className="stats">
        <Stat k="Easy" v={cov.easy} warn={low("easy")} />
        <Stat k="Medium" v={cov.medium} warn={low("medium")} />
        <Stat k="Hard" v={cov.hard} warn={low("hard")} />
        <Stat k="Untagged" v={cov.untagged} />
        <Stat k="Active / total" v={`${cov.active} / ${cov.total}`} warn={tooSmall} />
      </div>
      {tooSmall && <div className="notice err">Fewer than 16 active questions. The game will refuse to start.</div>}

      <SettingsClient initial={settings} defaults={DEFAULT_SETTINGS} />
      <VoicePanel initialStatus={voice} initialCache={cache} />
    </>
  );
}

function Stat({ k, v, warn }: { k: string; v: number | string; warn?: boolean }) {
  return (
    <div className={`stat${warn ? " warn" : ""}`}>
      <div className="v">{v}</div>
      <div className="k">{k}{warn ? " · too few" : ""}</div>
    </div>
  );
}
