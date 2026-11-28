/** What the host reads aloud for a question. Shared so admin pre-generation matches the game exactly. */
export function questionSpeech(text: string, options: readonly string[]): string {
  return `${text} ${options.map((o, i) => `${"ABCD"[i]}: ${o}.`).join(" ")}`;
}

export function explanationSpeech(explanation: string): string {
  return explanation.trim();
}

/** Indian digit grouping: 1,00,00,000. */
export const formatCoins = (n: number) => n.toLocaleString("en-IN");

/** Spoken/written-out amount for host lines: "50 thousand", "2.5 lakh", "1 crore". */
export function coinWords(n: number): string {
  const fmt = (v: number) => String(Math.round(v * 100) / 100);
  if (n >= 1e7) return `${fmt(n / 1e7)} crore`;
  if (n >= 1e5) return `${fmt(n / 1e5)} lakh`;
  if (n >= 1e3) return `${fmt(n / 1e3)} thousand`;
  return String(n);
}
