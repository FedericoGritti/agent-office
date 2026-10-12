// The sign that says you're arranging the room. It stays up the whole time you are, whatever you're
// looking at, so the mode is never a mystery — and it says what you're carrying and what the keys do.

import './banner.css';
import { h } from '../../ui/dom';

export interface Banner {
  /** Says something, and stays up. */
  set(text: string): void;
  /** Away again: the room is itself. */
  hide(): void;
}

export function makeBanner(): Banner {
  const el = h('div.room-banner.hidden');
  document.body.append(el);
  return {
    set(text) {
      el.textContent = text;
      el.classList.remove('hidden');
    },
    hide() {
      el.classList.add('hidden');
    },
  };
}
