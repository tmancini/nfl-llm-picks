/** ESPN CDN team marks — public scoreboard assets. */
const ESPN_LOGO = "https://a.espncdn.com/i/teamlogos/nfl/500";

/** ESPN uses WAS for Washington; our code is WSH. */
const ESPN_ABBREV: Record<string, string> = {
  WSH: "wsh",
};

export function teamLogoUrl(code: string): string {
  const slug = (ESPN_ABBREV[code] ?? code).toLowerCase();
  return `${ESPN_LOGO}/${slug}.png`;
}
