/** The figures board: one picture from the project's `images/` folder at a time, its name on it. */
import type { ImageList } from '../../../shared/images';
import type { Ctx } from '../../core/context';
import { aside, hintTitle, key, onE } from '../../core/hint';
import { store } from '../../state';
import { clip } from '../../ui/dom';

// The kinds of thing you can use that this defines (see InteractKinds in world/types.ts).
declare module '../../world/types' {
  interface InteractKinds {
    figures: true;
  }
}

/** The strip along the bottom of the face, in pixels at the 570 px reference height: the file name always has a home. */
const CAPTION = 66;
const FONT = 'Nunito, ui-rounded, system-ui, sans-serif';

export function installFigures(ctx: Ctx) {
  const { face, texture } = ctx.office.figures;
  const g = face.getContext('2d')!;
  const W = face.width;
  const H = face.height;
  // The whole drawing below was laid out on a 900×570 face: it scales from the face it is given.
  const S = H / 570;
  const strip = Math.round(CAPTION * S);
  let names: string[] = [];
  let at = 0;
  let note = 'Reading images/…';
  /** The pictures already asked for, by name: they arrive once and are drawn from memory after. */
  const pictures = new Map<string, HTMLImageElement>();

  /** The file name, and where in the folder it stands: always along the bottom of the face. */
  function caption(text: string) {
    g.fillStyle = '#2b2d42';
    g.fillRect(0, H - strip, W, strip);
    g.fillStyle = '#f8f9fa';
    g.font = `800 ${Math.round(34 * S)}px ${FONT}`;
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    g.fillText(clip(text, 52), Math.round(20 * S), H - strip / 2);
    if (names.length) {
      g.fillStyle = '#adb5bd';
      g.textAlign = 'right';
      g.fillText(`${at + 1}/${names.length}`, W - Math.round(20 * S), H - strip / 2);
    }
  }

  function draw() {
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, W, H);
    const name = names[at];
    const pic = name ? pictures.get(name) : undefined;
    const boxH = H - strip;
    const pad = Math.round(24 * S);
    if (pic?.complete && pic.naturalWidth) {
      const s = Math.min((W - pad) / pic.naturalWidth, (boxH - pad) / pic.naturalHeight);
      const w = pic.naturalWidth * s;
      const h = pic.naturalHeight * s;
      g.drawImage(pic, (W - w) / 2, (boxH - h) / 2, w, h);
      caption(name);
    } else {
      g.fillStyle = '#6c757d';
      g.font = `900 ${Math.round(46 * S)}px ${FONT}`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(clip(name ?? note, 40), W / 2, boxH / 2);
      if (name) caption(name);
    }
    texture.needsUpdate = true;
  }

  /** Shows the picture at `i`, asking for it if it isn't in hand yet. */
  function show(i: number) {
    at = i;
    const name = names[at];
    if (!name) return draw();
    if (!pictures.has(name)) {
      const pic = new Image();
      pic.onload = () => draw();
      pic.onerror = () => {
        note = `${name} couldn't be read`;
        draw();
      };
      pic.src = `/api/images/file?floor=${encodeURIComponent(store.floor ?? '')}&path=${encodeURIComponent(name)}`;
      pictures.set(name, pic);
    }
    draw();
  }

  let reading = false;
  /** A read asked for while one was in flight: it runs again once that one's done. */
  let again = false;

  /** The folder again: a floor change means another project's figures. */
  async function read() {
    // Nothing to read until the welcome says which floor (and so which project) you're on.
    if (!store.floor) return;
    if (reading) {
      again = true;
      return;
    }
    reading = true;
    try {
      const r = await fetch(`/api/images?floor=${encodeURIComponent(store.floor)}`, { credentials: 'same-origin' });
      if (!r.ok) throw new Error(String(r.status));
      names = ((await r.json()) as ImageList).files;
    } catch {
      names = [];
    } finally {
      reading = false;
    }
    note = 'No pictures in images/ yet';
    pictures.clear();
    show(0);
    if (again) {
      again = false;
      void read();
    }
  }

  /** The next picture, round the folder again at the end. */
  function next() {
    if (!names.length) return void read();
    show((at + 1) % names.length);
  }

  draw();
  void read();
  store.on('floor', () => void read());

  ctx.interactions.define('figures', {
    reach: 6,
    hint: () => ({ k: String(names.length ? at + 1 : 0), parts: [hintTitle('🖼️ Figures'), aside(clip(names[at] ?? 'images/', 40)), key('E', names.length ? 'Next' : 'Look')] }),
    use: onE(() => next()),
  });
}
