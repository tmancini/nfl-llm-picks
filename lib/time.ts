const ET: Intl.DateTimeFormatOptions = {
  timeZone: "America/New_York",
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
};

export function formatKickoffEt(isoUtc: string): string {
  const date = new Date(isoUtc);
  if (Number.isNaN(date.getTime())) return isoUtc;
  const formatted = new Intl.DateTimeFormat("en-US", ET).format(date);
  return `${formatted} ET`;
}

export function nowIso(): string {
  return new Date().toISOString();
}
