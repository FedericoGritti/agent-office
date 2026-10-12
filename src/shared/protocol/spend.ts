// What a project's OMP sessions have spent, read off OMP's own session records (see
// server/omp-spend.ts): the same numbers `omp stats` sums. OMP counts a request where the cwd of its
// session is: the project's own folder, a worker's worktree under it, and the sub-agents a session
// spawns, which OMP files inside the session that spawned them.

/**
 * Who made the calls: the project's own sessions (you, and the coordinator) or the workers it ran.
 * The advisor runtime works inside the session it annotates, so its calls are that session's.
 */
export type SpendAgent = 'agents' | 'subagents';

/** Token and cost counters, as OMP reports them. */
export interface SpendNumbers {
  tokens: number;
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  /** What these tokens would have cost at API prices: not what a flat plan actually billed. */
  cost: number;
  /** Assistant responses counted. */
  calls: number;
  /** Responses OMP had no price for: the cost is then a floor, not the whole story. */
  unpriced: number;
}

/** A window over a project's sessions (today, or all of them). */
export interface SpendWindow extends SpendNumbers {
  byAgent: Record<SpendAgent, SpendNumbers>;
  /** Keyed by the provider OMP names (`deepseek`, `openai-codex`, …). */
  byProvider: Record<string, SpendNumbers>;
}

/** What one floor's project has spent, and where its session records were read from. */
export interface SpendState {
  /** The floor's project, as the board names it; null while there is none. */
  project: string | null;
  /** The day `today` covers, YYYY-MM-DD on the office's machine. */
  day: string;
  today: SpendWindow;
  total: SpendWindow;
  /** Why there is nothing to show, when there isn't. */
  note?: string;
  /** When the records were last read (ms since epoch); 0 before the first read. */
  at: number;
}

/** Counters with nothing counted yet. */
export function noSpend(): SpendNumbers {
  return { tokens: 0, input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0, calls: 0, unpriced: 0 };
}

/** A window with nothing counted yet. */
export function noWindow(): SpendWindow {
  return { ...noSpend(), byAgent: { agents: noSpend(), subagents: noSpend() }, byProvider: {} };
}

/** A floor with no numbers read yet. */
export const EMPTY_SPEND: SpendState = { project: null, day: '', today: noWindow(), total: noWindow(), at: 0 };

export type SpendClientMsg =
  /** Read the project's OMP session records again now: what the board's button does. */
  | { t: 'spend.refresh' };

export type SpendServerMsg =
  /** The floor's spend: on arriving, and whenever someone presses the button. */
  | { t: 'spend'; state: SpendState };
