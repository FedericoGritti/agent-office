// A terminal's whole family dies with it: a worker's terminal is detached from the office, so
// anything left behind (a headless browser, a language server, a broker daemon) is never reaped.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { family, killTree } from '../src/server/ptytree.js';

/** Whether a pid still exists: signal 0 only asks the kernel. */
const isAlive = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

/**
 * Polls until `ready` holds. Real processes on the kernel's clock, so the condition is awaited
 * rather than guessed at with a fixed sleep.
 */
async function until(ready: () => boolean, ms = 4000): Promise<boolean> {
  for (const _ of Array(Math.ceil(ms / 25))) {
    if (ready()) return true;
    await new Promise<void>((resolve) => setTimeout(resolve, 25));
  }
  return ready();
}

test('ending a terminal reaps its children, including one that left the process group', async () => {
  // `detached` makes the shell a session leader, the way node-pty starts a worker's terminal; the
  // `setsid` child emulates the broker daemons that escape into a session of their own.
  const shell = spawn('/bin/sh', ['-c', 'setsid sleep 301 & sleep 302 & sleep 300'], { detached: true, stdio: 'ignore' });
  const pid = shell.pid!;
  try {
    assert.ok(await until(() => family(pid).pids.length >= 2), 'the shell started its children');

    const found = family(pid);
    assert.equal(found.group, true, 'a terminal leads its own process group');

    killTree(pid);
    assert.ok(await until(() => [pid, ...found.pids].every((p) => !isAlive(p))), 'nothing the terminal started is left running');
  } finally {
    killTree(pid); // a mopping-up pass in case an assertion above threw
  }
});
