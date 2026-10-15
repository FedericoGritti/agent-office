import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import { setImmediate as settle, setTimeout as delay } from 'node:timers/promises';
import { MONITOR_COLS, MONITOR_ROWS, Monitor } from '../src/server/monitor.js';
import { resolveCommand } from '../src/server/workers.js';
import type { Pty, PtyExit, SpawnOpts } from '../src/server/ptys.js';
import type { ScreenFrame } from '../src/server/workers/terminal.js';

/** A terminal that isn't one: it says whatever the test tells it to, and dies when it says so. */
class FakePty implements Pty {
  readonly pid = 4242;
  killed = false;
  private data: ((d: string) => void)[] = [];
  private exits: ((e: PtyExit) => void)[] = [];
  write() {}
  resize() {}
  kill() {
    this.killed = true;
  }
  onData(cb: (d: string) => void) {
    this.data.push(cb);
  }
  onExit(cb: (e: PtyExit) => void) {
    this.exits.push(cb);
  }
  emit(data: string) {
    for (const cb of this.data) cb(data);
  }
  end(e: PtyExit = { exitCode: 0 }) {
    for (const cb of this.exits) cb(e);
  }
}

/**
 * The terminal reads what a pty hands it on a timer of its own, so a screen is readable after a real
 * yield — of no duration whatever: a timer that was already due, and the microtasks behind it. Nothing
 * here is waited out: the poll is in the test's hands (pollMs 0), so what the wall gets is never a
 * question of how long a test waited.
 */
const parsed = async () => {
  await settle();
  await delay(0);
  await settle();
};

/** A monitor fed by a fake terminal, and what it has sent to the wall. */
function harness(t: TestContext, spawn?: (o: SpawnOpts) => Pty) {
  const frames: ScreenFrame[] = [];
  const spawned: SpawnOpts[] = [];
  const ptys: FakePty[] = [];
  const monitor = new Monitor(
    {
      cwd: os.tmpdir(),
      file: 'btop',
      retryMs: 10,
      pollMs: 0,
      spawn:
        spawn ??
        ((o) => {
          const p = new FakePty();
          spawned.push(o);
          ptys.push(p);
          return p;
        }),
    },
    (f) => frames.push(f),
  );
  return { monitor, frames, spawned, pty: () => ptys[ptys.length - 1]!, started: () => ptys.length, tick: (ms: number) => t.mock.timers.tick(ms) };
}

/** The screen as text, rows in order. */
const text = (frame: ScreenFrame | undefined) =>
  !frame
    ? ''
    : Object.keys(frame.lines)
        .sort((a, b) => Number(a) - Number(b))
        .map((y) => (frame.lines[Number(y)] ?? []).map((r) => r[0]).join(''))
        .join('\n');

test("what btop draws reaches the wall, once per change", async (t) => {
  const h = harness(t);
  h.monitor.start();
  const spawned = h.spawned[0]!;
  assert.equal(spawned.file, 'btop');
  assert.deepEqual(spawned.args, ['--utf-force']);
  assert.deepEqual([spawned.cols, spawned.rows], [MONITOR_COLS, MONITOR_ROWS], "at the size the wall's shape wants");
  assert.equal(spawned.env.COLORTERM, 'truecolor', 'and in the colours btop draws its own theme in');

  h.pty().emit('cpu 12%\r\nmem 40%');
  await parsed();
  h.monitor.poll();
  assert.equal(h.frames.length, 1, 'the change went out');
  assert.equal(h.frames[0]!.full, true, 'and as a whole screen, since the wall had nothing yet');
  assert.match(text(h.frames[0]), /cpu 12%/);

  h.monitor.poll();
  assert.equal(h.frames.length, 1, 'nothing changed, so nothing was sent');

  h.pty().emit('\x1b[1;1Hcpu 99%');
  await parsed();
  h.monitor.poll();
  assert.equal(h.frames.length, 2);
  assert.equal(h.frames[1]!.full, false, 'a redraw is a diff: only the rows that changed');
  assert.deepEqual(Object.keys(h.frames[1]!.lines), ['0']);

  h.monitor.stop();
  assert.equal(h.pty().killed, true, 'and btop goes with the office');
});

test('whoever walks in gets the whole screen, not the rows that changed last', async (t) => {
  const h = harness(t);
  h.monitor.start();
  h.pty().emit('cpu 12%\r\nmem 40%');
  await parsed();
  h.monitor.poll();
  assert.equal(h.frames.length, 1);

  const whole = h.monitor.full();
  assert.equal(whole?.full, true);
  assert.match(text(whole), /cpu 12%[\s\S]*mem 40%/);
  h.monitor.stop();
});

test('a btop that will not start leaves the wall to the office own drawing', async (t) => {
  let tries = 0;
  const h = harness(t, () => {
    tries++;
    throw new Error('spawn btop ENOENT');
  });
  h.monitor.start();
  assert.equal(h.monitor.running, false);
  assert.equal(h.frames.length, 0);
  t.mock.timers.enable({ apis: ['setTimeout'] });
  h.tick(60_000);
  assert.equal(tries, 1, 'there is nothing to run here, so it is not asked again');
  h.monitor.stop();
});

test('a btop that dies before it draws is not restarted either', async (t) => {
  const h = harness(t);
  t.mock.timers.enable({ apis: ['setTimeout'] });
  h.monitor.start();
  h.pty().end({ exitCode: 1, error: 'spawn btop ENOENT' });
  h.tick(60_000);
  assert.equal(h.started(), 1);
  h.monitor.stop();
});

test('a btop that quits or is killed comes back', async (t) => {
  const h = harness(t);
  t.mock.timers.enable({ apis: ['setTimeout'] });
  h.monitor.start();
  assert.equal(h.started(), 1);
  h.pty().end({ exitCode: 0 });
  h.tick(10); // retryMs
  assert.equal(h.started(), 2, 'the wall is not left dark');
  assert.equal(h.monitor.running, true);

  h.monitor.stop();
  h.pty().end({ exitCode: 0 });
  h.tick(10);
  assert.equal(h.started(), 2, 'and once the office is going nothing is started behind it');
});

test('btop really draws on the monitor the office gives it', { skip: !resolveCommand('btop') }, async () => {
  // The one thing here on the real clock: btop is another process drawing on a timer of its own, so there
  // is no clock to move by hand — it is polled for what it is meant to do, not waited out.
  const frames: ScreenFrame[] = [];
  const monitor = new Monitor({ cwd: process.cwd(), cols: MONITOR_COLS, rows: MONITOR_ROWS }, (f) => frames.push(f));
  monitor.start();
  let drawn: ScreenFrame | undefined;
  try {
    for (const until = Date.now() + 8000; Date.now() < until; ) {
      const whole = monitor.full();
      const rows = whole ? Object.values(whole.lines).filter((runs) => runs.some((r) => r[0].trim())).length : 0;
      if (rows > MONITOR_ROWS * 0.6 && frames.some((f) => !f.full)) {
        drawn = whole;
        break;
      }
      await delay(50);
    }
  } finally {
    monitor.stop();
  }

  assert.ok(drawn, `btop drew nothing on a ${MONITOR_COLS} × ${MONITOR_ROWS} monitor`);
  assert.deepEqual([drawn.cols, drawn.rows], [MONITOR_COLS, MONITOR_ROWS]);
  assert.match(text(drawn), /cpu/i, 'its boxes are there');
  assert.match(text(drawn), /mem/i);
});
