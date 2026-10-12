// The panel that moves the room: what stands where, by the numbers, and the way out.

import './ui.css';
import { labelFor, type Placements } from '../../../shared/placement';
import type { Piece } from '../../world/office/placed';
import { h, openModal, toast } from '../../ui/dom';
import type { Hands } from './hands';

/** Radians in the room, degrees in the panel: nobody checks a shelf at 1.5708 radians. */
const deg = (rad: number) => Math.round((rad * 180) / Math.PI);

export interface EditorOpts {
  /** Writes the working copy to the office (see layout.set). */
  save(file: Placements): void;
  /** Whether this floor can be rearranged at all. */
  canEdit(): boolean;
}

/**
 * Opens the panel, with the hands that move things. Dragging happens on the floor behind it, so the
 * panel keeps out of the way in the corner and nothing here closes on a click outside it.
 */
export function openLayoutEditor(hands: Hands, opts: EditorOpts): void {
  const list = h('div.le-list');
  const status = h('span.le-status', {});

  const field = (piece: Piece, key: 'x' | 'z' | 'rotY') => {
    const input = h('input.le-field', {
      type: 'number',
      step: key === 'rotY' ? '15' : '0.25',
      value: String(key === 'rotY' ? deg(piece.at.rotY) : piece.at[key]),
      'aria-label': `${labelFor(piece.id)} ${key}`,
      onchange: () => {
        const v = Number(input.value);
        if (!Number.isFinite(v)) return;
        hands.setField(piece, key, key === 'rotY' ? (v * Math.PI) / 180 : v);
      },
    });
    return h('label.le-cell', {}, h('span', {}, key === 'rotY' ? '°' : key), input);
  };

  const row = (piece: Piece) =>
    h(
      'div.le-row',
      piece.at.hidden ? { class: 'le-row gone' } : {},
      h('button.le-name', { type: 'button', title: 'Pick it up on the floor', onclick: () => hands.select(piece) }, labelFor(piece.id)),
      field(piece, 'x'),
      field(piece, 'z'),
      field(piece, 'rotY'),
      h('button.btn.le-btn', { type: 'button', title: 'A quarter turn', onclick: () => hands.turn(piece) }, '⟳'),
      h('button.btn.le-btn', { type: 'button', title: 'Back where it was', onclick: () => hands.reset(piece) }, '↺'),
      h(
        'button.btn.le-btn.le-gone',
        { type: 'button', title: piece.at.hidden ? 'Put it back in the room' : 'Take it out of the room', onclick: () => hands.toggleGone(piece) },
        piece.at.hidden ? '↩' : '✕',
      ),
    );

  const redraw = () => {
    const pieces = hands.pieces();
    list.replaceChildren(
      ...(pieces.length ? pieces.map(row) : [h('p.le-empty', {}, 'Nothing here can be moved yet.')]),
    );
    status.textContent = hands.dirty() ? 'Unsaved changes' : 'Saved';
  };
  hands.onChanged = redraw;

  const save = h(
    'button.btn.primary',
    {
      type: 'button',
      onclick: () => {
        hands.save();
        redraw();
      },
    },
    'Save',
  );
  const revert = h(
    'button.btn',
    {
      type: 'button',
      title: 'Throw these changes away',
      onclick: () => {
        hands.revert();
        redraw();
      },
    },
    'Undo all',
  );

  const el = h(
    'div.layout-editor',
    {},
    h(
      'header',
      {},
      h('strong', {}, '🛠️ The room'),
      h('span.grow', {}),
      status,
    ),
    h(
      'p.le-help',
      {},
      'Drag a piece on the floor (it lands on a 25 cm grid), R turns it a quarter, Canc takes it away, Ctrl+Z undoes.',
    ),
    list,
    h('footer', {}, revert, h('span.grow', {}), save),
  );

  const modal = openModal(el, {
    doing: '🛠️ moving the room around',
    backdropCloses: false,
    onClose: () => {
      hands.onChanged = () => {};
      hands.select(null);
      off();
    },
  });

  // The keys the panel's buttons share, while it is open and you aren't typing in a field.
  const onKey = (e: KeyboardEvent) => {
    const inField = (e.target as HTMLElement | null)?.tagName === 'INPUT';
    if (e.key === 'r' && !inField) hands.turn(hands.selectedPiece(), e.shiftKey);
    else if (e.key === 'R' && !inField) hands.turn(hands.selectedPiece(), true);
    else if ((e.key === 'Delete' || e.key === 'Backspace') && !inField) {
      const piece = hands.selectedPiece();
      if (piece) hands.toggleGone(piece);
    } else if (e.key.toLowerCase() === 'z' && (e.ctrlKey || e.metaKey)) hands.undo();
    else return;
    e.preventDefault();
    redraw();
  };
  window.addEventListener('keydown', onKey);

  // Dragging, on the whole page: the window's backdrop is over the room, and the click is still here.
  const overPanel = (e: PointerEvent) => el.contains(e.target as Node);
  const onDown = (e: PointerEvent) => {
    if (overPanel(e) || e.button !== 0) return;
    if (hands.down(e)) e.preventDefault();
  };
  const onMove = (e: PointerEvent) => {
    if (overPanel(e)) return;
    hands.move();
    hands.hover(e);
  };
  const onUp = () => hands.up();
  document.addEventListener('pointerdown', onDown);
  document.addEventListener('pointermove', onMove);
  document.addEventListener('pointerup', onUp);
  const off = () => {
    window.removeEventListener('keydown', onKey);
    document.removeEventListener('pointerdown', onDown);
    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerup', onUp);
  };

  if (!opts.canEdit()) toast('Take the elevator to a floor first');
  redraw();
  void modal;
}
