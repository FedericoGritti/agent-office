// OMP's own session records: where a desk's conversation is, and what it spent (see providers/omp.ts).
// These files are OMP's, not the office's: the same ones a terminal `omp --resume` opens and the ones
// `omp stats` sums. OMP logs one record per assistant response, so totals accumulate as the file grows;
// a scan replaces a worker's numbers from the file rather than adding to them, so reading a file again
// after an office restart cannot double count.
import { closeSync, constants, existsSync, mkdirSync, openSync, readdirSync, readFileSync, readSync, realpathSync, renameSync, rmdirSync, statSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import path from 'node:path';
import type { Usage } from '../shared/protocol.js';
import { WORKTREES_DIR } from './worktrees.js';

/** How much of a session file one read takes at a time. */
const CHUNK = 4 * 1024 * 1024;

/** The most of a session file looked at to find the folder it ran in. */
const HEAD = 256 * 1024;

/** An OMP session id, as OMP itself names one (it goes back on the command line as --resume). */
const SESSION_ID = /^[A-Za-z0-9._-]{1,160}$/;

/** Where OMP keeps everything for a run: $PI_CODING_AGENT_DIR, or ~/.omp/agent (see `omp --help`). */
export function ompAgentDir(cwd: string, env: NodeJS.ProcessEnv): string {
  return path.resolve(cwd, env.PI_CODING_AGENT_DIR || path.join(env.HOME || homedir(), '.omp', 'agent'));
}

/** The session file OMP wrote for `sessionId` in one folder (a project's, or a desk's own). */
export function ompSessionFileIn(dir: string, sessionId: string): string | undefined {
  if (!SESSION_ID.test(sessionId)) return undefined;
  try {
    const name = readdirSync(dir).find((entry) => entry.endsWith(`_${sessionId}.jsonl`));
    return name ? path.join(dir, name) : undefined;
  } catch {
    return undefined;
  }
}

/** The session file OMP wrote for `sessionId`, looked for in each project folder of a sessions tree. */
export function ompSessionFile(sessionsDir: string, sessionId: string): string | undefined {
  if (!SESSION_ID.test(sessionId)) return undefined;
  let folders: string[];
  try {
    folders = readdirSync(sessionsDir, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  } catch {
    return undefined;
  }
  for (const folder of folders) {
    const file = ompSessionFileIn(path.join(sessionsDir, folder), sessionId);
    if (file) return file;
  }
  return undefined;
}

/** A path with symlinks resolved where it exists: how OMP reads a folder before naming or comparing it. */
function canonical(p: string): string {
  try {
    return realpathSync.native(p);
  } catch {
    return path.resolve(p);
  }
}

/** Whether `p` is `root` itself or under it, comparing where both really are (OMP's isRelativeWithin). */
function isWithin(root: string, p: string): boolean {
  const rel = path.relative(root, p);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

/** `prefix` and the rest of a path as OMP writes them into one directory name: separators and colons become dashes. */
function encodeDirName(prefix: string, relative: string): string {
  const rest = relative.replace(/[/\\:]/g, '-');
  return rest ? (prefix.endsWith('-') ? `${prefix}${rest}` : `${prefix}-${rest}`) : prefix;
}

/**
 * The name OMP gives a folder's session directory: its path relative to home (`-raspnas-…`) or to the
 * temp root (`-tmp…`), or the whole path between dashes when it is neither (see
 * `getDefaultSessionDirName` in OMP's session-paths). OMP names a directory after the folder a run
 * happened in, so this is where a conversation started in `cwd` is filed.
 */
export function ompSessionDirName(cwd: string): string {
  const here = canonical(cwd);
  const home = canonical(homedir());
  const temp = canonical(tmpdir());
  // The temp root is asked first, as OMP asks it: on Windows it nests inside home.
  if (isWithin(temp, here)) return encodeDirName('-tmp', path.relative(temp, here));
  if (isWithin(home, here)) return encodeDirName('-', path.relative(home, here));
  return `--${here.replace(/^[/\\]/, '').replace(/[/\\:]/g, '-')}--`;
}

/** Where OMP files the sessions of a run in `cwd`. */
export function ompSessionDir(cwd: string, sessionsRoot: string): string {
  return path.join(sessionsRoot, ompSessionDirName(cwd));
}

/**
 * Where the session OMP wrote in `file` ran: the `cwd` of the `session` record its own file starts
 * with. Undefined when its head doesn't say, so a caller falls back rather than inventing a place.
 */
export function sessionCwd(file: string): string | undefined {
  try {
    const head = Buffer.alloc(HEAD);
    const fd = openSync(file, constants.O_RDONLY | constants.O_NOFOLLOW);
    let got = 0;
    try {
      got = readSync(fd, head, 0, HEAD, 0);
    } finally {
      closeSync(fd);
    }
    for (const line of head.subarray(0, got).toString('utf8').split('\n')) {
      if (!line.includes('"type":"session"')) continue;
      const row = JSON.parse(line) as { cwd?: unknown };
      return typeof row.cwd === 'string' && row.cwd ? row.cwd : undefined;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

/** The first session file OMP wrote in a folder (`<timestamp>_<id>.jsonl`), when it holds one. */
export function firstSessionFile(dir: string): string | undefined {
  try {
    const name = readdirSync(dir).find((entry) => entry.endsWith('.jsonl'));
    return name ? path.join(dir, name) : undefined;
  } catch {
    return undefined;
  }
}

/** Whether a session that ran in `cwd` is one of the floor's workers': the office runs each of them in a worktree. */
export function worktreeSession(dir: string, cwd: string): boolean {
  return isWithin(path.join(path.resolve(dir), WORKTREES_DIR), path.resolve(cwd));
}

/** The folders inside `dir`, when it has any. */
function foldersIn(dir: string): string[] {
  try {
    return readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(dir, entry.name));
  } catch {
    return [];
  }
}

/** What the floor's saved workers still name — their sessions, and their desks — so nothing that may be running is moved. */
function namedByWorkers(statePath: string): { sessions: Set<string>; desks: Set<string> } {
  const named = { sessions: new Set<string>(), desks: new Set<string>() };
  try {
    const rows: unknown = JSON.parse(readFileSync(statePath, 'utf8'));
    for (const row of Array.isArray(rows) ? rows : []) {
      if (!row || typeof row !== 'object') continue;
      const { id, sessionId } = row as { id?: unknown; sessionId?: unknown };
      if (typeof id === 'string' && id) named.desks.add(id);
      if (typeof sessionId === 'string' && sessionId) named.sessions.add(sessionId);
    }
  } catch {
    // No workers saved, or unreadable: nothing is running, and nothing is held back.
  }
  return named;
}

/**
 * Moves one session into `to`: its file, and the folder of its own beside it — its artifacts and the
 * sub-agents it spawned. Says whether its file went; a session already there is left alone.
 */
function moveSession(from: string, to: string, name: string): boolean {
  const own = name.slice(0, -'.jsonl'.length);
  try {
    if (existsSync(path.join(to, name))) return false;
    mkdirSync(to, { recursive: true, mode: 0o700 });
    renameSync(path.join(from, name), path.join(to, name));
  } catch {
    // Unreadable, or the folder went from under us: it stays where it is.
    return false;
  }
  try {
    renameSync(path.join(from, own), path.join(to, own));
  } catch {
    // It has no folder of its own, or one that can't move: the session itself is already across.
  }
  return true;
}

/** Removes `dir` when nothing is left in it. */
function dropIfEmpty(dir: string) {
  try {
    rmdirSync(dir);
  } catch {
    // Not empty, or not there.
  }
}

/**
 * Moves the office's older OMP sessions into the folder OMP files a floor's project in: the ones a
 * worker wrote inside its own worktree — there was one such folder per worktree, which OMP's picker
 * lists beside the project's own as belonging to another working directory — and the ones a desk kept
 * in a folder of its own under the floor's data dir, from before sessions moved into OMP's store.
 *
 * The files are OMP's own and are only moved: nothing in them is rewritten, so what a session spent is
 * read off it exactly as before. Idempotent, and a session the floor's saved workers still name stays
 * where it is — its worker may be running on it, or carry it on after a restart. Returns how many
 * sessions it moved.
 */
export function adoptOmpSessions(opts: { dir: string; dataDir: string; sessionsRoot: string }): number {
  const { dir, dataDir, sessionsRoot } = opts;
  const named = namedByWorkers(path.join(dataDir, 'workers.json'));
  const sources = [
    // A folder OMP made for a worktree: its first session's own record says where it ran.
    ...foldersIn(sessionsRoot).filter((bucket) => {
      const file = firstSessionFile(bucket);
      const cwd = file ? sessionCwd(file) : undefined;
      return !!cwd && worktreeSession(dir, cwd);
    }),
    // A desk's own folder, from before sessions moved into OMP's store: nothing left names it.
    ...foldersIn(path.join(dataDir, 'omp-sessions')).filter((own) => !named.desks.has(path.basename(own))),
  ];
  const to = ompSessionDir(dir, sessionsRoot);
  let moved = 0;
  for (const from of sources) {
    let files: string[];
    try {
      files = readdirSync(from).filter((name) => name.endsWith('.jsonl'));
    } catch {
      continue;
    }
    for (const name of files) {
      // `<timestamp>_<id>.jsonl`, as OMP names one: the id in it is what a worker is saved by.
      const base = name.slice(0, -'.jsonl'.length);
      if (named.sessions.has(base.slice(base.lastIndexOf('_') + 1))) continue;
      if (moveSession(from, to, name)) moved++;
    }
    dropIfEmpty(from);
  }
  if (moved) dropIfEmpty(path.join(dataDir, 'omp-sessions'));
  return moved;
}

/** One field of a parsed record, still data: nothing here is trusted until it is checked. */
function field(value: object, name: string): unknown {
  return name in value ? (value as Record<string, unknown>)[name] : undefined;
}

/** A count OMP reported, or nothing worth counting. */
function tokens(v: unknown): number {
  return typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 ? v : 0;
}

/** A price OMP reported, or nothing to add when it gave none. */
function usd(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : undefined;
}

/** What one assistant record reports, when it reports it. */
interface Recorded {
  /** Output as OMP writes it, reasoning included. */
  output: number;
  reasoning: number;
  input: number;
  cacheRead: number;
  cacheWrite: number;
  /** Undefined when the record came without a usable price. */
  cost: number | undefined;
  model: string | undefined;
  provider: string | undefined;
  /** The record's own time, ms since epoch, when it carries one. */
  timestamp: number | undefined;
}

/** The numbers one line of an OMP session reports, when it is an assistant response that reports them. */
export function recorded(line: string): Recorded | undefined {
  if (!line.includes('"usage"')) return undefined;
  let row: unknown;
  try {
    row = JSON.parse(line);
  } catch {
    return undefined;
  }
  if (!row || typeof row !== 'object') return undefined;
  const message = field(row, 'message');
  if (!message || typeof message !== 'object' || field(message, 'role') !== 'assistant') return undefined;
  const usage = field(message, 'usage');
  if (!usage || typeof usage !== 'object') return undefined;
  const output = tokens(field(usage, 'output'));
  const reasoning = tokens(field(usage, 'reasoningTokens'));
  if (reasoning > output) return undefined; // malformed: never invent tokens
  const cost = field(usage, 'cost');
  const model = field(message, 'model');
  const provider = field(message, 'provider');
  const at = Date.parse(String(field(row, 'timestamp')));
  return {
    input: tokens(field(usage, 'input')),
    output,
    reasoning,
    cacheRead: tokens(field(usage, 'cacheRead')),
    cacheWrite: tokens(field(usage, 'cacheWrite')),
    cost: cost && typeof cost === 'object' ? usd(field(cost, 'total')) : undefined,
    model: typeof model === 'string' && model ? model : undefined,
    provider: typeof provider === 'string' && provider ? provider : undefined,
    timestamp: Number.isFinite(at) ? at : undefined,
  };
}

/** The file itself, when it is a `.jsonl` under `root` and not a way out of it. */
function within(root: string, file: string): string | undefined {
  try {
    const base = realpathSync(root);
    const target = realpathSync(file);
    const rel = path.relative(base, target);
    if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return undefined;
    return target.endsWith('.jsonl') ? target : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Follows one OMP session file, read the office's own off the session it started and never another
 * desk's: a file outside `root` is refused, the way Codex's reader refuses one. Nothing here is
 * invented: a record whose numbers don't add up is skipped, and a file that can't be read leaves the
 * numbers as they were.
 */
export class OmpUsageReader {
  private file?: string;
  private offset = 0;
  private spent = { input: 0, output: 0, reasoning: 0, cacheWrite: 0, cacheRead: 0, cost: 0, calls: 0, unpriced: 0 };
  /** The model its latest counted response ran on, as OMP names it. */
  private model?: string;

  /** What the session has spent so far, or undefined when there is nothing readable to say. */
  read(file: string, root: string): Usage | undefined {
    const target = within(root, file);
    if (!target) {
      this.reset();
      return undefined;
    }
    if (target !== this.file) this.reset(target);
    let size: number;
    try {
      size = statSync(target).size;
    } catch {
      this.reset();
      return undefined;
    }
    // Written over under us (a session replaced in place): nothing read so far describes it.
    if (size < this.offset) this.reset(target);
    if (size > this.offset) this.follow(target, size);
    const s = this.spent;
    return {
      input: s.input,
      output: s.output,
      cacheRead: s.cacheRead,
      cacheWrite: s.cacheWrite,
      cost: s.cost,
      calls: s.calls,
      costKnown: s.calls > 0 && s.unpriced === 0,
      ...(s.reasoning ? { reasoning: s.reasoning } : {}),
      ...(this.model ? { model: this.model } : {}),
    };
  }

  private follow(target: string, size: number) {
    let fd: number | undefined;
    try {
      fd = openSync(target, constants.O_RDONLY | constants.O_NOFOLLOW);
      const buf = Buffer.alloc(CHUNK);
      let at = this.offset;
      while (at < size) {
        const got = readSync(fd, buf, 0, Math.min(size - at, CHUNK), at);
        if (got <= 0) break;
        const end = buf.subarray(0, got).lastIndexOf(0x0a);
        if (end < 0) {
          // A line longer than a whole read: nothing in it can be parsed, and it cannot be split.
          if (got < CHUNK) break; // the file ends mid-line: it waits for the rest
          at += got;
          this.offset = at;
          continue;
        }
        for (const line of buf.subarray(0, end).toString('utf8').split('\n')) this.record(line);
        at += end + 1;
        this.offset = at;
      }
    } catch {
      // Unreadable: keep what we have rather than inventing numbers.
    } finally {
      if (fd !== undefined) closeSync(fd);
    }
  }

  private record(line: string) {
    const r = recorded(line);
    if (!r) return;
    const s = this.spent;
    s.input += r.input;
    s.output += r.output - r.reasoning;
    s.reasoning += r.reasoning;
    s.cacheRead += r.cacheRead;
    s.cacheWrite += r.cacheWrite;
    if (r.cost === undefined) s.unpriced += 1;
    else s.cost += r.cost;
    s.calls += 1;
    if (r.model) this.model = r.model;
  }

  private reset(file?: string) {
    this.file = file;
    this.offset = 0;
    this.spent = { input: 0, output: 0, reasoning: 0, cacheWrite: 0, cacheRead: 0, cost: 0, calls: 0, unpriced: 0 };
    this.model = undefined;
  }
}
