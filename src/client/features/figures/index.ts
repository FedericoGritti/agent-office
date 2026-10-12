/** The figures boards: one picture from the project's `images/` folder each, its name along the bottom. */
import type { ImageList } from '../../../shared/images';
import type { Ctx } from '../../core/context';
import { aside, hintTitle, key, onE } from '../../core/hint';
import { store } from '../../state';
import { clip } from '../../ui/dom';
import type { FiguresStand } from './world';

// The kinds of thing you can use that this defines (see InteractKinds in world/types.ts).
declare module '../../world/types' {
  interface InteractKinds {
    figures: true;
  }
}

/** The strip along the bottom of a face, in pixels at the 570 px reference height: the file name always has a home. */
const CAPTION = 66;
const FONT = 'Nunito, ui-rounded, system-ui, sans-serif';

/** One board's own state: which picture it is on, and what it says while that one arrives. */
interface Board {
  readonly stand: FiguresStand;
  readonly g: CanvasRenderingContext2D;
  readonly width: number;
  readonly height: number;
  /** It was laid out on a 900×570 face: this scales that drawing to the face it actually got. */
  readonly scale: number;
  readonly strip: number;
  at: number;
  note: string;
}

export function installFigures(ctx: Ctx) {
  const boards: Board[] = ctx.office.figures.map((stand) => {
    const g = stand.face.getContext('2d')!;
    const height = stand.face.height;
    const scale = height / 570;
    return { stand, g, width: stand.face.width, height, scale, strip: Math.round(CAPTION * scale), at: 0, note: 'Reading images/…' };
  });
  /** Which board something you aim at is: its own x says it, and each stand has its own. */
  const boardAt = new Map(boards.map((b) => [b.stand.interactable.x, b]));
  /** The pictures asked for so far, by name: one fetch serves every board that shows it. */
  const pictures = new Map<string, HTMLImageElement>();
  /** The ones that wouldn't load: their boards say so rather than waiting forever. */
  const unreadable = new Set<string>();
  let names: string[] = [];

  /** The file name, and where in the folder it stands: always along the bottom of the face. */
  function caption(b: Board, text: string) {
    const { g, width: W, height: H, scale: S, strip } = b;
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
      g.fillText(`${b.at + 1}/${names.length}`, W - Math.round(20 * S), H - strip / 2);
    }
  }

  /** Draws whatever board `b` is on: its picture if it has landed, its name over white if it hasn't. */
  function draw(b: Board) {
    const { g, width: W, height: H, scale: S, strip } = b;
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, W, H);
    const name = names[b.at];
    const pic = name ? pictures.get(name) : undefined;
    const boxH = H - strip;
    const pad = Math.round(24 * S);
    if (pic?.complete && pic.naturalWidth) {
      const s = Math.min((W - pad) / pic.naturalWidth, (boxH - pad) / pic.naturalHeight);
      const w = pic.naturalWidth * s;
      const h = pic.naturalHeight * s;
      g.drawImage(pic, (W - w) / 2, (boxH - h) / 2, w, h);
      caption(b, name);
    } else {
      g.fillStyle = '#6c757d';
      g.font = `900 ${Math.round(46 * S)}px ${FONT}`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(clip(name && unreadable.has(name) ? `${name} couldn't be read` : (name ?? b.note), 40), W / 2, boxH / 2);
      if (name) caption(b, name);
    }
    b.stand.texture.needsUpdate = true;
  }

  /** Every board again: a picture that lands is drawn by all of them at once. */
  function drawAll() {
    for (const b of boards) draw(b);
  }

  /** Shows the picture at `i` on board `b`, asking for it if it isn't in hand yet. */
  function show(b: Board, i: number) {
    b.at = i;
    const name = names[b.at];
    if (name && !pictures.has(name)) {
      const pic = new Image();
      pic.onload = drawAll;
      pic.onerror = () => {
        unreadable.add(name);
        drawAll();
      };
      pic.src = `/api/images/file?floor=${encodeURIComponent(store.floor ?? '')}&path=${encodeURIComponent(name)}`;
      pictures.set(name, pic);
    }
    draw(b);
  }

  /** The next picture on board `b`, round the folder again at the end. */
  function next(b: Board) {
    if (!names.length) return void read();
    show(b, (b.at + 1) % names.length);
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
    pictures.clear();
    unreadable.clear();
    for (const b of boards) b.note = 'No pictures in images/ yet';
    // Each board opens on a different picture, so the row isn't three of the same.
    boards.forEach((b, i) => show(b, names.length ? i % names.length : 0));
    if (again) {
      again = false;
      void read();
    }
  }

  drawAll();
  void read();
  store.on('floor', () => void read());

  ctx.interactions.define('figures', {
    reach: 6,
    hint: (it) => {
      const b = boardAt.get(it.x);
      const name = b ? names[b.at] : undefined;
      return { k: String(names.length && b ? b.at + 1 : 0), parts: [hintTitle('🖼️ Figures'), aside(clip(name ?? 'images/', 40)), key('E', names.length ? 'Next' : 'Look')] };
    },
    use: onE((it) => {
      const b = boardAt.get(it.x);
      if (b) next(b);
    }),
  });
}
