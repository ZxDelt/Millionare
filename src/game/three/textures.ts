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
type Px = string | null;
const SKIN = ["#f1c9a0", "#d9a273", "#a86f45", "#7a4a2a", "#e8b88f"];
const HAIR = ["#1b1b1b", "#4a2a12", "#8a5a20", "#d8c060", "#7a2a2a", "#2b2b4a"];
const SHIRT = ["#e23b5a", "#2ec27e", "#3b7bff", "#ffb000", "#9b59ff", "#22c8e0", "#ff6f3c", "#d0d0e0"];

/**
 * Host sprite atlas: 4 frames (mouth closed → wide) of a 24×40 pixel character.
 */
export function hostAtlas(): Texture {
  const W = 24, H = 40;
  const { c, g } = canvas(W * 4, H);
  for (let f = 0; f < 4; f++) {
    const ox = f * W;
    const p = (x: number, y: number, w: number, h: number, col: Px) => { if (col) { g.fillStyle = col; g.fillRect(ox + x, y, w, h); } };
    // hair + head
    p(7, 1, 10, 3, "#1b1b1b");
    p(6, 3, 12, 2, "#1b1b1b");
    p(7, 4, 10, 9, "#e0aa7e");
    p(6, 6, 1, 3, "#e0aa7e"); p(17, 6, 1, 3, "#e0aa7e");
    p(9, 7, 2, 2, "#1b1b1b"); p(13, 7, 2, 2, "#1b1b1b"); // eyes
    p(9, 6, 2, 1, "#1b1b1b"); p(13, 6, 2, 1, "#1b1b1b"); // brows
    // mouth frames
    if (f === 0) p(10, 11, 4, 1, "#7a2a2a");
    if (f === 1) p(10, 10, 4, 2, "#5a1a1a");
    if (f === 2) { p(9, 10, 6, 3, "#5a1a1a"); p(10, 10, 4, 1, "#fff"); }
    if (f === 3) { p(9, 9, 6, 4, "#5a1a1a"); p(10, 9, 4, 1, "#fff"); p(10, 12, 4, 1, "#c44"); }
    // neck, suit, tie
    p(10, 13, 4, 2, "#c89070");
    p(5, 15, 14, 13, "#3a1a7a");
    p(4, 16, 1, 11, "#3a1a7a"); p(19, 16, 1, 11, "#3a1a7a");
    p(10, 15, 4, 3, "#ffffff");
    p(11, 16, 2, 9, "#ffc83d");
    p(7, 17, 1, 1, "#ffc83d"); // pin
    // hands
    p(3, 26, 2, 2, "#e0aa7e"); p(19, 26, 2, 2, "#e0aa7e");
    // legs + shoes
    p(7, 28, 4, 10, "#1a1240"); p(13, 28, 4, 10, "#1a1240");
    p(6, 38, 5, 2, "#0a0a0a"); p(13, 38, 5, 2, "#0a0a0a");
  }
  return tex(c);
}

/** Player sprite atlas: 2 frames (arms down, arms up/cheer). */
export function playerAtlas(): Texture {
  const W = 24, H = 40;
  const { c, g } = canvas(W * 2, H);
  for (let f = 0; f < 2; f++) {
    const ox = f * W;
    const p = (x: number, y: number, w: number, h: number, col: string) => { g.fillStyle = col; g.fillRect(ox + x, y, w, h); };
    p(7, 2, 10, 4, "#4a2a12");
    p(7, 5, 10, 8, "#c88a5a");
    p(6, 5, 1, 4, "#4a2a12"); p(17, 5, 1, 4, "#4a2a12");
    p(9, 8, 2, 2, "#1b1b1b"); p(13, 8, 2, 2, "#1b1b1b");
    p(10, 11, 4, 1, "#6a2a2a");
    p(10, 13, 4, 2, "#b07a50");
    p(5, 15, 14, 12, "#0fa3c0"); // hoodie
    p(9, 15, 6, 2, "#0b7f96");
    p(10, 20, 4, 1, "#ffc83d"); // bolt logo
    p(11, 21, 2, 1, "#ffc83d");
    if (f === 0) { p(3, 16, 2, 10, "#0fa3c0"); p(19, 16, 2, 10, "#0fa3c0"); p(3, 26, 2, 2, "#c88a5a"); p(19, 26, 2, 2, "#c88a5a"); }
    else { p(3, 6, 2, 10, "#0fa3c0"); p(19, 6, 2, 10, "#0fa3c0"); p(3, 4, 2, 2, "#c88a5a"); p(19, 4, 2, 2, "#c88a5a"); }
    p(7, 27, 4, 11, "#25305a"); p(13, 27, 4, 11, "#25305a");
    p(6, 38, 5, 2, "#f0f0f0"); p(13, 38, 5, 2, "#f0f0f0");
  }
  return tex(c);
}

/** Audience atlas: 8 variants × 2 frames (arms down / arms up), 12×20 px each → 192×20. */
export function crowdAtlas(): Texture {
  const W = 12, H = 20;
  const { c, g } = canvas(W * 16, H);
  for (let v = 0; v < 8; v++) {
    const skin = SKIN[(v * 3) % SKIN.length];
    const hair = HAIR[(v * 5) % HAIR.length];
    const shirt = SHIRT[v % SHIRT.length];
    const longHair = v % 3 === 1;
    for (let f = 0; f < 2; f++) {
      const ox = (v * 2 + f) * W;
      const p = (x: number, y: number, w: number, h: number, col: string) => { g.fillStyle = col; g.fillRect(ox + x, y, w, h); };
      p(3, 1, 6, 2, hair);
      p(3, 3, 6, 5, skin);
      if (longHair) { p(2, 2, 1, 7, hair); p(9, 2, 1, 7, hair); }
      p(4, 5, 1, 1, "#111"); p(7, 5, 1, 1, "#111");
      p(2, 9, 8, 7, shirt);
      if (f === 0) { p(1, 10, 1, 5, shirt); p(10, 10, 1, 5, shirt); }
      else { p(1, 3, 1, 6, shirt); p(10, 3, 1, 6, shirt); p(1, 2, 1, 1, skin); p(10, 2, 1, 1, skin); }
      p(3, 16, 2, 4, "#22284a"); p(7, 16, 2, 4, "#22284a");
    }
  }
  return tex(c);
}
