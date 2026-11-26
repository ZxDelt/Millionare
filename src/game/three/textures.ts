import { CanvasTexture, NearestFilter, RepeatWrapping, SRGBColorSpace, type Texture } from "three";

/**
 * Procedural pixel-art textures. Everything is drawn into small canvases at load time:
 * no image downloads, crisp pixels via NearestFilter.
 */
function tex(c: HTMLCanvasElement, repeat = false): CanvasTexture {
  const t = new CanvasTexture(c);
  t.magFilter = NearestFilter;
  t.minFilter = NearestFilter;
  t.generateMipmaps = false;
  t.colorSpace = SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = RepeatWrapping;
  return t;
}

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d")!;
  g.imageSmoothingEnabled = false;
  return { c, g };
}

/** Hexagon floor tiles (solar-panel look). */
export function floorTexture(): Texture {
  const { c, g } = canvas(128, 128);
  g.fillStyle = "#0a0f35";
  g.fillRect(0, 0, 128, 128);
  for (let y = 0; y < 128; y += 16) {
    for (let x = 0; x < 128; x += 16) {
      const on = (x * 7 + y * 13) % 5 === 0;
      g.fillStyle = on ? "#1d2f8a" : "#121a52";
      g.fillRect(x + 1, y + 1, 14, 14);
      g.fillStyle = "#22346e";
      g.fillRect(x + 1, y + 7, 14, 1);
      g.fillRect(x + 7, y + 1, 1, 14);
    }
  }
  const t = tex(c, true);
  t.repeat.set(4, 4);
  return t;
}

/** LED wall: vertical bars + soft vertical gradient. */
export function backdropTexture(): Texture {
  const { c, g } = canvas(256, 64);
  const grad = g.createLinearGradient(0, 0, 0, 64);
  grad.addColorStop(0, "#1a0a40");
  grad.addColorStop(1, "#06081e");
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 64);
  for (let x = 0; x < 256; x += 4) {
    const h = 20 + Math.round(Math.abs(Math.sin(x * 0.11)) * 30);
    g.fillStyle = x % 8 === 0 ? "#2a3fb0" : "#1a2780";
    g.fillRect(x, 64 - h, 2, h);
  }
  return tex(c, true);
}

/** Logo plate from the SVG brand file (drawn into a canvas so it has a fixed size). */
export async function logoTexture(): Promise<Texture> {
  const img = new Image();
  img.src = "/brand/logo.svg";
  await img.decode();
  const { c, g } = canvas(400, 210);
  g.imageSmoothingEnabled = true;
  g.drawImage(img, 0, 0, 400, 210);
  return tex(c);
}

// ---------------------------------------------------------------- characters
type Paint = (x: number, y: number, w: number, h: number, col: string) => void;
const SKIN = ["#f1c9a0", "#d9a273", "#a86f45", "#7a4a2a", "#e8b88f", "#c48a60"];
const HAIR = ["#1b1b1b", "#4a2a12", "#8a5a20", "#d8c060", "#7a2a2a", "#2b2b4a", "#b0b0b8"];
const SHIRT = ["#e23b5a", "#2ec27e", "#3b7bff", "#ffb000", "#9b59ff", "#22c8e0", "#ff6f3c", "#d0d0e0", "#3fbf9f", "#c03fa0", "#f5e04a", "#5a6aff"];

function painter(g: CanvasRenderingContext2D, ox: number, oy: number): Paint {
  return (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(ox + x, oy + y, w, h); };
}

/**
 * Seated character frames are 24×40 px. Hips sit at row 28, i.e. 12 px (0.6 world units) above the
 * feet, which is exactly the chair's cushion height, so the sprite rests on the seat instead of in it.
 * Row 0 of every atlas = eyes open, row 1 = blink.
 */
function seatedLegs(p: Paint, pants: string, shoes: string) {
  p(6, 27, 12, 3, pants); // lap: thighs pointing at the camera
  p(6, 27, 12, 1, "rgba(255,255,255,.12)");
  p(7, 30, 4, 7, pants);
  p(13, 30, 4, 7, pants);
  p(6, 37, 5, 2, shoes);
  p(13, 37, 5, 2, shoes);
}

/** Eyes + brows. look: 0 camera, +1 / -1 = down toward a monitor on that side. */
function eyes(p: Paint, look: number, blink: boolean, lid: string) {
  const dx = look;
  if (blink) { p(9 + dx, 8, 2, 1, lid); p(13 + dx, 8, 2, 1, lid); }
  else if (look === 0) {
    p(9, 7, 2, 2, "#1b1b1b"); p(13, 7, 2, 2, "#1b1b1b");
    p(9, 7, 1, 1, "#ffffff"); p(13, 7, 1, 1, "#ffffff");
  } else {
    p(9 + dx, 8, 2, 1, "#1b1b1b"); p(13 + dx, 8, 2, 1, "#1b1b1b"); // lowered gaze
    p(9 + dx, 7, 2, 1, lid); p(13 + dx, 7, 2, 1, lid);
  }
  p(9 + dx, 6, 2, 1, "#1b1b1b"); p(13 + dx, 6, 2, 1, "#1b1b1b");
}

/** Host atlas: 8 columns = gaze (camera, monitor) × 4 mouth shapes; 2 rows (open, blink). */
export function hostAtlas(): Texture {
  const W = 24, H = 40;
  const { c, g } = canvas(W * 8, H * 2);
  const skin = "#e0aa7e", suit = "#3a1a7a";
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 8; col++) {
      const p = painter(g, col * W, row * H);
      const look = col >= 4 ? 1 : 0;
      const m = col % 4;
      const dx = look;
      // hair + head
      p(7, 1, 10, 3, "#1b1b1b"); p(6, 3, 12, 2, "#1b1b1b");
      p(7, 4, 10, 9, skin);
      p(6, 6, 1, 3, skin); p(17, 6, 1, 3, skin);
      p(7, 4, 1, 2, "#1b1b1b"); p(16, 4, 1, 2, "#1b1b1b"); // sideburns
      eyes(p, look, row === 1, "#b07a55");
      if (m === 0) p(10 + dx, 11, 4, 1, "#7a2a2a");
      if (m === 1) p(10 + dx, 10, 4, 2, "#5a1a1a");
      if (m === 2) { p(9 + dx, 10, 6, 3, "#5a1a1a"); p(10 + dx, 10, 4, 1, "#fff"); }
      if (m === 3) { p(9 + dx, 9, 6, 4, "#5a1a1a"); p(10 + dx, 9, 4, 1, "#fff"); p(10 + dx, 12, 4, 1, "#c44"); }
      // neck, suit with lapels, shirt, tie, pin
      p(10, 13, 4, 2, "#c89070");
      p(5, 15, 14, 12, suit);
      p(9, 15, 1, 7, "#24104e"); p(14, 15, 1, 7, "#24104e");
      p(10, 15, 4, 3, "#ffffff");
      p(11, 16, 2, 8, "#ffc83d");
      p(7, 17, 1, 1, "#ffc83d");
      p(5, 26, 14, 1, "#24104e"); // belt line
      // arms resting, right hand holds cue cards
      p(4, 16, 2, 10, suit); p(18, 16, 2, 10, suit);
      p(5, 26, 3, 2, skin); p(16, 26, 3, 2, skin);
      p(2, 22, 4, 5, "#f4f4ff"); p(2, 22, 4, 1, "#22e1ff");
      seatedLegs(p, "#1a1240", "#0a0a0a");
    }
  }
  return tex(c);
}

/**
 * Player atlas: 5 columns × 2 rows (open, blink).
 * 0 rest (camera) · 1 cheer · 2 reading the monitor · 3 thinking, hand on chin · 4 talking (camera).
 */
export function playerAtlas(): Texture {
  const W = 24, H = 40;
  const { c, g } = canvas(W * 5, H * 2);
  const skin = "#c88a5a", hood = "#0fa3c0", hoodDark = "#0b7f96";
  for (let row = 0; row < 2; row++) {
    for (let f = 0; f < 5; f++) {
      const p = painter(g, f * W, row * H);
      const look = f === 2 || f === 3 ? -1 : 0;
      const dx = look;
      p(7, 2, 10, 4, "#4a2a12"); p(6, 3, 1, 5, "#4a2a12"); p(17, 3, 1, 5, "#4a2a12");
      p(7, 5, 10, 8, skin);
      p(7, 5, 10, 1, "#4a2a12"); // fringe
      eyes(p, look, row === 1, "#9a6a40");
      if (f === 1) { p(9, 10, 6, 2, "#4a1010"); p(10, 10, 4, 1, "#fff"); }
      else if (f === 4) p(10, 10, 4, 2, "#4a1010");
      else if (f === 3) p(11 + dx, 11, 3, 1, "#6a2a2a");
      else p(10 + dx, 11, 4, 1, "#6a2a2a");
      p(10, 13, 4, 2, "#b07a50");
      p(5, 15, 14, 12, hood);
      p(9, 15, 6, 2, hoodDark);
      p(9, 17, 1, 3, "#e8f8ff"); p(14, 17, 1, 3, "#e8f8ff"); // drawstrings
      p(11, 20, 3, 1, "#ffc83d"); p(10, 21, 2, 1, "#ffc83d"); p(11, 22, 1, 1, "#ffc83d"); // bolt
      p(6, 24, 12, 2, hoodDark); // pocket
      if (f === 1) {
        p(3, 5, 2, 11, hood); p(19, 5, 2, 11, hood);
        p(3, 3, 2, 2, skin); p(19, 3, 2, 2, skin);
      } else if (f === 3) {
        p(3, 16, 2, 10, hood); p(5, 26, 3, 2, skin);
        p(19, 16, 2, 5, hood); p(17, 19, 2, 3, hood); p(15, 14, 2, 6, hood);
        p(13, 12, 3, 2, skin);
      } else {
        p(3, 16, 2, 10, hood); p(19, 16, 2, 10, hood);
        p(5, 26, 3, 2, skin); p(16, 26, 3, 2, skin);
      }
      seatedLegs(p, "#25305a", "#f0f0f0");
    }
  }
  return tex(c);
}

export const CROWD_VARIANTS = 12;

/** Audience atlas: 12 variants × 2 frames (arms down / up), 12×20 px each, drawn seated. */
export function crowdAtlas(): Texture {
  const W = 12, H = 20;
  const { c, g } = canvas(W * CROWD_VARIANTS * 2, H);
  for (let v = 0; v < CROWD_VARIANTS; v++) {
    const skin = SKIN[(v * 5) % SKIN.length];
    const hair = HAIR[(v * 3) % HAIR.length];
    const shirt = SHIRT[v];
    const longHair = v % 3 === 1;
    const glasses = v % 4 === 2;
    const cap = v % 5 === 3;
    const glow = v % 3 === 0;
    for (let f = 0; f < 2; f++) {
      const p = painter(g, (v * 2 + f) * W, 0);
      p(3, 1, 6, 2, hair);
      p(3, 3, 6, 5, skin);
      if (longHair) { p(2, 2, 1, 7, hair); p(9, 2, 1, 7, hair); }
      p(4, 5, 1, 1, "#111"); p(7, 5, 1, 1, "#111");
      if (glasses) { p(3, 5, 6, 1, "#222"); p(4, 5, 1, 1, "#9fefff"); p(7, 5, 1, 1, "#9fefff"); }
      if (cap) { p(2, 1, 8, 2, SHIRT[(v + 4) % SHIRT.length]); p(8, 2, 3, 1, SHIRT[(v + 4) % SHIRT.length]); }
      p(5, 7, 2, 1, "#8a3a3a");
      p(2, 8, 8, 7, shirt);
      p(5, 8, 2, 1, skin);
      if (f === 0) { p(1, 9, 1, 5, shirt); p(10, 9, 1, 5, shirt); p(2, 14, 1, 1, skin); p(9, 14, 1, 1, skin); }
      else {
        p(1, 3, 1, 6, shirt); p(10, 3, 1, 6, shirt); p(1, 2, 1, 1, skin); p(10, 2, 1, 1, skin);
        if (glow) p(10, 0, 1, 2, "#7dffef");
      }
      p(2, 15, 8, 2, "#22284a"); // lap
      p(3, 17, 2, 2, "#22284a"); p(7, 17, 2, 2, "#22284a");
      p(3, 19, 2, 1, "#0c0c18"); p(7, 19, 2, 1, "#0c0c18");
    }
  }
  return tex(c);
}

/** A small canvas texture the scene redraws on state changes (desk monitors, jumbotron). */
export function liveCanvas(w: number, h: number) {
  const { c, g } = canvas(w, h);
  return { c, g, t: tex(c) };
}
