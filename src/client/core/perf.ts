/**
 * Where a frame's time goes: the numbers the Graphics settings page shows (see ui/settings.ts), and the
 * only honest answer to "why is the office slow?".
 *
 * A frame is two different costs. One is what it draws — the ink outlines, the shadow map, the drawing
 * buffer's pixels (see core/graphics.ts). The other is the office's own work every frame: moving you,
 * the workers, the sky, the smoke, the boards. Which of the two dominates is a fact about the machine and
 * about what is going on in it, and no amount of reading the code settles it.
 *
 * It measures only while someone is looking, because timing every phase is a little work per frame and an
 * office is not made faster by asking it how slow it is.
 */
import type { TickPhase } from './registry';

/** What a frame costs, averaged over a second or so: one frame's own time jumps about too much to read. */
export interface FrameCost {
  /** Frames per second the browser is actually giving. */
  fps: number;
  /** The whole frame in milliseconds, as the browser spaces them out. */
  frame: number;
  /** The frame's own work, phase by phase, the biggest first. Phases under 0.05 ms are left out. */
  phases: { phase: TickPhase; ms: number }[];
  /** What's left outside that work: waiting for the browser, its own layout and drawing, other tabs. */
  elsewhere: number;
}

/** How many frames one reading averages: about a second at 60 a second. */
export const FRAME_WINDOW = 60;

let watching = false;
let frames = 0;
let frameSum = 0;
const sums = new Map<TickPhase, number>();
/** The frame being timed now, which the loop fills in (see phaseTimes). */
const current = new Map<TickPhase, number>();
let last: FrameCost | null = null;

/** Starts or stops measuring, and forgets what it had: a reading is about now, not about a minute ago. */
export function watchFrames(on: boolean): void {
  watching = on;
  frames = 0;
  frameSum = 0;
  sums.clear();
  current.clear();
  last = null;
}

export function framesWatched(): boolean {
  return watching;
}

/** The map this frame's phases are timed into, emptied first: the loop hands it to Ticks.run. */
export function phaseTimes(): Map<TickPhase, number> {
  current.clear();
  return current;
}

/** One frame measured: how long the browser gave it, and what its own work took (which the loop has put in the map). */
export function sampleFrame(frameMs: number): void {
  if (!watching) return;
  frames++;
  frameSum += frameMs;
  for (const [phase, ms] of current) sums.set(phase, (sums.get(phase) ?? 0) + ms);
  if (frames < FRAME_WINDOW) return;
  const n = frames;
  const mean = frameSum / n;
  const own = [...sums.values()].reduce((a, b) => a + b, 0) / n;
  last = {
    fps: 1000 / mean,
    frame: mean,
    phases: [...sums]
      .map(([phase, ms]) => ({ phase, ms: ms / n }))
      .filter((p) => p.ms >= 0.05)
      .sort((a, b) => b.ms - a.ms),
    elsewhere: Math.max(0, mean - own),
  };
  frames = 0;
  frameSum = 0;
  sums.clear();
}

/** The last reading, or null while nothing has been measured yet (or nobody is watching: see watchFrames). */
export function frameCost(): FrameCost | null {
  return last;
}
