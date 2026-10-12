// The spend board: what the floor's project has spent in OMP, read off OMP's own session records
// (see server/omp-spend.ts). Two windows side by side — today and all of it — each split into the
// session's own agents, the sub-agents they spawned and the advisor, and by provider. The cost is
// the API equivalent, never a flat plan's bill, and the board says so. The button top right reads
// the records again: nothing here is on a timer (see ui/spend.ts for the window E opens).

import * as THREE from 'three';
import { fmtCost, fmtTokens, type SpendNumbers, type SpendState, type SpendWindow } from '../../../shared/protocol';
import { clip } from '../../ui/dom';

const HEAD = 'Nunito, ui-rounded, system-ui, sans-serif';
const INK = '#f8f9fa';
const MUTED = '#adb5bd';
const GOLD = '#ffd166';

/** A rectangle on the board's canvas, in pixels. */
type Rect = { x: number; y: number; w: number; h: number };

/** A rounded rectangle's path, so the button reads as one. */
function roundPath(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

/** The three kinds of agent the board tells apart, in the order it lists them. */
const KINDS = [
  { key: 'agents', label: 'Agenti' },
  { key: 'subagents', label: 'Sotto-agenti' },
  { key: 'advisors', label: 'Advisor' },
] as const;

export class SpendBoardTexture {
  readonly texture: THREE.CanvasTexture;
  private canvas = document.createElement('canvas');
  private ctx: CanvasRenderingContext2D;
  private drawn = '';
  /** The button under the mouse, drawn lit. */
  private hovered = false;
  /** Where the button is, in canvas pixels (null when the board has none). */
  private button: Rect | null = null;
  /** The state it drew last, so a hover can redraw without new numbers arriving. */
  private last: SpendState | null = null;

  constructor() {
    this.canvas.width = 1200;
    this.canvas.height = 600;
    this.ctx = this.canvas.getContext('2d')!;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 8;
  }

  /** Whether the button is at a point on the board's face (its uv): what a click reads it again. */
  refreshAt(uv: THREE.Vector2): boolean {
    const r = this.button;
    if (!r) return false;
    const px = uv.x * this.canvas.width;
    const py = (1 - uv.y) * this.canvas.height;
    return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
  }

  /** Lights the button under the mouse, so it reads as one. */
  hover(on: boolean) {
    if (on === this.hovered) return;
    this.hovered = on;
    this.redraw();
  }

  render(state: SpendState) {
    this.last = state;
    const key = `${JSON.stringify({ ...state, at: 0 })}|${this.hovered}`;
    if (key === this.drawn) return;
    this.drawn = key;
    this.draw(state);
    this.texture.needsUpdate = true;
  }

  private redraw() {
    if (!this.last) return;
    this.drawn = '';
    this.render(this.last);
  }

  private draw(state: SpendState) {
    const g = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;
    g.fillStyle = '#23303b';
    g.fillRect(0, 0, W, H);
    // chalk smudges, like the board it replaces
    g.fillStyle = 'rgba(255,255,255,.025)';
    for (let i = 0; i < 18; i++) g.fillRect(((i * 997) % W) - 60, ((i * 613) % H) - 20, 260, 34);

    g.textAlign = 'left';
    g.textBaseline = 'alphabetic';
    g.fillStyle = INK;
    g.font = `900 40px ${HEAD}`;
    g.fillText(clip(`🪙 Token · ${state.project ?? '—'}`, 34), 30, 60);

    this.drawButton(state);

    if (!state.total.calls) {
      g.textAlign = 'center';
      g.fillStyle = INK;
      g.font = `900 44px ${HEAD}`;
      g.fillText(state.note ?? (state.at ? 'Nothing spent here yet' : 'Reading the session records…'), W / 2, H / 2 - 10);
      g.textAlign = 'left';
      if (state.note) {
        g.fillStyle = MUTED;
        g.font = `700 26px ${HEAD}`;
        g.fillText('Press 🔄 to read them again', W / 2, H / 2 + 44);
      }
      return;
    }

    this.panel(30, 'OGGI', state.today);
    this.panel(630, 'TOTALE', state.total);

    // The window's own make-up, and the one thing the cost is not.
    g.fillStyle = MUTED;
    g.font = `700 21px ${HEAD}`;
    g.fillText(clip(buckets(state.total), 120), 30, H - 52);
    g.fillText(clip('Il costo è l’equivalente API: una parte sta dentro un piano a prezzo fisso (ChatGPT), il resto è a consumo.', 132), 30, H - 20);
    if (state.total.unpriced) {
      g.fillStyle = '#ffd166';
      g.textAlign = 'right';
      g.fillText(clip(`costo parziale: ${state.total.unpriced} richieste senza prezzo`, 60), W - 30, H - 20);
      g.textAlign = 'left';
    }
  }

  /** One of the two windows: its title, its two numbers, its three kinds and its providers. */
  private panel(x: number, title: string, w: SpendWindow) {
    const g = this.ctx;
    g.fillStyle = INK;
    g.font = `900 28px ${HEAD}`;
    g.fillText(title, x, 150);
    g.fillStyle = GOLD;
    g.font = `900 60px ${HEAD}`;
    g.fillText(fmtTokens(w.tokens), x, 216);
    g.fillStyle = MUTED;
    g.font = `800 26px ${HEAD}`;
    g.fillText(clip(`≈ API eq. ${fmtCost(w.cost)} · ${w.calls} richieste`, 40), x, 252);
    KINDS.forEach((k, i) => {
      const y = 306 + i * 40;
      const n: SpendNumbers = w.byAgent[k.key];
      g.fillStyle = INK;
      g.font = `800 25px ${HEAD}`;
      g.fillText(k.label, x, y);
      g.fillStyle = MUTED;
      g.font = `700 23px ${HEAD}`;
      g.textAlign = 'right';
      g.fillText(fmtTokens(n.tokens), x + 330, y);
      g.fillText(fmtCost(n.cost), x + 520, y);
      g.textAlign = 'left';
    });
    g.fillStyle = MUTED;
    g.font = `700 21px ${HEAD}`;
    g.fillText(clip(providers(w), 46), x, 456);
  }

  /** The button that reads the records again, with the time they were last read. */
  private drawButton(state: SpendState) {
    const W = this.canvas.width;
    const r = (this.button = { x: W - 30 - 168, y: 20, w: 168, h: 54 });
    const g = this.ctx;
    roundPath(g, r.x, r.y, r.w, r.h, 14);
    g.fillStyle = this.hovered ? '#3c4c5c' : '#2c3b48';
    g.fill();
    g.lineWidth = 3;
    g.strokeStyle = this.hovered ? GOLD : '#4a5a68';
    g.stroke();
    g.fillStyle = this.hovered ? GOLD : INK;
    g.font = `900 26px ${HEAD}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(`🔄 ${readAt(state.at)}`, r.x + r.w / 2, r.y + r.h / 2 + 1);
    g.textAlign = 'left';
    g.textBaseline = 'alphabetic';
  }
}

/** The time the records were last read, HH:MM, or '—' before the first read. */
function readAt(at: number): string {
  if (!at) return '—';
  const d = new Date(at);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** What the window's tokens are made of. */
function buckets(w: SpendWindow): string {
  return `input ${fmtTokens(w.input)} · output ${fmtTokens(w.output)} · cache read ${fmtTokens(w.cacheRead)} · cache write ${fmtTokens(w.cacheWrite)}`;
}

/** Who spent it, by the provider OMP names, dearest first. */
function providers(w: SpendWindow): string {
  const rows = Object.entries(w.byProvider).sort((a, b) => b[1].cost - a[1].cost);
  if (!rows.length) return '';
  return rows.map(([name, n]) => `${name} ${fmtTokens(n.tokens)} (≈ ${fmtCost(n.cost)})`).join(' · ');
}
