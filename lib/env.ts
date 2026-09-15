import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

function parseEnvFile(contents: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

export function loadLocalEnv(cwd = process.cwd()): void {
  const candidates = [
    path.join(cwd, ".env"),
    path.join(cwd, ".env.local"),
    // Nearby sibling projects — owner machines often keep the key in another app.
    path.join(cwd, "..", "game-watcher", ".env"),
    path.join(cwd, "..", "nfl-betting", ".env"),
    path.join(cwd, "..", "nfl-tape", ".env.local"),
  ];
  for (const filePath of candidates) {
    if (!existsSync(filePath)) continue;
    const parsed = parseEnvFile(readFileSync(filePath, "utf8"));
    for (const [key, value] of Object.entries(parsed)) {
      if (key !== "OPENROUTER_API_KEY") continue;
      if (process.env[key] === undefined) process.env[key] = value;
    }
  }
  // Always prefer local project env for non-key values and overrides.
  for (const filename of [".env", ".env.local"]) {
    const filePath = path.join(cwd, filename);
    if (!existsSync(filePath)) continue;
    const parsed = parseEnvFile(readFileSync(filePath, "utf8"));
    for (const [key, value] of Object.entries(parsed)) {
      if (process.env[key] === undefined) process.env[key] = value;
    }
  }
}

export function getOpenRouterApiKey(): string | undefined {
  const key = process.env.OPENROUTER_API_KEY?.trim();
  return key || undefined;
}
