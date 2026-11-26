/**
 * Audio engine (GDD §12.4, §7.1). Web Audio, all buffers decoded before the show starts.
 * Each cue loads /audio/<cue>.mp3 if present (drop ACE-Step renders there), else a synthesized placeholder.
 * Voice clips go through an AnalyserNode so the host's mouth can follow the volume.
 */
export const CUES = [
  "theme", "lobby", "bedEasy", "bedMedium", "bedHard", "tick", "lock", "suspense", "correct", "wrong",
  "miss", "lifeline", "phoneBed", "walk", "win", "applause", "cheer", "gasp", "murmur",
] as const;
export type Cue = (typeof CUES)[number];
type Bus = "music" | "sfx" | "crowd";

const LOOPS: Partial<Record<Cue, Bus>> = {
  lobby: "music", bedEasy: "music", bedMedium: "music", bedHard: "music", suspense: "music", phoneBed: "music", murmur: "crowd",
};
const BUS: Record<Cue, Bus> = {
  theme: "music", lobby: "music", bedEasy: "music", bedMedium: "music", bedHard: "music", suspense: "music", phoneBed: "music",
  win: "music", walk: "music", tick: "sfx", lock: "sfx", correct: "sfx", wrong: "sfx", miss: "sfx", lifeline: "sfx",
  applause: "crowd", cheer: "crowd", gasp: "crowd", murmur: "crowd",
};

class AudioEngine {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private buses = {} as Record<Bus | "voice", GainNode>;
  private buffers = new Map<Cue, AudioBuffer>();
  private loops = new Map<string, { src: AudioBufferSourceNode; gain: GainNode }>();
  private analyser: AnalyserNode | null = null;
  private wave = new Uint8Array(256);
  private voiceSrc: AudioBufferSourceNode | null = null;
  private loaded: Promise<void> | null = null;
  muted = false;

  /** Must be called from a user gesture (browser autoplay policy). */
  init() {
    if (this.ctx) { void this.ctx.resume(); return; }
    this.ctx = new AudioContext();
    this.master = this.ctx.createGain();
    this.master.connect(this.ctx.destination);
    const vol: Record<Bus | "voice", number> = { music: 0.55, sfx: 0.8, crowd: 0.6, voice: 1 };
    (Object.keys(vol) as (Bus | "voice")[]).forEach((b) => {
      const g = this.ctx!.createGain();
      g.gain.value = vol[b];
      g.connect(this.master);
      this.buses[b] = g;
    });
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 256;
    this.analyser.connect(this.buses.voice);
    try { this.setMuted(localStorage.getItem("jj_muted") === "1"); } catch { /* storage blocked */ }
  }

  preload(): Promise<void> {
    if (!this.ctx) this.init();
    this.loaded ??= Promise.all(CUES.map((c) => this.loadCue(c))).then(() => undefined);
    return this.loaded;
  }

  private async loadCue(c: Cue) {
    try {
      const res = await fetch(`/audio/${c}.mp3`);
      if (res.ok && (res.headers.get("content-type") ?? "").includes("audio")) {
        this.buffers.set(c, await this.ctx!.decodeAudioData(await res.arrayBuffer()));
        return;
      }
    } catch { /* fall through to synth */ }
    this.buffers.set(c, await synth(c, this.ctx!.sampleRate));
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 1, this.ctx.currentTime, 0.05);
    try { localStorage.setItem("jj_muted", m ? "1" : "0"); } catch { /* ignore */ }
  }

  play(c: Cue, gain = 1) {
    const b = this.buffers.get(c);
    if (!this.ctx || !b) return;
    const src = this.ctx.createBufferSource();
    src.buffer = b;
    const g = this.ctx.createGain();
    g.gain.value = gain;
    src.connect(g).connect(this.buses[BUS[c]]);
    src.start();
  }

  /** Start a looping cue in a named slot ("bed", "crowd", ...), crossfading out whatever was there. */
  loop(slot: string, c: Cue | null, fade = 0.6) {
    if (!this.ctx) return;
    const old = this.loops.get(slot);
    const t = this.ctx.currentTime;
    if (old) {
      old.gain.gain.setTargetAtTime(0, t, fade / 3);
      old.src.stop(t + fade * 2);
      this.loops.delete(slot);
    }
    const b = c && this.buffers.get(c);
    if (!b || !c) return;
    const src = this.ctx.createBufferSource();
    src.buffer = b;
    src.loop = true;
    const g = this.ctx.createGain();
    g.gain.value = 0;
    g.gain.setTargetAtTime(1, t, fade / 3);
    src.connect(g).connect(this.buses[LOOPS[c] ?? BUS[c]]);
    src.start();
    this.loops.set(slot, { src, gain: g });
  }

  stopAll() {
    [...this.loops.keys()].forEach((k) => this.loop(k, null, 0.3));
    this.stopVoice();
  }

  /** Plays a voice clip; resolves when it ends (or is stopped). Ducks music meanwhile. */
  async playVoice(data: ArrayBuffer): Promise<void> {
    if (!this.ctx || !this.analyser) return;
    const buf = await this.ctx.decodeAudioData(data.slice(0));
    this.stopVoice();
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.connect(this.analyser);
    this.voiceSrc = src;
    const t = this.ctx.currentTime;
    this.buses.music.gain.setTargetAtTime(0.2, t, 0.1);
    return new Promise((resolve) => {
      src.onended = () => {
        if (this.voiceSrc === src) this.voiceSrc = null;
        if (this.ctx) this.buses.music.gain.setTargetAtTime(0.55, this.ctx.currentTime, 0.3);
        resolve();
      };
      src.start();
    });
  }

  stopVoice() {
    try { this.voiceSrc?.stop(); } catch { /* already stopped */ }
    this.voiceSrc = null;
  }

  /** 0..1 loudness of the voice right now. Allocation-free: safe to call every frame. */
  voiceLevel(): number {
    if (!this.analyser || !this.voiceSrc) return 0;
    this.analyser.getByteTimeDomainData(this.wave);
    let sum = 0;
    for (let i = 0; i < this.wave.length; i++) {
      const v = (this.wave[i] - 128) / 128;
      sum += v * v;
    }
    return Math.min(1, Math.sqrt(sum / this.wave.length) * 4);
  }
}

export const audio = new AudioEngine();

// ---------------------------------------------------------------------------
// Synthesized placeholder cues (rendered once offline). Replace with ACE-Step files in /public/audio.
// ---------------------------------------------------------------------------
const NOTE = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

async function synth(c: Cue, rate: number): Promise<AudioBuffer> {
  const dur: Record<Cue, number> = {
    theme: 4.5, lobby: 4, bedEasy: 4, bedMedium: 3.2, bedHard: 2.4, tick: 0.08, lock: 1.2, suspense: 1.6, correct: 1.8,
    wrong: 1.8, miss: 0.8, lifeline: 1.1, phoneBed: 2, walk: 2.4, win: 5, applause: 3.5, cheer: 3.5, gasp: 1.4, murmur: 4,
  };
  const ctx = new OfflineAudioContext(2, Math.ceil(dur[c] * rate), rate);
  const out = ctx.createGain();
  out.connect(ctx.destination);

  const tone = (freq: number, t: number, d: number, type: OscillatorType = "sine", g = 0.2, attack = 0.01) => {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const e = ctx.createGain();
    e.gain.setValueAtTime(0, t);
    e.gain.linearRampToValueAtTime(g, t + attack);
    e.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(e).connect(out);
    o.start(t);
    o.stop(t + d + 0.05);
    return o;
  };
  const noise = (t: number, d: number, g: number, filter: BiquadFilterType, f: number, q = 1, attack = 0.005) => {
    const len = Math.ceil(d * rate);
    const b = ctx.createBuffer(1, len, rate);
    const ch = b.getChannelData(0);
    for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;
    const s = ctx.createBufferSource();
    s.buffer = b;
    const bq = ctx.createBiquadFilter();
    bq.type = filter;
    bq.frequency.value = f;
    bq.Q.value = q;
    const e = ctx.createGain();
    e.gain.setValueAtTime(0, t);
    e.gain.linearRampToValueAtTime(g, t + attack);
    e.gain.exponentialRampToValueAtTime(0.0001, t + d);
    s.connect(bq).connect(e).connect(out);
    s.start(t);
  };
  const kick = (t: number, g = 0.6) => {
    const o = tone(120, t, 0.35, "sine", g, 0.002);
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.3);
  };
  const claps = (n: number, from: number, to: number, g: number) => {
    for (let i = 0; i < n; i++) noise(from + Math.random() * (to - from), 0.06, g * (0.5 + Math.random() * 0.5), "bandpass", 1200 + Math.random() * 1800, 1.5);
  };
  const pad = (notes: number[], t: number, d: number, g = 0.06) =>
    notes.forEach((n) => { tone(NOTE(n), t, d, "triangle", g, 0.4); tone(NOTE(n) * 1.005, t, d, "sawtooth", g * 0.25, 0.5); });

  switch (c) {
    case "theme": {
      const seq = [60, 64, 67, 72, 67, 72, 76, 79];
      seq.forEach((n, i) => tone(NOTE(n), i * 0.22, 0.5, "sawtooth", 0.08));
      [0, 0.88, 1.76].forEach((t) => kick(t));
      pad([60, 64, 67, 72], 1.9, 2.5, 0.08);
      tone(NOTE(84), 1.9, 2.4, "square", 0.05, 0.05);
      break;
    }
    case "lobby":
      pad([57, 60, 64], 0, 2.1); pad([53, 57, 60], 2, 2.1);
      break;
    case "bedEasy":
      for (let i = 0; i < 8; i++) tone(NOTE([48, 55][i % 2]), i * 0.5, 0.4, "triangle", 0.12);
      pad([60, 64, 67], 0, 4, 0.03);
      break;
    case "bedMedium":
      for (let i = 0; i < 8; i++) tone(NOTE([45, 52, 45, 50][i % 4]), i * 0.4, 0.3, "sawtooth", 0.08);
      pad([57, 60, 64], 0, 3.2, 0.03);
      break;
    case "bedHard":
      for (let i = 0; i < 8; i++) tone(NOTE([40, 40, 41, 40][i % 4]), i * 0.3, 0.25, "sawtooth", 0.1);
      tone(NOTE(76), 0, 2.4, "sine", 0.02, 1);
      tone(NOTE(77), 0, 2.4, "sine", 0.02, 1);
      break;
    case "tick":
      noise(0, 0.05, 0.4, "highpass", 3000, 1, 0.001);
      break;
    case "lock":
      kick(0, 0.8);
      [48, 55, 60, 63].forEach((n) => tone(NOTE(n), 0, 1.1, "sawtooth", 0.07, 0.005));
      break;
    case "suspense":
      kick(0, 0.7); kick(0.22, 0.45);
      tone(NOTE(36), 0, 1.6, "sine", 0.12, 0.2);
      break;
    case "correct":
      [72, 76, 79, 84].forEach((n, i) => tone(NOTE(n), i * 0.09, 1.2, "square", 0.07));
      [60, 64, 67].forEach((n) => tone(NOTE(n), 0.3, 1.4, "triangle", 0.08));
      break;
    case "wrong": {
      const o = tone(NOTE(52), 0, 1.6, "sawtooth", 0.16);
      o.frequency.linearRampToValueAtTime(NOTE(40), 1.5);
      tone(NOTE(53), 0, 1.6, "sawtooth", 0.1);
      break;
    }
    case "miss":
      tone(NOTE(64), 0, 0.3, "square", 0.08); tone(NOTE(58), 0.25, 0.5, "square", 0.08);
      break;
    case "lifeline": {
      const o = tone(300, 0, 1, "sine", 0.15, 0.05);
      o.frequency.exponentialRampToValueAtTime(1400, 0.9);
      noise(0, 1, 0.05, "bandpass", 2000, 0.7, 0.3);
      break;
    }
    case "phoneBed":
      [0, 0.5, 1, 1.5].forEach((t) => noise(t, 0.04, 0.3, "highpass", 2500, 1, 0.001));
      pad([50, 57], 0, 2, 0.03);
      break;
    case "walk":
      pad([60, 64, 67, 71], 0, 2.3, 0.08);
      break;
    case "win": {
      const fan = [67, 67, 67, 72, 76, 79, 84];
      const at = [0, 0.18, 0.36, 0.6, 1, 1.4, 1.9];
      fan.forEach((n, i) => { tone(NOTE(n), at[i], 0.7, "sawtooth", 0.09); tone(NOTE(n - 12), at[i], 0.7, "square", 0.05); });
      pad([60, 64, 67, 72, 76], 1.9, 3, 0.07);
      [0, 0.6, 1, 1.4, 1.9].forEach((t) => kick(t));
      break;
    }
    case "applause":
      claps(260, 0, 3.1, 0.25);
      break;
    case "cheer":
      claps(320, 0, 3.2, 0.25);
      noise(0, 3.4, 0.12, "bandpass", 900, 0.6, 0.5);
      break;
    case "gasp":
      noise(0, 1.3, 0.3, "bandpass", 1500, 0.8, 0.15);
      noise(0, 1.3, 0.12, "lowpass", 500, 0.5, 0.2);
      break;
    case "murmur":
      for (let i = 0; i < 10; i++) noise(i * 0.4, 0.8, 0.05, "bandpass", 300 + Math.random() * 300, 2, 0.3);
      break;
  }
  return ctx.startRendering();
}
