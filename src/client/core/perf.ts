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
  /** The worst single frame in this window, in milliseconds: a hitch is a frame, not an average. */
  worst: number;
}

/** How many frames one reading averages: about half a second at 60 a second. Short, so a hitch shows up in it. */
export const FRAME_WINDOW = 30;

let watching = false;
let frames = 0;
let frameSum = 0;
/** The worst single frame the browser gave us, which is what a hitch actually feels like. */
let worstFrame = 0;
const sums = new Map<TickPhase, number>();
/** The frame being timed now, which the loop fills in (see phaseTimes). */
const current = new Map<TickPhase, number>();
let last: FrameCost | null = null;
let worst: FrameCost | null = null;
let overlay: HTMLElement | null = null;
let overlayTimer: number | undefined;

/**
 * Starts or stops measuring, and shows or hides the strip on screen (see setOverlay). Calling it with the
 * state it's already in does nothing: a reading is about now, and it is not thrown away by asking again.
 */
export function watchFrames(on: boolean, strip = false): void {
  setOverlay(on && strip);
  if (watching === on) return;
  watching = on;
  frames = 0;
  frameSum = 0;
  worstFrame = 0;
  sums.clear();
  current.clear();
  last = null;
  worst = null;
  paintOverlay();
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
  worstFrame = Math.max(worstFrame, frameMs);
  for (const [phase, ms] of current) sums.set(phase, (sums.get(phase) ?? 0) + ms);
  if (frames < FRAME_WINDOW) return;
  const n = frames;
  const mean = frameSum / n;
  const own = [...sums.values()].reduce((a, b) => a + b, 0) / n;
  const cost: FrameCost = {
    fps: 1000 / mean,
    frame: mean,
    phases: [...sums]
      .map(([phase, ms]) => ({ phase, ms: ms / n }))
      .filter((p) => p.ms >= 0.05)
      .sort((a, b) => b.ms - a.ms),
    elsewhere: Math.max(0, mean - own),
    worst: worstFrame,
  };
  last = cost;
  if (!worst || cost.frame > worst.frame) worst = cost;
  frames = 0;
  frameSum = 0;
  worstFrame = 0;
  sums.clear();
  paintOverlay();
}

/** The last reading, or null while nothing has been measured yet (or nobody is watching: see watchFrames). */
export function frameCost(): FrameCost | null {
  return last;
}

/** The worst reading since measuring started: what the office looks like when it stutters, not on average. */
export function worstCost(): FrameCost | null {
  return worst;
}

/**
 * The strip on screen while the measurement is kept on so it can be read while you play (see the Graphics
 * settings: settings are no use if you have to stand still to read them). It takes no clicks, so it never
 * gets between you and the office.
 */
function setOverlay(on: boolean): void {
  if (on) {
    if (overlay || typeof document === 'undefined') return;
    overlay = document.createElement('div');
    overlay.setAttribute('aria-hidden', 'true');
    overlay.style.cssText =
      'position:fixed;left:10px;bottom:10px;z-index:60;pointer-events:none;padding:6px 10px;border-radius:9px;' +
      'background:rgba(14,14,20,.74);color:#fff;font:700 12px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;white-space:pre;';
    document.body.append(overlay);
    overlayTimer = setInterval(paintOverlay, 400);
    paintOverlay();
    return;
  }
  clearInterval(overlayTimer);
  overlayTimer = undefined;
  overlay?.remove();
  overlay = null;
}

/** What the strip says: the frame now, and the worst one since it started — the two are different questions. */
function paintOverlay(): void {
  if (!overlay) return;
  if (!last) {
    overlay.textContent = 'measuring…';
    return;
  }
  const line = (c: FrameCost) => `${c.frame.toFixed(1)} ms · ${c.fps.toFixed(0)}/s — ${c.phases.slice(0, 3).map((p) => `${p.phase} ${p.ms.toFixed(1)}`).join(' · ') || 'nothing in it'}`;
  const hitched = worst && worst.frame > last.frame * 1.15;
  overlay.textContent = hitched ? `now  ${line(last)}\nworst ${line(worst!)} (${worst!.worst} ms one frame)` : `now  ${line(last)}`;
}
