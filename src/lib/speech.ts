/** What the host reads aloud for a question. Shared so admin pre-generation matches the game exactly. */
export function questionSpeech(text: string, options: readonly string[]): string {
  return `${text} ${options.map((o, i) => `${"ABCD"[i]}: ${o}.`).join(" ")}`;
}

export function explanationSpeech(explanation: string): string {
  return explanation.trim();
}

export const formatCoins = (n: number) => n.toLocaleString("en-US");
