export type CliArgs = {
  season?: number;
  week?: number;
  force?: boolean;
  fixture?: boolean;
  contextOnly?: boolean;
};

export function parseCliArgs(argv: string[]): CliArgs {
  const args: CliArgs = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    const next = argv[i + 1];
    if (token === "--season" && next) {
      args.season = Number(next);
      i += 1;
    } else if (token === "--week" && next) {
      args.week = Number(next);
      i += 1;
    } else if (token === "--force") {
      args.force = true;
    } else if (token === "--fixture") {
      args.fixture = true;
    } else if (token === "--context-only") {
      args.contextOnly = true;
    }
  }
  if (args.season !== undefined && !Number.isInteger(args.season)) {
    throw new Error("Invalid --season");
  }
  if (args.week !== undefined && (!Number.isInteger(args.week) || args.week < 1)) {
    throw new Error("Invalid --week");
  }
  return args;
}
