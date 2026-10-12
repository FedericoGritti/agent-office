/** The figures boards: one picture from the project's `images/` folder each, its name on the plate above. */
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

/** How much of a file name fits on the plate above a board. */
const NAME = 34;
const FONT = 'Nunito, ui-rounded, system-ui, sans-serif';

/** One board's own state: which picture it is on, and what it says while that one arrives. */
interface Board {
  readonly stand: FiguresStand;
  readonly g: CanvasRenderingContext2D;
  readonly width: number;
  readonly height: number;
  /** The face was laid out on a 900×570 canvas: this scales that drawing to the face it actually got. */
  readonly scale: number;
  at: number;
  note: string;
}

export function installFigures(ctx: Ctx) {
  const boards: Board[] = ctx.office.figures.map((stand) => {
    const g = stand.face.getContext('2d')!;
    const height = stand.face.height;
    return { stand, g, width: stand.face.width, height, scale: height / 570, at: 0, note: 'Reading images/…' };
  });
  /** Which board something you aim at is: the point you aim at is the board's own, so it says which.
   *  Keyed by that point, not by where it stands: moving a board moves the point with it. */
  const boardAt = new Map(boards.map((b) => [b.stand.interactable, b]));
  /** The pictures asked for so far, by name: one fetch serves every board that shows it. */
  const pictures = new Map<string, HTMLImageElement>();
  /** The ones that wouldn't load: their boards say so rather than waiting forever. */
  const unreadable = new Set<string>();
  let names: string[] = [];

  /** The plate over the top edge says what the board is on: the file name, and where it is in the folder. */
  function label(b: Board) {
    const name = names[b.at];
    b.stand.setLabel(name ? `🖼️ ${clip(name, NAME)} · ${b.at + 1}/${names.length}` : '🖼️ images/');
  }

  /** Draws whatever board `b` is on: its picture if it has landed, its name over white if it hasn't. */
  function draw(b: Board) {
    const { g, width: W, height: H, scale: S } = b;
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, W, H);
    const name = names[b.at];
    const pic = name ? pictures.get(name) : undefined;
    const pad = Math.round(16 * S);
    if (pic?.complete && pic.naturalWidth) {
      const s = Math.min((W - pad) / pic.naturalWidth, (H - pad) / pic.naturalHeight);
      const w = pic.naturalWidth * s;
      const h = pic.naturalHeight * s;
      g.drawImage(pic, (W - w) / 2, (H - h) / 2, w, h);
    } else {
      g.fillStyle = '#6c757d';
      g.font = `900 ${Math.round(46 * S)}px ${FONT}`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(clip(name && unreadable.has(name) ? `${name} couldn't be read` : (name ?? b.note), 40), W / 2, H / 2);
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
    label(b);
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
    // Each board opens on a different picture, so the row isn't the same one three times.
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
      const b = boardAt.get(it);
      const name = b ? names[b.at] : undefined;
      return { k: String(names.length && b ? b.at + 1 : 0), parts: [hintTitle('🖼️ Figures'), aside(clip(name ?? 'images/', 40)), key('E', names.length ? 'Next' : 'Look')] };
    },
    use: onE((it) => {
      const b = boardAt.get(it);
      if (b) next(b);
    }),
  });
}
