/** The figures boards: one picture from the project's `images/` folder each, its whole name on the plate above. */
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

const FONT = 'Nunito, ui-rounded, system-ui, sans-serif';

/**
 * How often every board asks the folder for its list and its picture again. Nothing is cached, in the
 * office or in the browser: a figure added, taken away or written again shows up on every board of its
 * own within this, with no key to press.
 */
const POLL_MS = 3000;

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
  let names: string[] = [];
  /** The first read opens each board on a different picture; later ones keep what each board was on. */
  let opening = true;

  /** The plate over the top edge says what the board is on: the whole file name, and where it is in the folder. */
  function label(b: Board) {
    const name = names[b.at];
    b.stand.setLabel(name ? `🖼️ ${name} · ${b.at + 1}/${names.length}` : '🖼️ images/');
  }

  /** Draws whatever board `b` is on: its picture if it has landed, its note over white if it hasn't. */
  function draw(b: Board, pic: HTMLImageElement | null) {
    const { g, width: W, height: H, scale: S } = b;
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, W, H);
    const pad = Math.round(16 * S);
    if (pic && pic.naturalWidth) {
      const s = Math.min((W - pad) / pic.naturalWidth, (H - pad) / pic.naturalHeight);
      const w = pic.naturalWidth * s;
      const h = pic.naturalHeight * s;
      g.drawImage(pic, (W - w) / 2, (H - h) / 2, w, h);
    } else {
      g.fillStyle = '#6c757d';
      g.font = `900 ${Math.round(46 * S)}px ${FONT}`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(clip(b.note, 40), W / 2, H / 2);
    }
    b.stand.texture.needsUpdate = true;
  }

  /**
   * Shows the picture at `i` on board `b`, asking the office for its bytes right now. Nothing is kept
   * of the last one, and the `t` makes the browser fetch it again rather than hand back what it held.
   */
  function show(b: Board, i: number) {
    b.at = i;
    const name = names[b.at];
    label(b);
    if (!name) {
      b.note = 'No pictures in images/ yet';
      return draw(b, null);
    }
    b.note = `Loading ${name}…`;
    draw(b, null);
    const pic = new Image();
    pic.onload = () => {
      // Moved on (E, or a refreshed list) while it was arriving: that answer is stale.
      if (b.at === i) draw(b, pic);
    };
    pic.onerror = () => {
      if (b.at !== i) return;
      b.note = `${name} couldn't be read`;
      draw(b, null);
    };
    pic.src = `/api/images/file?floor=${encodeURIComponent(store.floor ?? '')}&path=${encodeURIComponent(name)}&t=${Date.now()}`;
  }

  /** The next picture on board `b`, round the folder again at the end. */
  function next(b: Board) {
    if (!names.length) return void refresh();
    show(b, (b.at + 1) % names.length);
  }

  let reading = false;
  /** A read asked for while one was in flight: it runs again once that one's done. */
  let again = false;

  /** The folder again, then each board's picture again: the list and the bytes, both asked for fresh. */
  async function refresh() {
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
    boards.forEach((b, i) => show(b, opening ? (names.length ? i % names.length : 0) : names.length ? Math.min(b.at, names.length - 1) : 0));
    opening = false;
    if (again) {
      again = false;
      void refresh();
    }
  }

  for (const b of boards) draw(b, null);
  void refresh();
  store.on('floor', () => void refresh());
  // Nothing is cached: on a timer the boards ask the folder and their picture again, so a figure
  // written again reaches every board on its own (see POLL_MS).
  setInterval(() => void refresh(), POLL_MS);

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
