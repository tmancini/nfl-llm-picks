# NFLLM

Public NFL slate: four frontier models each lock one straight-up winner per game. Picks are committed JSON under `data/weeks/`. The site never calls OpenRouter.

Entertainment, not betting advice.

## Models

Pinned OpenRouter slugs (not `:latest`):

- `openai/gpt-6-astra`
- `anthropic/claude-opus-5.5`
- `google/gemini-3.1-pro-preview`
- `x-ai/grok-4.7`

The slugs are the current flagship text models as checked against the [OpenRouter catalogue](https://openrouter.ai/models) on 2026-09-22. OpenAI's newer Sol and Luna releases are lower tiers than Astra; Google's newer Flash releases are lower tiers than Pro. Each week's JSON keeps the exact model IDs used for its picks, while season totals group successive models by provider.

The board puts weekly and season records above the game picks. **Share for X** prepares a 1200×1200 PNG with the full week's picks and results; browsers with file sharing can send it through the native share sheet, while desktop browsers offer a preview, copy-image button, and download. The season chart shows cumulative accuracy by provider as graded weeks accumulate.

Same accuracy-first prompt for every model. One call per model. Retry only if the response is unusable JSON. Each model can use capped live web search for current reporting. The prompt treats market odds as a prior, asks models to check for material updates, and never forces upsets for variety. Provider routing requires support for the requested search and structured-output parameters.

Each lock builds a shared weekly **context pack** and sends it to every model:

- Matchup + kickoff (ET)
- Season record (from ESPN scoreboard when present)
- Recent regular-season form (last few completed games: W/L and scores)
- Key injury / inactive notes (ESPN game summary; omitted with a clear note if unavailable)
- Venue + indoor/dome flag; outdoor kickoff weather via Open-Meteo when geocodable
- DraftKings moneyline and spread via ESPN, with the snapshot fetch time (when available)

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
# put the dedicated, daily-capped OPENROUTER_API_KEY in .env.local
ENABLE_PAID_PICKS=1 pnpm lock-week
pnpm grade-week
```

`pnpm lock-week` is idempotent. If the week file already has OpenRouter picks, it is left alone.

Paid picks are off locally by default. Without `ENABLE_PAID_PICKS=1`, the script writes the ESPN slate with empty picks and prints the lock command. With paid picks enabled, a missing key or a key without a daily spending limit of $1 or less fails before any model call. `pnpm lock-week -- --fixture` writes a clearly labeled sample week.

## Data

Locked weeks live under `data/weeks/` (e.g. `2026-w02.json`). `data/current.json` points at the featured week when one exists. The board starts empty until the first official Wednesday lock.

## GitHub Actions

- Wednesday 14:00 UTC (10:00 ET during daylight saving time) — lock the new week
- Nightly 06:00 UTC — grade ESPN finals, including Monday night; completed weeks are idempotent

The lock workflow sets `ENABLE_PAID_PICKS=1` and uses the repository secret `OPENROUTER_API_KEY`. Its NFLLM OpenRouter key has a $1 daily limit and a $5 monthly guardrail allowing only the four pinned models. The code caps each lock at eight completion requests (four models, at most one retry each). Each request offers OpenRouter's Exa web search server tool, capped at two results per query, six results total, and low context size. At the [documented $0.005 per search request](https://openrouter.ai/docs/guides/features/server-tools/web-search), search is charged in addition to model tokens and remains subject to the daily key limit. The public site makes no paid API calls. If the key or limit is missing, the scheduled lock fails rather than publishing an empty pick sheet. Keep the key in GitHub Actions secrets, never in Vercel or the browser.

## Deploy on Vercel

1. Import this GitHub repo in [Vercel](https://vercel.com/new).
2. Framework preset: Next.js. Build command: `pnpm build`.
3. No browser env vars required — the site only reads committed JSON.
4. Optional: add `OPENROUTER_API_KEY` only if you later run lock from Vercel cron (GitHub Actions is the default).
