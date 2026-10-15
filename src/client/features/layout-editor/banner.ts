// The sign that says you're arranging the room. It stays up the whole time you are, whatever you're
// looking at, so the mode is never a mystery — and it says what you're carrying, what the keys do, and
// carries the buttons for the two things a piece has: its size and its height.
//
// A button needs a cursor, so they are for third person (or for a mouse that isn't captured); in first
// person the mouse looks around and the keys do the same work: the wheel for the size, `-` and `+` for
// the height. A button is one step and no more, which is what a wheel can't promise — a scroll let go of
// runs away with a piece.

import './banner.css';
import { h } from '../../ui/dom';

/** What the sign is about: the piece in your hands, when the editor may change what it is. */
export interface BannerPiece {
  /** How big it is, 1 being as it came (see Carrying.size). */
  size: number;
  /** How high it stands, in metres (see Carrying.height). */
  height: number;
  /** Which way it faces, in degrees clockwise from the way it was built (see Carrying.turned). */
  turned: number;
}

/**
 * A window in your hands: it is a hole in a wall, so it has no facing of its own to turn and is measured
 * where it is rather than by how big it is against what it came as (see Windows.width and .height).
 */
export interface BannerWindow {
  /** How wide it is, in metres. */
  width: number;
  /** How tall it is, in metres, from its sill to its head. */
  height: number;
}

export interface BannerWants {
  text: string;
  /** Nothing for an empty hand, or for a piece with a seat: the sign has no buttons to show. */
  piece?: BannerPiece;
  /** A window's own pair instead: nothing for anything that isn't one. */
  window?: BannerWindow;
}

/** What its buttons do: one step down (`dir` < 0) or up, for the size, the height, the facing, and a
 *  step across the way the piece faces (see Carrying.nudge). */
export interface BannerSteps {
  size(dir: number): void;
  lift(dir: number): void;
  turn(dir: number): void;
  move(dir: number): void;
  /** A window's width and its height: one step a click, the same as the wheel and the `-`/`+` keys. */
  widen(dir: number): void;
  heighten(dir: number): void;
}

export interface Banner {
  /** Says something, and stays up. */
  set(wants: BannerWants): void;
  /** Away again: the room is itself. */
  hide(): void;
}

/** A step down and a step up about a reading, the way a size and a height are both best said: `− 130% +`. */
function step(lower: string, higher: string, down: () => void, up: () => void, sides: [string, string] = ['−', '+']): { el: HTMLElement; read: HTMLElement } {
  const read = h('span.read');
  const button = (side: string, title: string, run: () => void) => h('button.btn', { onclick: run, title }, side);
  return { read, el: h('span.step', {}, button(sides[0], lower, down), read, button(sides[1], higher, up)) };
}

/** A step each way with nothing between them: for one that has no reading of its own (see Move). */
function pair(lower: string, higher: string, down: () => void, up: () => void, sides: [string, string]): HTMLElement {
  const button = (side: string, title: string, run: () => void) => h('button.btn', { onclick: run, title }, side);
  return h('span.step', {}, button(sides[0], lower, down), button(sides[1], higher, up));
}

export function makeBanner(steps: BannerSteps): Banner {
  const text = h('span.text');
  const facing = step('A quarter turn to the left', 'A quarter turn to the right', () => steps.turn(-1), () => steps.turn(1), ['⟲', '⟳']);
  const beside = pair('A step to its left', 'A step to its right', () => steps.move(-1), () => steps.move(1), ['←', '→']);
  const size = step('Smaller', 'Bigger', () => steps.size(-1), () => steps.size(1));
  const height = step('Lower', 'Higher', () => steps.lift(-1), () => steps.lift(1));
  // Each control is a box of its own, its name over its own buttons: a run of buttons and names on one
  // line leaves you counting along it to find out which name a button belongs to (see banner.css).
  const group = (what: string, ...parts: HTMLElement[]) => h('span.group', {}, h('span.what', {}, what), ...parts);
  const buttons = h(
    'span.room-banner-buttons.hidden',
    {},
    group('Turn', facing.el),
    group('Move', beside),
    group('Size', size.el),
    group('Up', height.el),
  );
  // A window's own pair, in metres where a piece is a percentage of what it came as, and with no turn
  // between them: a hole in a wall is not facing anything (see BannerWindow).
  const wide = step('Narrower', 'Wider', () => steps.widen(-1), () => steps.widen(1));
  const tall = step('Shorter', 'Taller', () => steps.heighten(-1), () => steps.heighten(1));
  const windowButtons = h('span.room-banner-buttons.hidden', {}, group('Width', wide.el), group('Height', tall.el));
  const el = h('div.room-banner.hidden', {}, text, buttons, windowButtons);
  document.body.append(el);
  return {
    set(wants) {
      text.textContent = wants.text;
      buttons.classList.toggle('hidden', !wants.piece);
      windowButtons.classList.toggle('hidden', !wants.window);
      if (wants.window) {
        wide.read.textContent = `${wants.window.width.toFixed(2)} m`;
        tall.read.textContent = `${wants.window.height.toFixed(2)} m`;
      }
      if (wants.piece) {
        // The facing is a quarter turn at a time, so it reads as the degrees it has gone round.
        facing.read.textContent = `${Math.round(wants.piece.turned)}°`;
        size.read.textContent = `${Math.round(wants.piece.size * 100)}%`;
        // On the floor is the one height worth saying in words: the rest are metres up.
        height.read.textContent = wants.piece.height > 0.005 ? `${wants.piece.height.toFixed(2)} m` : 'floor';
      }
      el.classList.remove('hidden');
    },
    hide() {
      el.classList.add('hidden');
    },
  };
}
