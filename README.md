# The Lock Sheet

Public NFL slate: four frontier models each lock one straight-up winner per game. Picks are committed JSON under `data/weeks/`. The site never calls OpenRouter.

Entertainment, not betting advice.

## Models

Pinned OpenRouter slugs (not `:latest`):

- `openai/gpt-6-astra`
- `anthropic/claude-fable-5.1`
- `google/gemini-3.1-pro-preview`
- `x-ai/grok-4.6`

Same prompt for every model. Temperature 0. One call per model. Retry only if the response is unusable JSON.

Each lock builds a shared weekly **context pack** (no betting lines) and sends it to every model:

- Matchup + kickoff (ET)
- Season record (from ESPN scoreboard when present)
- Recent regular-season form (last few completed games: W/L and scores)
- Key injury / inactive notes (ESPN game summary; omitted with a clear note if unavailable)
- Venue + indoor/dome flag; outdoor kickoff weather via Open-Meteo when geocodable

Dry-run context only (no OpenRouter calls): `pnpm lock-week -- --context-only`

## Run locally

```bash
pnpm install
pnpm test
pnpm typecheck
pnpm build
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

Owner-only lock and grade (needs ESPN; OpenRouter for a real lock):

```bash
cp .env.example .env.local
# put OPENROUTER_API_KEY in .env.local
pnpm lock-week
pnpm grade-week
```

`pnpm lock-week` is idempotent. If the week file already has OpenRouter picks, it is left alone.

Without a key, the script writes the ESPN slate with empty picks and prints the lock command. `pnpm lock-week -- --fixture` writes a clearly labeled sample week.

## Data

Locked weeks live under `data/weeks/` (e.g. `2026-w02.json`). `data/current.json` points at the featured week when one exists. The board starts empty until the first official Wednesday lock.

## GitHub Actions

- Wednesday 14:00 UTC (~10:00 ET) — lock
- Nightly 06:00 UTC — grade ESPN finals

Add repository secret `OPENROUTER_API_KEY`. The lock workflow will not call models without it.

## Deploy on Vercel

1. Import this GitHub repo in [Vercel](https://vercel.com/new).
2. Framework preset: Next.js. Build command: `pnpm build`.
3. No browser env vars required — the site only reads committed JSON.
4. Optional: add `OPENROUTER_API_KEY` only if you later run lock from Vercel cron (GitHub Actions is the default).
