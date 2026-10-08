/**
 * Ending a worker's terminal and everything it started.
 *
 * A terminal leads a session of its own (node-pty starts it with setsid), so a worker's browsers,
 * language servers, broker daemons and subagents are its children. Signalling the terminal alone
 * leaves them behind — and the pty host that owns the terminal is detached on purpose, so nothing
 * else would ever reap them. These helpers walk /proc so a killed terminal takes its family with it.
 */
import { readdirSync, readFileSync } from 'node:fs';

/** How long a process that ignored the hangup has before it is killed outright. */
const KILL_AFTER_MS = 1500;

/** How far up a parent chain to climb before giving up, so a pid cycle can't loop forever. */
const MAX_DEPTH = 256;

/**
 * A terminal's descendants and whether it leads a process group of its own, read from /proc.
 * The group counts as its own only when its group id equals its pid, so a group id recycled by
 * another process while this one was being reaped is never signalled.
 */
export function family(pid: number): { group: boolean; pids: number[] } {
  const parents = new Map<number, number>();
  let group = false;
  for (const entry of readdirSync('/proc')) {
    if (!/^\d+$/.test(entry)) continue;
    const p = Number(entry);
    let fields: string[];
    try {
      const stat = readFileSync(`/proc/${p}/stat`, 'utf8');
      fields = stat.slice(stat.lastIndexOf(')') + 2).trim().split(/\s+/);
    } catch {
      continue; // exited while we were reading it
    }
    parents.set(p, Number(fields[1])); // state ppid pgrp ...
    if (p === pid) group = Number(fields[2]) === pid;
  }
  const pids: number[] = [];
  for (const p of parents.keys()) {
    let q = p;
    for (let up = 0; q !== pid && up < MAX_DEPTH; up++) q = parents.get(q) ?? -1;
    if (q === pid && p !== pid) pids.push(p);
  }
  return { group, pids };
}

/** Ends `pid` and its whole family: the hangup first, then SIGKILL for whoever ignored it. */
export function killTree(pid: number): void {
  if (!(pid > 0)) return;
  const { group, pids } = family(pid);
  if (group) signal(-pid, 'SIGHUP');
  for (const p of pids) signal(p, 'SIGHUP');
  const kill = setTimeout(() => {
    if (group) signal(-pid, 'SIGKILL');
    for (const p of pids) signal(p, 'SIGKILL');
  }, KILL_AFTER_MS);
  kill.unref();
}

function signal(target: number, sig: NodeJS.Signals) {
  try {
    process.kill(target, sig);
  } catch {
    // already gone
  }
}
