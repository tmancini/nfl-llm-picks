export function consensusWinner(winners: string[]): string | null {
  if (winners.length < 3) return null;
  const counts = new Map<string, number>();
  for (const winner of winners) {
    counts.set(winner, (counts.get(winner) ?? 0) + 1);
  }
  for (const [team, count] of counts) {
    if (count >= 3) return team;
  }
  return null;
}
