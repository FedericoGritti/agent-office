// What a floor's project has spent in OMP, read off OMP's own session records (see omp-usage.ts
// for the records themselves): the same files `omp stats` sums, so the wall shows what a terminal
// `omp stats` would. OMP files a session in the folder it ran in, and a sub-agent inside the session
// that spawned it, so "the project" is the project's own folder and everything under it — the
// workers' worktrees included. What a session is counted as goes by where it ran, not by the folder
// it is filed in, so a worker's conversation counts the same wherever the office keeps it. Only
// what's new in a file is read each time, so pressing the board's button again is cheap. Nothing here
// is invented: a record whose numbers don't add up is skipped.

import { closeSync, constants, openSync, readdirSync, readSync, statSync } from 'node:fs';
import path from 'node:path';
import { localDay } from '../shared/coordinator.js';
import { EMPTY_SPEND, noSpend, noWindow, type SpendAgent, type SpendNumbers, type SpendState, type SpendWindow } from '../shared/protocol.js';
import { firstSessionFile, ompAgentDir, recorded, sessionCwd, worktreeSession } from './omp-usage.js';

/** How much of a session file one read takes at a time. */
const CHUNK = 4 * 1024 * 1024;
/**
 * The name OMP gives the advisor runtime's records inside a session's folder. The advisor works for
 * that session, so its calls are counted with it.
 */
const ADVISOR = '__advisor';
/**
 * The providers whose spend the board counts. An OMP run on a subscription — Codex on a ChatGPT plan,
 * say — isn't billed per token, so its tokens have no price worth showing beside a metered one's.
 */
const COUNTED = new Set(['deepseek']);

/** Adds `n` into `into`, in place. */
function add(into: SpendNumbers, n: SpendNumbers) {
  into.tokens += n.tokens;
  into.input += n.input;
  into.output += n.output;
  into.cacheRead += n.cacheRead;
  into.cacheWrite += n.cacheWrite;
  into.cost += n.cost;
  into.calls += n.calls;
  into.unpriced += n.unpriced;
}

/** Adds `n` into a window and into the agent and provider it came from. */
function addWindow(w: SpendWindow, agent: SpendAgent, provider: string, n: SpendNumbers) {
  add(w, n);
  add(w.byAgent[agent], n);
  add((w.byProvider[provider] ??= noSpend()), n);
}

/** One session file, followed as it grows; `agent` is what its place in the tree says it is. */
interface Followed {
  agent: SpendAgent;
  offset: number;
  /** What each day and provider in it has spent, in one flat map keyed as `day\0provider`. */
  slices: Map<string, SpendNumbers>;
}

/**
 * One floor's project spend. It reads OMP's session records on demand (the board's button) and keeps
 * what it has read, so a second press reads only what the sessions wrote since.
 */
export class OmpSpend {
  private current: SpendState = { ...EMPTY_SPEND };
  private files = new Map<string, Followed>();
  /** Where each session file ran, by file: null when its record doesn't say. */
  private cwds = new Map<string, string | null>();

  constructor(
    private dir: string,
    private name: string | null,
  ) {}

  /** The numbers as they were last read. */
  state(): SpendState {
    return this.current;
  }

  /** Reads the project's session records again — off what's new — and keeps the result. */
  refresh(): SpendState {
    const root = path.join(ompAgentDir(this.dir, process.env), 'sessions');
    let folders: string[];
    try {
      folders = readdirSync(root, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
    } catch {
      this.current = { ...EMPTY_SPEND, project: this.name, at: Date.now(), note: 'OMP keeps no sessions on this machine' };
      return this.current;
    }
    let files = 0;
    for (const folder of folders) {
      const at = path.join(root, folder);
      // Which folders are the project's at all: a session's own record says where it ran.
      const first = firstSessionFile(at);
      const cwd = first ? this.cwdOf(first) : null;
      if (!cwd || !this.ours(cwd)) continue;
      files += this.folder(at, this.agentOf(cwd));
    }
    return (this.current = this.windows(files));
  }

  /** Where a session file ran, read once and kept: null when its record doesn't say. */
  private cwdOf(file: string): string | null {
    const known = this.cwds.get(file);
    if (known !== undefined) return known;
    const cwd = sessionCwd(file) ?? null;
    this.cwds.set(file, cwd);
    return cwd;
  }

  /** Which of the project's two kinds of agent a session run in `cwd` is: one of its own, or a worker's. */
  private agentOf(cwd: string): SpendAgent {
    return worktreeSession(this.dir, cwd) ? 'subagents' : 'agents';
  }

  /** Whether a session's folder is the project or something building inside it (a worktree, say). */
  private ours(cwd: string): boolean {
    const p = path.resolve(cwd);
    const d = path.resolve(this.dir);
    return p === d || p.startsWith(d + path.sep);
  }

  /**
   * Reads the session files of one folder: each of its own sessions by where it ran — the project's own
   * folder, or a worker's worktree under it, whichever folder OMP files it in — the sub-agents OMP
   * files inside a session, and the advisor, which counts with the session it works for.
   */
  private folder(dir: string, base: SpendAgent): number {
    let read = 0;
    let entries: { name: string; dir: boolean }[];
    try {
      entries = readdirSync(dir, { withFileTypes: true }).map((e) => ({ name: e.name, dir: e.isDirectory() }));
    } catch {
      return 0;
    }
    const agents = new Map<string, SpendAgent>();
    for (const entry of entries) {
      if (entry.dir || !entry.name.endsWith('.jsonl')) continue;
      const file = path.join(dir, entry.name);
      const cwd = this.cwdOf(file);
      // A file that doesn't say where it ran is counted the way its own folder is.
      const agent = cwd && this.ours(cwd) ? this.agentOf(cwd) : base;
      agents.set(entry.name.slice(0, -'.jsonl'.length), agent);
      read += this.follow(file, agent) ? 1 : 0;
    }
    for (const entry of entries) {
      if (!entry.dir) continue;
      const inner = path.join(dir, entry.name);
      let subs: string[];
      try {
        subs = readdirSync(inner).filter((f) => f.endsWith('.jsonl'));
      } catch {
        continue;
      }
      // A session OMP files inside another one is that one's sub-agent; the advisor works for the
      // session it sits in, so it counts with it.
      for (const sub of subs) {
        const agent = sub.startsWith(ADVISOR) ? agents.get(entry.name) ?? base : 'subagents';
        read += this.follow(path.join(inner, sub), agent) ? 1 : 0;
      }
    }
    return read;
  }

  /** Reads what's new in one session file. Returns false when it's unchanged. */
  private follow(file: string, agent: SpendAgent): boolean {
    let size: number;
    try {
      size = statSync(file).size;
    } catch {
      return false;
    }
    let f = this.files.get(file);
    if (!f) {
      f = { agent, offset: 0, slices: new Map() };
      this.files.set(file, f);
    }
    // Written over under us (a session replaced in place): nothing read so far describes it.
    if (size < f.offset) {
      f.offset = 0;
      f.slices.clear();
    }
    if (size === f.offset) return false;
    let fd: number | undefined;
    try {
      fd = openSync(file, constants.O_RDONLY | constants.O_NOFOLLOW);
      const buf = Buffer.alloc(CHUNK);
      while (f.offset < size) {
        const got = readSync(fd, buf, 0, Math.min(size - f.offset, CHUNK), f.offset);
        if (got <= 0) break;
        const end = buf.subarray(0, got).lastIndexOf(0x0a);
        if (end < 0) {
          // A line longer than a whole read: nothing in it can be parsed, and it cannot be split.
          if (got < CHUNK) break; // the file ends mid-line: it waits for the rest
          f.offset += got;
          continue;
        }
        for (const line of buf.subarray(0, end).toString('utf8').split('\n')) this.count(f, line);
        f.offset += end + 1;
      }
    } catch {
      // Unreadable: keep what we have rather than inventing numbers.
    } finally {
      if (fd !== undefined) closeSync(fd);
    }
    return true;
  }

  /** Counts one line of a session into what its file has spent, when it's a response that reports it. */
  private count(f: Followed, line: string) {
    const r = recorded(line);
    if (!r) return;
    if (!r.provider || !COUNTED.has(r.provider)) return;
    const n: SpendNumbers = {
      tokens: r.input + r.output + r.cacheRead + r.cacheWrite,
      input: r.input,
      output: r.output,
      cacheRead: r.cacheRead,
      cacheWrite: r.cacheWrite,
      cost: r.cost ?? 0,
      calls: 1,
      unpriced: r.cost === undefined ? 1 : 0,
    };
    const day = r.timestamp === undefined ? '' : localDay(new Date(r.timestamp));
    const key = `${day}\u0000${r.provider ?? 'unknown'}`;
    let slice = f.slices.get(key);
    if (!slice) {
      slice = noSpend();
      f.slices.set(key, slice);
    }
    add(slice, n);
  }

  /** Today's numbers and the project's own, from every file read so far. */
  private windows(files: number): SpendState {
    const day = localDay();
    const today = noWindow();
    const total = noWindow();
    for (const f of this.files.values()) {
      for (const [key, n] of f.slices) {
        const cut = key.indexOf('\u0000');
        const at = key.slice(0, cut);
        const provider = key.slice(cut + 1);
        addWindow(total, f.agent, provider, n);
        if (at === day) addWindow(today, f.agent, provider, n);
      }
    }
    return { project: this.name, day, today, total, at: Date.now(), ...(files === 0 ? { note: 'No OMP sessions for this project yet' } : {}) };
  }
}
