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
}

export interface BannerWants {
  text: string;
  /** Nothing for an empty hand, or for a piece with a seat: the sign has no buttons to show. */
  piece?: BannerPiece;
}

/** What its buttons do: one step down (`dir` < 0) or up, for the size and for the height. */
export interface BannerSteps {
  size(dir: number): void;
  lift(dir: number): void;
}

export interface Banner {
  /** Says something, and stays up. */
  set(wants: BannerWants): void;
  /** Away again: the room is itself. */
  hide(): void;
}

/** A step down and a step up about a reading, the way a size and a height are both best said: `− 130% +`. */
function step(lower: string, higher: string, down: () => void, up: () => void): { el: HTMLElement; read: HTMLElement } {
  const read = h('span.read');
  const button = (side: string, title: string, run: () => void) => h('button.btn', { onclick: run, title }, side);
  return { read, el: h('span.step', {}, button('−', lower, down), read, button('+', higher, up)) };
}

export function makeBanner(steps: BannerSteps): Banner {
  const text = h('span.text');
  const size = step('Smaller', 'Bigger', () => steps.size(-1), () => steps.size(1));
  const height = step('Lower', 'Higher', () => steps.lift(-1), () => steps.lift(1));
  const buttons = h('span.room-banner-buttons.hidden', {}, h('span.what', {}, 'Size'), size.el, h('span.what', {}, 'Up'), height.el);
  const el = h('div.room-banner.hidden', {}, text, buttons);
  document.body.append(el);
  return {
    set(wants) {
      text.textContent = wants.text;
      buttons.classList.toggle('hidden', !wants.piece);
      if (wants.piece) {
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
