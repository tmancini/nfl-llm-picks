/** ESPN CDN team marks — public scoreboard assets. */
const ESPN_LOGO = "https://a.espncdn.com/i/teamlogos/nfl/500";

/** ESPN uses WAS for Washington; our code is WSH. */
const ESPN_ABBREV: Record<string, string> = {
  WSH: "wsh",
};

/** Local vendor marks for the week-board header (dark-header friendly). */
const MODEL_LOGOS: Record<string, string> = {
  "openai/gpt-6-astra": "/models/openai.svg",
  "anthropic/claude-fable-5.1": "/models/anthropic.svg",
  "google/gemini-3.1-pro-preview": "/models/gemini.svg",
  "x-ai/grok-4.6": "/models/grok.svg",
};

export function teamLogoUrl(code: string): string {
  const slug = (ESPN_ABBREV[code] ?? code).toLowerCase();
  return `${ESPN_LOGO}/${slug}.png`;
}

export function modelLogoUrl(modelId: string): string | null {
  return MODEL_LOGOS[modelId] ?? null;
}
