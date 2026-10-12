// The jukebox's YouTube player: one player, owned here, and never moved once it is playing — an iframe
// that changes parent is reloaded by the browser, and that restarted the song every time the jukebox's
// window opened. It stays in its own box at the top of the page; while the window is open the box sits
// over the slot that window leaves for it, and when the window closes the box simply goes out of the way,
// with the music still playing.

import './ui.css';
import { YOUTUBE, trackTitle, youtubeEmbed } from '../../../shared/jukebox';
import { store } from '../../state';
import { h } from '../../ui/dom';

export interface JukeboxPlayer {
  /** Shows the player over the jukebox's window's slot, while that window is open. */
  mount(slot: HTMLElement): void;
  /** Out of the way again: it plays on with the window closed. */
  park(): void;
}

export function makeJukeboxPlayer(): JukeboxPlayer {
  /** What the player is loaded with: a state that says the same thing doesn't reload it. */
  let key = '';
  /** Where the window leaves room for it, while that window is open. */
  let slot: HTMLElement | null = null;
  const frame = h('div.jb-frame');
  const box = h('div.jb-holder.hidden', {}, frame);
  document.body.append(box);

  /** Over the slot, or out of the way: the box is moved, the player inside it never is. */
  const place = () => {
    const r = slot?.isConnected ? slot.getBoundingClientRect() : null;
    if (!r || !r.width || !r.height) {
      box.classList.add('hidden');
      return;
    }
    box.classList.remove('hidden');
    box.style.left = `${Math.round(r.left)}px`;
    box.style.top = `${Math.round(r.top)}px`;
    box.style.width = `${Math.round(r.width)}px`;
    box.style.height = `${Math.round(r.height)}px`;
  };
  window.addEventListener('resize', place);
  document.addEventListener('scroll', place, true);

  const render = () => {
    const j = store.jukebox;
    const on = j.on && j.track === YOUTUBE;
    frame.classList.toggle('hidden', !on);
    if (!on) {
      if (key) {
        key = '';
        frame.replaceChildren();
      }
      return;
    }
    const next = `${j.video ?? ''}|${j.list ?? ''}|${j.startedAt}`;
    if (next === key) return;
    key = next;
    frame.replaceChildren(
      h('iframe', {
        src: `${youtubeEmbed(j.video ?? '', j.list)}${j.list ? '&' : '?'}autoplay=1&rel=0`,
        title: trackTitle(j),
        allow: 'autoplay; encrypted-media; picture-in-picture; fullscreen',
        allowfullscreen: 'true',
        referrerpolicy: 'strict-origin-when-cross-origin',
      }),
    );
  };

  store.on('jukebox', render);
  render();

  return {
    mount: (s) => {
      slot = s;
      render();
      place();
    },
    park: () => {
      slot = null;
      place();
    },
  };
}
