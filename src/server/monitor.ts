// The office's own terminal, on the wall: btop, mirrored into screen frames the way a worker's terminal
// is (see workers/terminal.ts). Nobody drives it — it is there to be looked at — so nothing is typed into
// it and it answers to no floor: the same screen is on the west wall of every floor, and it is broadcast
// to everyone rather than sent to whoever is looking at a terminal of their own.
import headless from '@xterm/headless';
import { spawnLocal, type Pty, type SpawnOpts } from './ptys.js';
import { resolveCommand } from './workers.js';
import { childEnv } from './workers/env.js';
import { snapshotScreen, type HeadlessTerminal, type ScreenFrame } from './workers/terminal.js';

/**
 * The size btop is given. The wall monitor is 2.3 × 1.3 m, and a terminal cell is about .6 characters
 * wide by 1.25 high, so a grid of about 3.7 columns per row fills that shape: 100 × 27 is the biggest
 * that fits (btop needs 80 × 24 at the least), which leaves the text as large as it gets on the wall.
 */
export const MONITOR_COLS = 100;
export const MONITOR_ROWS = 27;

/** How often the screen is looked at. btop redraws on its own clock (2 s by default): this is only how
 *  soon a redraw reaches the browsers, and a walk over the screen costs nothing when nothing changed. */
const POLL_MS = 250;

/** How long to leave it before starting btop again, after it quits or is killed. */
const RETRY_MS = 5000;

/**
 * How long a screen may stand still before btop is taken to be wedged. btop can wedge itself: when one
 * of its passes takes over five seconds its watchdog cancels that thread while the thread still holds
 * the mutex, and the thread it starts in its place blocks on that mutex for good — one thread asleep on
 * a futex, no more drawing, and the process (and so the screen) looking perfectly alive. The pass it
 * takes exception to is a slow one, and a slow one is what it gets while the office is still starting
 * up: measured here, every btop started with the office wedged within six seconds, while the same btop
 * started on a quiet machine drew for minutes. Its own update is 2 s, so twenty seconds of nothing is
 * not a slow picture but a wedged one, and starting it a second time — with the office's own startup
 * behind it — is what gets a monitor that keeps moving.
 */
const STALE_MS = 20_000;

export interface MonitorOpts {
  /** Where it runs: it reads no project, so anywhere the office owns will do. */
  cwd: string;
  /** Overridden by the tests, which feed it a screen of their own instead of running btop. */
  file?: string;
  cols?: number;
  rows?: number;
  retryMs?: number;
  /** How long a still screen is left alone before btop is started again (see STALE_MS). */
  staleMs?: number;
  /** How often to hand the screen on; 0 to leave the clock to whoever calls `poll` (the tests). */
  pollMs?: number;
  spawn?: (opts: SpawnOpts) => Pty;
}

/**
 * btop on the wall monitor, as the office sees it: it runs btop in a terminal of its own and reads its
 * screen, so what the wall shows is the real thing — the user's own btop, its theme and its config.
 * Where there is no btop to run it simply has nothing to show, and the wall keeps the office's own
 * drawing (see features/boards/machine.ts).
 */
export class Monitor {
  private pty?: Pty;
  private term?: HeadlessTerminal;
  /** The rows as last sent, so a frame carries what changed (see snapshotScreen). */
  private last: string[] = [];
  /** Set only after xterm has parsed new data, so an idle screen is never walked and serialized. */
  private dirty = false;
  private interval?: NodeJS.Timeout;
  private retry?: NodeJS.Timeout;
  /** When the screen last changed, so a wedged btop can be told from a quiet one (see STALE_MS). */
  private changedAt = 0;
  /** Nothing to run here: no btop, so nothing to try again either. */
  private off = false;
  private stopping = false;

  constructor(private opts: MonitorOpts, private onFrame: (frame: ScreenFrame) => void) {}

  /** Whether btop is running on this office's machine. */
  get running(): boolean {
    return this.pty !== undefined;
  }

  start() {
    this.spawnBtop();
    if (this.opts.pollMs === 0) return;
    this.interval = setInterval(() => this.flush(), this.opts.pollMs ?? POLL_MS);
    this.interval.unref();
  }

  /** Hands the screen on if it has changed. The office runs this on a clock of its own (see start), and
   *  a test calls it by hand so that what the wall gets is never a matter of how long it waited. */
  poll() {
    this.flush();
  }

  /** The whole screen as it stands, for a browser walking in (see office/views.ts). */
  full(): ScreenFrame | undefined {
    if (!this.term) return undefined;
    // A `last` of its own: whatever has already gone out, this is all of it.
    return snapshotScreen(this.term, []) ?? undefined;
  }

  stop() {
    this.stopping = true;
    clearInterval(this.interval);
    clearTimeout(this.retry);
    this.drop();
  }

  /** Hands parsed changes on, and starts btop again when its visible screen has stopped. */
  private flush() {
    if (!this.term) return;
    const now = Date.now();
    if (this.dirty) {
      this.dirty = false;
      const frame = snapshotScreen(this.term, this.last);
      if (frame) {
        this.changedAt = now;
        this.onFrame(frame);
        return;
      }
    }
    if (now - this.changedAt > (this.opts.staleMs ?? STALE_MS)) this.restart();
  }

  /** Starts btop over, keeping on the wall what the wedged one had drawn until the new one draws. */
  private restart() {
    const drawn = this.full();
    this.drop();
    this.spawnBtop();
    if (drawn) this.onFrame(drawn);
  }

  /** Gives up this btop and its screen. */
  private drop() {
    // Killed outright: a wedged btop has SIGTERM blocked (its runner thread blocks it) and its main
    // thread is waiting on the mutex the thread btop cancelled went and died holding, so it never comes
    // round to handling it. The point of dropping it is that it stops now.
    this.pty?.kill('SIGKILL');
    this.pty = undefined;
    this.term?.dispose();
    this.term = undefined;
    this.last = [];
    this.dirty = false;
  }

  private spawnBtop() {
    if (this.stopping || this.off) return;
    // Resolved once per start rather than left to the spawner's PATH: the office may be started by
    // anything (systemd, a hook, an agent session), and a monitor that works from one and not another is
    // worse than one that plainly falls back.
    const file = this.opts.file ?? resolveCommand('btop');
    if (!file) {
      this.off = true; // no btop here, and no point asking again every few seconds
      return;
    }
    const cols = this.opts.cols ?? MONITOR_COLS;
    const rows = this.opts.rows ?? MONITOR_ROWS;
    const term = new headless.Terminal({ cols, rows, scrollback: 0, allowProposedApi: true });
    let pty: Pty;
    try {
      // btop reads its own config, its theme and its update rate: the office runs it as whoever runs the
      // office. `--utf-force` is because the office may well be started with no locale saying the terminal
      // is UTF-8, and box drawing is most of what a monitor is.
      pty = (this.opts.spawn ?? spawnLocal)({ file, args: ['--utf-force'], cwd: this.opts.cwd, cols, rows, env: { ...childEnv(), COLORTERM: 'truecolor' } });
    } catch {
      this.off = true;
      return;
    }
    this.term = term;
    this.pty = pty;
    this.last = [];
    this.dirty = false;
    // btop takes a few seconds to draw its first screen: until then it is not late, it is starting.
    this.changedAt = Date.now();
    // Both are ignored for a terminal the office has already given up (see restart): what it says is no
    // longer the screen, and its exit must not take the new one's place away nor start a third btop.
    // xterm emits this after parsing, at most once per frame: one listener avoids a callback allocation
    // for every pty chunk and tells flush exactly when reading the buffer is safe.
    term.onWriteParsed(() => {
      if (this.term === term) this.dirty = true;
    });
    pty.onData((data) => {
      if (this.term === term) term.write(data);
    });
    pty.onExit((e) => {
      if (this.pty !== pty) return;
      this.pty = undefined;
      this.term?.dispose();
      this.term = undefined;
      if (this.stopping) return;
      if (e.error) {
        this.off = true; // it never started: there is nothing here to run
        return;
      }
      this.retry = setTimeout(() => this.spawnBtop(), this.opts.retryMs ?? RETRY_MS);
      this.retry.unref();
    });
  }
}
