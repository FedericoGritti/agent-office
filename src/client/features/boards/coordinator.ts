// The coordinator's three wall boards: the checklist, the day's timeline, and the phase in a word.
// Each draws onto a canvas texture the way the GitHub boards did, so the same texture goes on the
// board in whichever world you're in (see features/boards/index.ts). Only the short of it goes on
// the wall; the whole plan opens in the window (ui/coordinator.ts).

import * as THREE from 'three';
import { CHECKLIST_ROWS, clampRow, localDay } from '../../../shared/coordinator';
import type { CoordinatorState, SubplanStatus } from '../../../shared/protocol';
import { clip } from '../../ui/dom';
import { wrap } from './world';

const INK = '#2b2d42';
const MUTED = '#5c5f73';
const HEAD = 'Nunito, ui-rounded, system-ui, sans-serif';

/** A rectangle on the board's canvas, in pixels. */
type Rect = { x: number; y: number; w: number; h: number };

/** Where one of the checklist board's arrows sits, in the strip along the bottom. */
function arrowRect(W: number, H: number, which: 'up' | 'down'): Rect {
  const size = 56;
  const down = W - 32 - size;
  return { x: which === 'down' ? down : down - size - 12, y: H - 18 - size, w: size, h: size };
}

/** A rounded rectangle's path, so the arrows read as buttons. */
function roundPath(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

/** The dot beside a subplan, by where it stands. */
const STATUS_COLOR: Record<SubplanStatus, string> = {
  Pending: '#8d99ae',
  Ready: '#118ab2',
  Planned: '#9b5de5',
  'In flight': '#ffb703',
  Blocked: '#ef476f',
  Done: '#06d6a0',
};

/** What to say when there's no plan to draw: the office's own words when it couldn't read one. */
function missing(state: CoordinatorState): string {
  return state.error ? `⚠️ ${state.error}` : 'No plan in this project’s plans/ folder';
}

/** One of the coordinator's boards: the checklist, today's timeline, or the phase summary. */
export class CoordinatorBoardTexture {
  readonly texture: THREE.CanvasTexture;
  private canvas = document.createElement('canvas');
  private ctx: CanvasRenderingContext2D;
  /** What it drew last, so it only redraws when the plan says something new. */
  private drawn = '';
  /** The plan it drew last, so a hover can redraw the arrows without a new plan arriving. */
  private last: CoordinatorState | null = null;
  /** The checklist board's arrow under the mouse, drawn lit. */
  private hovered: 'up' | 'down' | null = null;
  /** Where the checklist board's two arrows sit, in canvas pixels (null when it has none). */
  private arrows: { up: Rect; down: Rect } | null = null;

  constructor(private kind: 'checklist' | 'timeline' | 'summary') {
    this.canvas.width = 1200;
    this.canvas.height = 600;
    this.ctx = this.canvas.getContext('2d')!;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 8;
  }

  render(state: CoordinatorState) {
    this.last = state;
    const key = `${JSON.stringify({ ...state, at: 0 })}|${this.hovered ?? ''}`;
    if (key === this.drawn) return;
    this.drawn = key;
    if (this.kind === 'checklist') this.drawChecklist(state);
    else if (this.kind === 'timeline') this.drawTimeline(state);
    else this.drawSummary(state);
    this.texture.needsUpdate = true;
  }

  /** The arrow at a point on the board's face (its uv), or null over the rows or bare board. */
  arrowAt(uv: THREE.Vector2): 'up' | 'down' | null {
    if (!this.arrows) return null;
    const px = uv.x * this.canvas.width;
    const py = (1 - uv.y) * this.canvas.height;
    const on = (r: Rect) => px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
    return on(this.arrows.up) ? 'up' : on(this.arrows.down) ? 'down' : null;
  }

  /** Lights the arrow under the mouse, so it reads as a button (null for none). */
  hover(arrow: 'up' | 'down' | null) {
    if (arrow === this.hovered) return;
    this.hovered = arrow;
    if (this.last) this.render(this.last);
  }

  /** A board with nothing to show, in the colors of the one it stands for. */
  private blank(note: string, dark: boolean) {
    const g = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;
    g.fillStyle = dark ? '#23303b' : '#fffaf3';
    g.fillRect(0, 0, W, H);
    g.fillStyle = dark ? '#e9ecef' : INK;
    g.font = `800 40px ${HEAD}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const lines = wrap(g, note, 840, 4);
    lines.forEach((line, i) => g.fillText(line, W / 2, H / 2 - ((lines.length - 1) * 50) / 2 + i * 50));
    g.textAlign = 'left';
    g.textBaseline = 'alphabetic';
  }

  private drawChecklist(state: CoordinatorState) {
    const g = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;
    if (!state.phase && !state.cards.length) return this.blank(missing(state), false);
    g.fillStyle = '#fffaf3';
    g.fillRect(0, 0, W, H);
    g.fillStyle = INK;
    g.font = `900 46px ${HEAD}`;
    g.fillText('📋 Checklist', 32, 66);
    g.fillStyle = MUTED;
    g.font = `800 30px ${HEAD}`;
    g.fillText(clip(state.phase ?? '—', 40), 32, 108);
    const total = state.cards.length;
    const start = clampRow(state.row, total);
    const cards = state.cards.slice(start, start + CHECKLIST_ROWS);
    // The arrows get a strip along the bottom, and only when there's more than fits at once.
    const scrollable = total > CHECKLIST_ROWS;
    const bottom = scrollable ? H - 76 : H;
    const rowH = Math.min(46, (bottom - 170) / Math.max(1, cards.length));
    cards.forEach((c, i) => {
      const y = 160 + i * rowH;
      g.beginPath();
      g.arc(46, y - 8, 9, 0, Math.PI * 2);
      g.fillStyle = STATUS_COLOR[c.status];
      g.fill();
      g.fillStyle = INK;
      g.font = `800 26px ${HEAD}`;
      g.fillText(clip(`${c.id} ${c.name}`, 40), 68, y);
      g.fillStyle = MUTED;
      g.font = `700 22px ${HEAD}`;
      g.textAlign = 'right';
      g.fillText(clip(c.statusText, 20), W - 32, y);
      g.textAlign = 'left';
    });
    if (scrollable) {
      this.arrows = { up: arrowRect(W, H, 'up'), down: arrowRect(W, H, 'down') };
      g.fillStyle = MUTED;
      g.font = `800 24px ${HEAD}`;
      g.fillText(`${start + 1}–${start + cards.length} of ${total}`, 32, H - 28);
      this.drawArrow('up', '▲', this.arrows.up, start > 0);
      this.drawArrow('down', '▼', this.arrows.down, start + CHECKLIST_ROWS < total);
    } else {
      this.arrows = null;
    }
  }

  /** Draws one of the checklist board's arrows: lit when it can move, faded when it's at the end. */
  private drawArrow(which: 'up' | 'down', glyph: string, r: Rect, enabled: boolean) {
    const g = this.ctx;
    roundPath(g, r.x, r.y, r.w, r.h, 12);
    g.fillStyle = enabled ? (this.hovered === which ? '#dbe7ff' : '#ffffff') : '#f0ece4';
    g.fill();
    g.lineWidth = 4;
    g.strokeStyle = enabled ? INK : '#cdc7bd';
    g.stroke();
    g.fillStyle = enabled ? INK : '#cdc7bd';
    g.font = `900 34px ${HEAD}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(glyph, r.x + r.w / 2, r.y + r.h / 2 + 2);
    g.textAlign = 'left';
    g.textBaseline = 'alphabetic';
  }

  private drawTimeline(state: CoordinatorState) {
    const g = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;
    const today = state.timeline.filter((e) => e.date === localDay());
    if (!today.length) return this.blank(state.phase ? 'Nothing on today’s timeline yet' : missing(state), true);
    g.fillStyle = '#23303b';
    g.fillRect(0, 0, W, H);
    g.fillStyle = '#e9ecef';
    g.font = `900 46px ${HEAD}`;
    g.fillText('🕓 Today', 32, 66);
    const shown = today.slice(-9);
    const rowH = Math.min(52, (H - 150) / shown.length);
    shown.forEach((e, i) => {
      const y = 140 + i * rowH;
      g.fillStyle = '#ffd166';
      g.font = '900 24px ui-monospace, Menlo, monospace';
      g.fillText(e.time, 32, y);
      g.fillStyle = '#f8f9fa';
      g.font = `800 26px ${HEAD}`;
      g.fillText(clip(e.text, 48), 132, y);
    });
    if (today.length > shown.length) {
      g.fillStyle = 'rgba(233,236,239,.6)';
      g.font = `800 24px ${HEAD}`;
      g.textAlign = 'right';
      g.fillText(`+${today.length - shown.length} earlier`, W - 32, H - 16);
      g.textAlign = 'left';
    }
  }

  private drawSummary(state: CoordinatorState) {
    const g = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;
    if (!state.phase) return this.blank(missing(state), false);
    g.fillStyle = '#fffaf3';
    g.fillRect(0, 0, W, H);
    g.fillStyle = INK;
    g.font = `900 44px ${HEAD}`;
    g.fillText(clip(`🎯 ${state.phase}`, 38), 32, 70);
    g.fillStyle = MUTED;
    g.font = `700 28px ${HEAD}`;
    const goal = wrap(g, state.goal ?? 'No goal written in the master plan yet', W - 64, 5);
    const goalTop = 124;
    goal.forEach((line, i) => g.fillText(line, 32, goalTop + i * 36));
    const top = goalTop + goal.length * 36 + 34;
    g.fillStyle = INK;
    g.font = `900 30px ${HEAD}`;
    g.fillText(`Chapters · ${state.chapters.length}`, 32, top);
    g.fillStyle = MUTED;
    g.font = `800 26px ${HEAD}`;
    const rowH = Math.min(40, (H - top - 30) / Math.max(1, state.chapters.length));
    state.chapters.slice(0, 6).forEach((c, i) => g.fillText(clip(`${c.n} ${c.title}`, 44), 48, top + 34 + i * rowH));
  }
}
